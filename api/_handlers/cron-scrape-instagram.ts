// Cron handler: scrape Instagram profiles into instagram_posts.
// Schedule (Pro plan): daily 10:00 UTC.
// Auth: x-vercel-cron OR Bearer $CRON_SECRET.
//
// Pipeline:
//  1. SELECT viral_tracked_sources where source_type='instagram' AND client_id IS NOT NULL
//     (requires client_id because instagram_posts is per-client)
//  2. For each: call Apify apify~instagram-scraper (limit 5 newest posts)
//  3. UPSERT into instagram_posts by (client_id, post_id)
//  4. UPDATE last_scraped_at
//
// NOTE: Apify call costs ~$0.005/profile. Set RADAR_IG_CRON_ENABLED=1 to enable.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { query } from '../_lib/db.js';
import { assertCronAuth } from '../_lib/cron-auth.js';

interface TrackedSource {
  id: string;
  client_id: string | null;
  source_url: string;
  source_name: string | null;
  niche: string | null;
}

interface IgPost {
  id?: string;
  shortCode?: string;
  url?: string;
  type?: string;
  caption?: string;
  ownerUsername?: string;
  likesCount?: number;
  commentsCount?: number;
  timestamp?: string;
  displayUrl?: string;
  videoUrl?: string;
  videoViewCount?: number;
  productType?: string;
  [k: string]: unknown;
}

const POSTS_PER_HANDLE = 5;

function extractHandle(value: string): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  const urlMatch = v.match(/instagram\.com\/([A-Za-z0-9._-]+)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();
  return v.replace(/^@/, '').replace(/^https?:\/\//i, '').toLowerCase();
}

async function callApifyForHandles(apifyKey: string, handles: string[]): Promise<IgPost[]> {
  const url = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=240`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directUrls: handles.map((h) => `https://www.instagram.com/${h}/`),
      resultsType: 'posts',
      resultsLimit: POSTS_PER_HANDLE,
      addParentData: true,
    }),
    signal: AbortSignal.timeout(260_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Apify ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as IgPost[];
  return Array.isArray(data) ? data : [];
}

async function upsertIgPost(
  post: IgPost,
  source: TrackedSource,
): Promise<boolean> {
  const postId = post.id || post.shortCode;
  if (!postId || !source.client_id) return false;

  const postType = (() => {
    const t = (post.type || '').toLowerCase();
    if (t === 'video' || post.productType === 'clips') return 'reel';
    if (t === 'sidecar') return 'carousel';
    return 'image';
  })();

  try {
    // UPSERT — first try insert, on conflict update metrics
    await query(
      `INSERT INTO instagram_posts (
         client_id, post_id, post_type, caption, posted_at,
         likes, comments, thumbnail_url, permalink,
         video_url, metadata, created_at, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,NOW(),NOW())
       ON CONFLICT (client_id, post_id) DO UPDATE SET
         likes = EXCLUDED.likes,
         comments = EXCLUDED.comments,
         caption = COALESCE(EXCLUDED.caption, instagram_posts.caption),
         updated_at = NOW()`,
      [
        source.client_id,
        postId,
        postType,
        post.caption ?? null,
        post.timestamp ? new Date(post.timestamp).toISOString() : null,
        Number(post.likesCount ?? 0),
        Number(post.commentsCount ?? 0),
        post.displayUrl ?? null,
        post.url ?? `https://www.instagram.com/p/${post.shortCode ?? postId}/`,
        post.videoUrl ?? null,
        JSON.stringify({
          owner_username: post.ownerUsername ?? null,
          video_view_count: post.videoViewCount ?? null,
          radar_source_id: source.id,
        }),
      ],
    );
    return true;
  } catch (err: any) {
    // ON CONFLICT requires a unique constraint on (client_id, post_id).
    // If it doesn't exist yet, fall back to manual select-then-insert/update.
    const msg = err?.message || '';
    if (/no unique or exclusion constraint/i.test(msg)) {
      try {
        const existing = await query<{ id: string }>(
          `SELECT id FROM instagram_posts WHERE client_id = $1 AND post_id = $2 LIMIT 1`,
          [source.client_id, postId],
        );
        if (existing.length > 0) {
          await query(
            `UPDATE instagram_posts
                SET likes = $3, comments = $4, updated_at = NOW()
              WHERE id = $1 AND client_id = $2`,
            [existing[0].id, source.client_id, Number(post.likesCount ?? 0), Number(post.commentsCount ?? 0)],
          );
        } else {
          await query(
            `INSERT INTO instagram_posts (
               client_id, post_id, post_type, caption, posted_at,
               likes, comments, thumbnail_url, permalink,
               video_url, metadata, created_at, updated_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,NOW(),NOW())`,
            [
              source.client_id,
              postId,
              postType,
              post.caption ?? null,
              post.timestamp ? new Date(post.timestamp).toISOString() : null,
              Number(post.likesCount ?? 0),
              Number(post.commentsCount ?? 0),
              post.displayUrl ?? null,
              post.url ?? `https://www.instagram.com/p/${post.shortCode ?? postId}/`,
              post.videoUrl ?? null,
              JSON.stringify({
                owner_username: post.ownerUsername ?? null,
                video_view_count: post.videoViewCount ?? null,
                radar_source_id: source.id,
              }),
            ],
          );
        }
        return true;
      } catch (err2: any) {
        console.warn(`[cron-ig] fallback upsert ${postId} failed:`, err2?.message);
        return false;
      }
    }
    console.warn(`[cron-ig] upsert ${postId} failed:`, msg);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // Cron auth via Authorization: Bearer $CRON_SECRET. Header `x-vercel-cron`
  // standalone NÃO é confiável — é forjável em traffic externo.
  if (!assertCronAuth(req, res)) return;

  const t0 = Date.now();
  const dry = String(req.query.dry || '') === 'true';
  const enabled = process.env.RADAR_IG_CRON_ENABLED?.replace(/\\n/g, '').trim() === '1';

  // Per-client mode: ?client_id=<uuid> — só fontes daquele client.
  // Sem client_id, escaneia TODAS as fontes IG com client_id setado (legacy global mode).
  // Instagram requer client_id pois `instagram_posts` é per-client.
  const clientIdRaw = req.query.client_id;
  const clientId = Array.isArray(clientIdRaw) ? clientIdRaw[0] : clientIdRaw;
  const isPerClient = typeof clientId === 'string' && clientId.length > 0;

  let sources: TrackedSource[] = [];
  try {
    const baseSelect = `SELECT id, client_id, source_url, source_name, niche
         FROM viral_tracked_sources
        WHERE source_type = 'instagram'
          AND COALESCE(is_active, true) = true
          AND client_id IS NOT NULL`;

    if (isPerClient) {
      sources = await query<TrackedSource>(
        `${baseSelect}
          AND client_id = $1
        ORDER BY last_scraped_at NULLS FIRST
        LIMIT 30`,
        [clientId],
      );
    } else {
      sources = await query<TrackedSource>(
        `${baseSelect}
        ORDER BY last_scraped_at NULLS FIRST
        LIMIT 30`,
      );
    }
  } catch (err: any) {
    return jsonError(res, 500, 'Failed to query sources', { detail: err?.message });
  }

  if (sources.length === 0) {
    return res.status(200).json({
      ok: true,
      skipped: isPerClient
        ? `No active Instagram sources for client ${clientId}`
        : 'No active Instagram sources with client_id in viral_tracked_sources',
      scope: isPerClient ? 'client' : 'global',
      client_id: isPerClient ? clientId : null,
      duration_ms: Date.now() - t0,
    });
  }

  const handles = sources
    .map((s) => extractHandle(s.source_url))
    .filter((h): h is string => Boolean(h));

  if (dry) {
    return res.status(200).json({
      ok: true,
      dry: true,
      cron_enabled: enabled,
      sources: sources.length,
      handles,
      apify_status: enabled ? 'would_call_apify' : 'disabled (set RADAR_IG_CRON_ENABLED=1)',
      duration_ms: Date.now() - t0,
    });
  }

  if (!enabled) {
    return res.status(200).json({
      ok: true,
      skipped: 'RADAR_IG_CRON_ENABLED not set — Apify calls disabled to avoid cost',
      sources: sources.length,
      handles,
      duration_ms: Date.now() - t0,
    });
  }

  const apifyKey = (process.env.APIFY_API_KEY_INSTAGRAM || process.env.APIFY_API_KEY || '')
    .replace(/\\n/g, '')
    .trim();
  if (!apifyKey) {
    return jsonError(res, 500, 'APIFY_API_KEY not configured');
  }

  // Map handle (lowercased) → source for upsert
  const handleToSource = new Map<string, TrackedSource>();
  for (const s of sources) {
    const h = extractHandle(s.source_url);
    if (h) handleToSource.set(h, s);
  }

  let posts: IgPost[] = [];
  try {
    posts = await callApifyForHandles(apifyKey, handles);
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: 'apify_failed',
      detail: err?.message || String(err),
      duration_ms: Date.now() - t0,
    });
  }

  let totalInserted = 0;
  for (const post of posts) {
    const owner = (post.ownerUsername ?? '').toLowerCase();
    const source = handleToSource.get(owner) ?? sources[0];
    const ok = await upsertIgPost(post, source);
    if (ok) totalInserted++;
  }

  await query(
    `UPDATE viral_tracked_sources
        SET last_scraped_at = NOW()
      WHERE id = ANY($1::uuid[])`,
    [sources.map((s) => s.id)],
  ).catch(() => null);

  return res.status(200).json({
    ok: true,
    sources: sources.length,
    handles: handles.length,
    posts_received: posts.length,
    inserted: totalInserted,
    duration_ms: Date.now() - t0,
  });
}
