// embed-knowledge: backfill de embeddings em global_knowledge.
// Lista itens onde embedding IS NULL, gera embedding via OpenAI
// (text-embedding-3-small, 1536 dims) e atualiza a coluna.
//
// Auth: super_admin OR cron secret
//   - Authorization: Bearer $CRON_SECRET (scheduler Vercel anexa automaticamente)
//   - User autenticado e presente em public.super_admins
//
// Body (POST JSON, opcional):
//   {
//     workspaceId?: string,   // limita backfill a uma workspace específica
//     batchSize?: number,     // default 50, max 100
//     maxItems?: number,      // limite total de itens a processar (default 500)
//     dryRun?: boolean        // só conta, não atualiza
//   }
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { query, queryOne, getPool } from '../_lib/db.js';
import { generateEmbeddings, toVectorLiteral } from '../_lib/shared/embeddings.js';
import { isValidCronCall } from '../_lib/cron-auth.js';

interface BodyShape {
  workspaceId?: string;
  batchSize?: number;
  maxItems?: number;
  dryRun?: boolean;
}

interface KnowledgeRow {
  id: string;
  title: string;
  content: string;
  summary: string | null;
}

async function isAuthorized(req: VercelRequest): Promise<{ ok: boolean; reason?: string }> {
  // Cron via Bearer CRON_SECRET. Header `x-vercel-cron` standalone NÃO conta.
  if (isValidCronCall(req)) return { ok: true, reason: 'cron' };

  // Tentar JWT autenticado + super_admin
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

  const body: BodyShape =
    req.body && typeof req.body === 'object'
      ? (req.body as BodyShape)
      : req.body
        ? (JSON.parse(req.body as unknown as string) as BodyShape)
        : {};

  const batchSize = Math.min(Math.max(body.batchSize ?? 50, 1), 100);
  const maxItems = Math.min(Math.max(body.maxItems ?? 500, 1), 5000);
  const dryRun = body.dryRun === true;
  const workspaceFilter = body.workspaceId ?? null;

  const t0 = Date.now();

  // 1. Quantos faltam ao todo (estatística)
  let totalMissing = 0;
  try {
    const r = await queryOne<{ c: string }>(
      workspaceFilter
        ? 'SELECT count(*)::text AS c FROM public.global_knowledge WHERE embedding IS NULL AND workspace_id = $1'
        : 'SELECT count(*)::text AS c FROM public.global_knowledge WHERE embedding IS NULL',
      workspaceFilter ? [workspaceFilter] : [],
    );
    totalMissing = Number(r?.c ?? 0);
  } catch (e: any) {
    return jsonError(res, 500, 'Failed to count missing embeddings', { detail: e?.message });
  }

  if (dryRun) {
    return res.status(200).json({
      ok: true,
      dryRun: true,
      totalMissing,
      wouldProcess: Math.min(totalMissing, maxItems),
      batchSize,
      maxItems,
      duration_ms: Date.now() - t0,
    });
  }

  let processed = 0;
  let updated = 0;
  let failedBatches = 0;
  const errors: string[] = [];
  const pool = getPool();

  while (processed < Math.min(totalMissing, maxItems)) {
    const remaining = Math.min(totalMissing - processed, maxItems - processed, batchSize);
    if (remaining <= 0) break;

    let rows: KnowledgeRow[] = [];
    try {
      rows = await query<KnowledgeRow>(
        workspaceFilter
          ? `SELECT id, title, content, summary
               FROM public.global_knowledge
              WHERE embedding IS NULL AND workspace_id = $2
              ORDER BY created_at ASC
              LIMIT $1`
          : `SELECT id, title, content, summary
               FROM public.global_knowledge
              WHERE embedding IS NULL
              ORDER BY created_at ASC
              LIMIT $1`,
        workspaceFilter ? [remaining, workspaceFilter] : [remaining],
      );
    } catch (e: any) {
      errors.push(`select batch failed: ${e?.message}`);
      break;
    }

    if (!rows.length) break;

    // Texto a embarcar: title + (summary || content) — limita o escopo.
    const inputs = rows.map((r) => {
      const body = r.summary && r.summary.trim() ? r.summary : r.content || '';
      return `${r.title}\n\n${body}`.slice(0, 24000);
    });

    let embeddings: number[][] = [];
    try {
      embeddings = await generateEmbeddings(inputs);
    } catch (e: any) {
      failedBatches += 1;
      errors.push(`embed batch failed: ${e?.message}`);
      // Avança o cursor pra não travar em loop (essa janela falhou).
      processed += rows.length;
      continue;
    }

    // Update um por um numa transaction (Neon serverless suporta)
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
          `UPDATE public.global_knowledge
              SET embedding = $1::vector,
                  updated_at = now()
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
    totalMissing,
    processed,
    updated,
    failedBatches,
    errors: errors.slice(0, 10),
    duration_ms: Date.now() - t0,
  });
}
