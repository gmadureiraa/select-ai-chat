#!/usr/bin/env bun
/**
 * Backfill Late.so (Zernio) — Madureira
 *
 * Reagenda os ~85 planning_items do Madureira que estão `status=scheduled`,
 * `external_post_id IS NULL` e `scheduled_at >= NOW()` via Late API.
 *
 * Contexto: vieram do Metricool (provider=metricool nas credentials). Metricool
 * foi removido em 2026-05-18; agora precisamos reagendar tudo via Late/Zernio.
 *
 * Uso:
 *   bun run scripts/backfill-madureira-late.ts --dry-run
 *   bun run scripts/backfill-madureira-late.ts --limit=1
 *   bun run scripts/backfill-madureira-late.ts
 *
 * Pré-requisitos:
 *   - LATE_API_KEY em .env.local (pegar do dashboard Late.so)
 *   - DATABASE_URL em .env.local (já presente)
 *   - client_social_credentials do Madureira com metadata.late_profile_id +
 *     metadata.late_account_id por plataforma (vem do OAuth/import Late)
 *
 * Idempotência:
 *   - Pula posts com external_post_id já preenchido
 *   - Re-rodar não duplica
 *
 * Rate-limit:
 *   - 1 request a cada 2 segundos (30 req/min, abaixo do cap)
 */
import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

// ===== Config =====
const CLIENT_ID = '14bf8576-7104-48ca-962d-014308e45a4e'; // Madureira
const LATE_API_BASE = 'https://getlate.dev/api/v1';
const RATE_LIMIT_MS = 2_000;
const SCHEDULED_VIA = 'late-backfill-2026-05-18';

const ALLOWED_PLATFORMS = new Set([
  'twitter',
  'linkedin',
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'threads',
]);

// ===== Args =====
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

// ===== Env loader (mesmo padrão do scripts/find-clients.ts) =====
function loadEnv(): Record<string, string> {
  const file = readFileSync('.env.local', 'utf-8');
  const env: Record<string, string> = {};
  for (const line of file.split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue;
    const [k, ...rest] = line.split('=');
    let v = rest
      .join('=')
      .trim()
      .replace(/^"/, '')
      .replace(/"\s*\\n?\s*$/, '')
      .replace(/"$/, '');
    env[k.trim()] = v;
  }
  return env;
}

const env = loadEnv();
const LATE_API_KEY = env.LATE_API_KEY || process.env.LATE_API_KEY;
const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[fatal] DATABASE_URL não configurada em .env.local');
  process.exit(1);
}

if (!LATE_API_KEY && !dryRun) {
  console.error(
    '[fatal] LATE_API_KEY não configurada. Configure LATE_API_KEY em .env.local pegando de Vercel env ou do dashboard Late.so (https://getlate.dev → Settings → API).',
  );
  process.exit(1);
}

// ===== Tipos =====
interface PlanningItem {
  id: string;
  workspace_id: string;
  client_id: string;
  title: string | null;
  content: string | null;
  platform: string;
  content_type: string | null;
  scheduled_at: string;
  media_urls: string[] | null;
  metadata: Record<string, any> | null;
  external_post_id: string | null;
  added_to_library: boolean;
}

interface SocialCredential {
  id: string;
  platform: string;
  account_name: string | null;
  is_valid: boolean;
  metadata: Record<string, any> | null;
}

interface LateAccount {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  connected?: boolean;
  status?: string;
}

// ===== Late API helpers =====
async function lateGet<T>(path: string): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const r = await fetch(`${LATE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${LATE_API_KEY}`, 'Content-Type': 'application/json' },
  });
  const text = await r.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {}
  return { ok: r.ok, status: r.status, data, text };
}

async function latePost<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const r = await fetch(`${LATE_API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${LATE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {}
  return { ok: r.ok, status: r.status, data, text };
}

// ===== Payload builder (espelha api/_handlers/late-post.ts) =====
function buildLatePayload(item: PlanningItem, lateAccountId: string): Record<string, unknown> | null {
  const platform = item.platform;
  if (!ALLOWED_PLATFORMS.has(platform)) return null;

  const metadata = item.metadata || {};
  const platformOptions = (metadata.platform_options || {}) as Record<string, any>;
  const igOpts = platformOptions.instagram || {};
  const fbOpts = platformOptions.facebook || {};
  const threadItems = metadata.thread_tweets || metadata.threadItems || null;

  let content = item.content || '';
  if (platform === 'instagram' && igOpts.customCaption?.trim()) content = igOpts.customCaption;
  else if (platform === 'facebook' && fbOpts.customCaption?.trim()) content = fbOpts.customCaption;

  // Threads char cap
  const THREADS_MAX_CHARS = 500;
  if (platform === 'threads' && content && content.length > THREADS_MAX_CHARS) {
    content = content.substring(0, THREADS_MAX_CHARS - 3) + '...';
  }

  const mediaUrls = Array.isArray(item.media_urls) ? item.media_urls : [];
  const finalMediaItems = mediaUrls.map((url: string, i: number) => ({
    type: url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image',
    url,
    order: i,
  }));

  const payload: Record<string, unknown> = {
    publishNow: false,
    scheduledFor: item.scheduled_at,
  };

  // Threads (X/Threads compostos)
  if (
    Array.isArray(threadItems) &&
    threadItems.length > 0 &&
    (platform === 'twitter' || platform === 'threads')
  ) {
    const lateThreadItems = threadItems.map((t: any, i: number) => {
      const text = t.text || t.content || '';
      const mu: string[] = t.media_urls || [];
      return {
        content:
          platform === 'threads' && text.length > THREADS_MAX_CHARS
            ? text.substring(0, THREADS_MAX_CHARS - 3) + '...'
            : text,
        order: i,
        ...(mu.length
          ? {
              mediaItems: mu.map((url: string, j: number) => ({
                type: url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image',
                url,
                order: j,
              })),
            }
          : {}),
      };
    });
    payload.platforms = [
      {
        platform,
        accountId: lateAccountId,
        platformSpecificData: { threadItems: lateThreadItems },
      },
    ];
    payload.content = lateThreadItems[0]?.content || content;
    return payload;
  }

  // Single-post fluxo
  payload.content = content;
  const platformSpecificData: Record<string, unknown> = {};

  if (platform === 'tiktok') {
    platformSpecificData.privacy_level = 'PUBLIC_TO_EVERYONE';
    if (content.length > 150) platformSpecificData.title = content.substring(0, 147) + '...';
  }
  if (platform === 'youtube') {
    platformSpecificData.visibility = 'public';
    const lines = content.split('\n');
    platformSpecificData.title = lines[0]?.substring(0, 100) || item.title?.substring(0, 100) || 'Untitled';
    if (lines.length > 1) platformSpecificData.description = lines.slice(1).join('\n');
  }
  if (platform === 'instagram') {
    // contentType: REELS / CAROUSEL / POST. Derivar de content_type / igOpts
    const igContentType =
      igOpts.contentType ||
      (item.content_type === 'reel'
        ? 'REELS'
        : item.content_type === 'carrossel' || item.content_type === 'carousel'
          ? 'CAROUSEL'
          : 'POST');
    platformSpecificData.contentType = igContentType;
    if (igOpts.firstComment) platformSpecificData.firstComment = igOpts.firstComment;
    if (igOpts.shareToFeed !== undefined) platformSpecificData.shareToFeed = igOpts.shareToFeed;
    if (igOpts.trialReel !== undefined) platformSpecificData.trialReel = igOpts.trialReel;
  }
  if (platform === 'facebook' && fbOpts.contentType) {
    platformSpecificData.contentType = fbOpts.contentType;
    if (fbOpts.firstComment) platformSpecificData.firstComment = fbOpts.firstComment;
  }

  payload.platforms = [
    {
      platform,
      accountId: lateAccountId,
      ...(Object.keys(platformSpecificData).length > 0 ? { platformSpecificData } : {}),
    },
  ];
  if (finalMediaItems.length > 0) payload.mediaItems = finalMediaItems;
  return payload;
}

// ===== Main =====
async function main() {
  console.log('========================================');
  console.log('Backfill Madureira → Late.so');
  console.log('========================================');
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`Limit: ${Number.isFinite(limit) ? limit : 'no limit'}`);
  console.log(`Client: ${CLIENT_ID} (Madureira)`);
  console.log('');

  const pool = new Pool({ connectionString: DATABASE_URL });
  const c = await pool.connect();

  try {
    // ===== 1. Validar Late auth (skip em dry-run) =====
    if (!dryRun) {
      console.log('[1/4] Validando LATE_API_KEY...');
      const me = await lateGet<any>('/profiles');
      if (!me.ok) {
        console.error(
          `[fatal] Late API auth falhou (HTTP ${me.status}): ${me.text.substring(0, 200)}`,
        );
        console.error('       Verifique LATE_API_KEY em .env.local.');
        process.exit(1);
      }
      console.log(`       OK — perfis encontrados: ${me.data?.profiles?.length ?? '?'}`);
    } else {
      console.log('[1/4] (dry-run) Pulando validação Late auth');
    }

    // ===== 2. Buscar credenciais Madureira =====
    console.log('[2/4] Buscando client_social_credentials Madureira...');
    const credsRes = await c.query<SocialCredential>(
      `SELECT id, platform, account_name, is_valid, metadata
         FROM client_social_credentials
        WHERE client_id = $1
          AND platform != 'late_profile'`,
      [CLIENT_ID],
    );
    const allCreds = credsRes.rows;
    console.log(`       ${allCreds.length} credenciais totais`);

    // Mapa platform → late_account_id
    const accountIdByPlatform = new Map<string, string>();
    const credByPlatform = new Map<string, SocialCredential>();
    let lateProfileId: string | null = null;

    for (const cred of allCreds) {
      const meta = (cred.metadata || {}) as any;
      credByPlatform.set(cred.platform, cred);
      const lateAcct = meta.late_account_id || (meta.provider === 'late' ? cred.account_name : null);
      if (lateAcct) accountIdByPlatform.set(cred.platform, lateAcct);
      if (meta.late_profile_id && !lateProfileId) lateProfileId = meta.late_profile_id;
    }

    console.log(`       Late profile_id detectado: ${lateProfileId || '(nenhum)'}`);
    console.log(`       Plataformas c/ late_account_id: ${[...accountIdByPlatform.keys()].join(', ') || '(nenhuma)'}`);

    // ===== 2b. Cross-check com Late /accounts (skip em dry-run) =====
    if (!dryRun && lateProfileId) {
      console.log(`       Validando accounts no Late API (profileId=${lateProfileId})...`);
      const acctRes = await lateGet<{ accounts: LateAccount[] }>(`/accounts?profileId=${lateProfileId}`);
      if (acctRes.ok && acctRes.data) {
        const lateAccts = acctRes.data.accounts || [];
        console.log(`       Late tem ${lateAccts.length} accounts pra esse profileId`);
        for (const a of lateAccts) {
          console.log(`         - ${a.platform}: ${a.displayName || a.username} (id=${a._id} connected=${a.connected !== false})`);
        }
      } else {
        console.warn(`       [warn] Falha ao listar accounts: HTTP ${acctRes.status}`);
      }
    }

    // ===== 3. Listar pendências =====
    console.log('[3/4] Listando posts pendentes...');
    const pendingRes = await c.query<PlanningItem>(
      `SELECT id, workspace_id, client_id, title, content, platform, content_type,
              scheduled_at, media_urls, metadata, external_post_id, added_to_library
         FROM planning_items
        WHERE client_id = $1
          AND status = 'scheduled'
          AND external_post_id IS NULL
          AND scheduled_at >= NOW()
        ORDER BY scheduled_at ASC`,
      [CLIENT_ID],
    );
    const allPending = pendingRes.rows;
    console.log(`       ${allPending.length} posts pendentes encontrados`);

    const items = allPending.slice(0, Number.isFinite(limit) ? limit : allPending.length);
    console.log(`       Processando ${items.length} (limit=${Number.isFinite(limit) ? limit : 'all'})`);

    // ===== 4. Loop =====
    console.log('[4/4] Processando posts...\n');

    let done = 0;
    let skipped = 0;
    let warned = 0;
    let failed = 0;
    const skippedByPlatform = new Map<string, number>();
    const failuresByPlatform = new Map<string, string[]>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const progress = `[${i + 1}/${items.length}]`;

      // idempotência
      if (item.external_post_id) {
        console.log(`${progress} SKIP (external_post_id já existe): ${item.id}`);
        skipped++;
        continue;
      }

      // credencial?
      const lateAccountId = accountIdByPlatform.get(item.platform);
      if (!lateAccountId) {
        console.warn(
          `${progress} WARN  [${item.platform}] ${item.title?.substring(0, 60)} — sem late_account_id (conta não conectada no Late). Pulando.`,
        );
        skippedByPlatform.set(item.platform, (skippedByPlatform.get(item.platform) || 0) + 1);
        warned++;
        continue;
      }

      const payload = buildLatePayload(item, lateAccountId);
      if (!payload) {
        console.warn(`${progress} WARN  [${item.platform}] plataforma não suportada — pulando`);
        warned++;
        continue;
      }

      if (dryRun) {
        console.log(
          `${progress} DRY   [${item.platform}/${item.content_type}] @ ${item.scheduled_at} — ${item.title?.substring(0, 60)}`,
        );
        console.log(`         payload: ${JSON.stringify(payload).substring(0, 240)}...`);
        done++;
        continue;
      }

      // POST real
      try {
        const r = await latePost<{ post?: { _id?: string; url?: string }; postId?: string }>(
          '/posts',
          payload,
        );
        if (!r.ok) {
          let userMessage = `HTTP ${r.status}`;
          try {
            const j = r.data as any;
            if (j?.error) userMessage = j.error;
            else if (j?.message) userMessage = j.message;
          } catch {}
          console.error(`${progress} FAIL  [${item.platform}] ${item.id} — ${userMessage}`);
          failed++;
          const arr = failuresByPlatform.get(item.platform) || [];
          arr.push(`${item.id}: ${userMessage}`);
          failuresByPlatform.set(item.platform, arr);
        } else {
          const postId = (r.data as any)?.post?._id || (r.data as any)?.postId;
          const publishedUrl =
            (r.data as any)?.post?.platforms?.[0]?.platformPostUrl ||
            (r.data as any)?.post?.platforms?.[0]?.publishedUrl ||
            (r.data as any)?.post?.url ||
            null;

          if (!postId) {
            console.error(`${progress} FAIL  [${item.platform}] ${item.id} — Late retornou OK mas sem postId`);
            failed++;
          } else {
            // Update planning_item
            const existingMetadata = (item.metadata || {}) as any;
            const newMetadata = {
              ...existingMetadata,
              late_post_id: postId,
              late_confirmed: true,
              scheduled_via: SCHEDULED_VIA,
              ...(publishedUrl ? { published_url: publishedUrl } : {}),
            };
            await c.query(
              `UPDATE planning_items
                  SET external_post_id = $1,
                      metadata = $2::jsonb,
                      updated_at = NOW()
                WHERE id = $3`,
              [postId, JSON.stringify(newMetadata), item.id],
            );
            console.log(`${progress} OK    [${item.platform}] ${item.id} → late_post=${postId}`);
            done++;
          }
        }
      } catch (err: any) {
        console.error(`${progress} ERROR [${item.platform}] ${item.id} — ${err.message}`);
        failed++;
        const arr = failuresByPlatform.get(item.platform) || [];
        arr.push(`${item.id}: ${err.message}`);
        failuresByPlatform.set(item.platform, arr);
      }

      // rate-limit
      if (i < items.length - 1) await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }

    // ===== Resumo =====
    console.log('\n========================================');
    console.log('Resumo');
    console.log('========================================');
    console.log(`Total processado: ${items.length} / ${allPending.length} pendentes`);
    console.log(`  OK:      ${done}`);
    console.log(`  Skipped: ${skipped} (idempotência)`);
    console.log(`  Warned:  ${warned} (sem credencial / plat. não suportada)`);
    console.log(`  Failed:  ${failed}`);
    if (skippedByPlatform.size > 0) {
      console.log('  Skipped por plataforma:');
      for (const [p, n] of skippedByPlatform) console.log(`    - ${p}: ${n}`);
    }
    if (failuresByPlatform.size > 0) {
      console.log('  Falhas por plataforma:');
      for (const [p, errs] of failuresByPlatform) {
        console.log(`    - ${p}: ${errs.length}`);
        for (const e of errs.slice(0, 3)) console.log(`        · ${e}`);
        if (errs.length > 3) console.log(`        · (+${errs.length - 3} mais)`);
      }
    }
    if (dryRun) {
      console.log('\n(dry-run — nenhuma chamada Late foi feita, nenhum DB foi alterado)');
    }
  } finally {
    c.release();
    await pool.end();
  }
}

await main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
