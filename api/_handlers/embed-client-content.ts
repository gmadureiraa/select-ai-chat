// embed-client-content: backfill de embeddings em client_content_library.
// Lista itens onde embedding IS NULL, gera embedding via OpenAI
// (text-embedding-3-small, 1536 dims) e atualiza a coluna.
//
// Auth: super_admin OR cron secret
//   - Authorization: Bearer $CRON_SECRET (scheduler Vercel anexa automaticamente)
//   - User autenticado e presente em public.super_admins
//
// Body (POST JSON, opcional):
//   {
//     workspace_id?: uuid,    // limita backfill a uma workspace específica
//     client_id?: uuid,       // limita backfill a um cliente específico
//     batch_size?: number,    // default 50, max 100
//     max_items?: number,     // limite total a processar (default 500, max 2000)
//     dry_run?: boolean       // só conta, não atualiza
//   }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { query, queryOne, getPool } from '../_lib/db.js';
import { generateEmbeddings, toVectorLiteral } from '../_lib/shared/embeddings.js';
import { isValidCronCall } from '../_lib/cron-auth.js';
import { z } from 'zod';

const BodySchema = z.object({
  workspace_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  batch_size: z.number().int().min(1).max(100).default(50),
  max_items: z.number().int().min(1).max(2000).default(500),
  dry_run: z.boolean().default(false),
});

interface ContentRow {
  id: string;
  client_id: string;
  title: string;
  content: string;
}

async function isAuthorized(req: VercelRequest): Promise<{ ok: boolean; reason?: string }> {
  // Cron via Bearer CRON_SECRET. Header `x-vercel-cron` standalone NÃO conta.
  if (isValidCronCall(req)) return { ok: true, reason: 'cron' };

  const user = await tryAuth(req);
  if (!user) return { ok: false, reason: 'no auth + not cron' };

  const sa = await queryOne<{ id: string }>(
    'SELECT id FROM public.super_admins WHERE user_id = $1 LIMIT 1',
    [user.id],
  );
  if (!sa) return { ok: false, reason: 'not super_admin' };
  return { ok: true, reason: 'super_admin' };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed');
  }

  const authz = await isAuthorized(req);
  if (!authz.ok) {
    return jsonError(res, 401, `Unauthorized (${authz.reason ?? 'forbidden'})`);
  }

  const rawBody =
    req.body && typeof req.body === 'object'
      ? req.body
      : req.body
        ? JSON.parse(req.body as unknown as string)
        : {};

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(res, 400, 'Invalid body', { issues: parsed.error.errors });
  }
  const { workspace_id, client_id, batch_size, max_items, dry_run } = parsed.data;
  const t0 = Date.now();

  // ─── Build WHERE clause dinâmico ────────────────────────────────────────
  // workspace_id filtra via JOIN com clients.
  const filters: string[] = ['ccl.embedding IS NULL'];
  const params: unknown[] = [];

  if (client_id) {
    params.push(client_id);
    filters.push(`ccl.client_id = $${params.length}`);
  }

  let joinClause = '';
  if (workspace_id) {
    joinClause = 'INNER JOIN public.clients c ON c.id = ccl.client_id';
    params.push(workspace_id);
    filters.push(`c.workspace_id = $${params.length}`);
  }

  const baseFrom = `FROM public.client_content_library ccl ${joinClause}`;
  const whereClause = `WHERE ${filters.join(' AND ')}`;

  // 1. Total faltando (estatística)
  let totalMissing = 0;
  try {
    const r = await queryOne<{ c: string }>(
      `SELECT count(*)::text AS c ${baseFrom} ${whereClause}`,
      params,
    );
    totalMissing = Number(r?.c ?? 0);
  } catch (e: any) {
    return jsonError(res, 500, 'Failed to count missing embeddings', { detail: e?.message });
  }

  if (dry_run) {
    return res.status(200).json({
      ok: true,
      dry_run: true,
      total_missing: totalMissing,
      would_process: Math.min(totalMissing, max_items),
      batch_size,
      max_items,
      duration_ms: Date.now() - t0,
    });
  }

  let processed = 0;
  let updated = 0;
  let failedBatches = 0;
  const errors: string[] = [];
  const pool = getPool();

  while (processed < Math.min(totalMissing, max_items)) {
    const remaining = Math.min(totalMissing - processed, max_items - processed, batch_size);
    if (remaining <= 0) break;

    let rows: ContentRow[] = [];
    try {
      const limitParam = params.length + 1;
      rows = await query<ContentRow>(
        `SELECT ccl.id, ccl.client_id, ccl.title, ccl.content
           ${baseFrom}
           ${whereClause}
           ORDER BY ccl.created_at DESC NULLS LAST
           LIMIT $${limitParam}`,
        [...params, remaining],
      );
    } catch (e: any) {
      errors.push(`select batch failed: ${e?.message}`);
      break;
    }

    if (!rows.length) break;

    const inputs = rows.map((r) => {
      const text = `${r.title}\n\n${r.content || ''}`.slice(0, 24000);
      return text.trim() ? text : '(empty)';
    });

    let embeddings: number[][] = [];
    try {
      embeddings = await generateEmbeddings(inputs);
    } catch (e: any) {
      failedBatches += 1;
      errors.push(`embed batch failed: ${e?.message}`);
      processed += rows.length;
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const emb = embeddings[i];
        if (!Array.isArray(emb) || emb.length !== 1536) {
          errors.push(`row ${row.id}: bad embedding length ${emb?.length}`);
          continue;
        }
        await client.query(
          `UPDATE public.client_content_library
              SET embedding = $1::vector,
                  embedded_at = now()
            WHERE id = $2`,
          [toVectorLiteral(emb), row.id],
        );
        updated += 1;
      }
      await client.query('COMMIT');
    } catch (e: any) {
      await client.query('ROLLBACK').catch(() => {});
      errors.push(`update batch failed: ${e?.message}`);
    } finally {
      client.release();
    }

    processed += rows.length;
  }

  return res.status(200).json({
    ok: true,
    total_missing: totalMissing,
    processed,
    updated,
    failed_batches: failedBatches,
    errors: errors.slice(0, 10),
    duration_ms: Date.now() - t0,
  });
}
