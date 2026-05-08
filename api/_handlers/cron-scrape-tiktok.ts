// Cron handler: scrape TikTok profiles into viral_tiktok_posts.
// Schedule (Pro plan): daily 11:00 UTC.
// Auth: x-vercel-cron OR Bearer $CRON_SECRET.
//
// Pipeline:
//  1. SELECT tiktok sources from viral_tracked_sources (source_type='tiktok')
//  2. Group handles into one Apify call per batch (clockworks/tiktok-scraper)
//  3. UPSERT in viral_tiktok_posts by shortcode
//  4. UPDATE last_scraped_at
//
// IMPORTANT: Apify call costs money (~$0.01 per profile). Set
// `RADAR_TIKTOK_CRON_ENABLED=1` in Vercel env to actually call Apify.
// Without it, runs in "shadow" mode (logs handles, no external calls).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { query } from '../_lib/db.js';

interface TrackedSource {
  id: string;
  source_url: string;        // e.g. https://www.tiktok.com/@handle  OR @handle  OR handle
  source_name: string | null;
  category: string | null;
  niche: string | null;
}

interface TiktokRaw {
  id?: string;
  videoId?: string;
  webVideoUrl?: string;
  text?: string;
  authorMeta?: { name?: string };
  videoMeta?: { coverUrl?: string };
  videoUrl?: string;
  playCount?: number;
  diggCount?: number;
  shareCount?: number;
  commentCount?: number;
  hashtags?: Array<{ name?: string } | string>;
  createTimeISO?: string;
  [k: string]: unknown;
}

const POSTS_PER_HANDLE = 12;

function extractHandle(value: string): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  const urlMatch = v.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();
  return v.replace(/^@/, '').replace(/^https?:\/\//i, '').toLowerCase();
}

async function callApify(apifyKey: string, handles: string[]): Promise<TiktokRaw[]> {
  const profiles = handles.map((h) => `https://www.tiktok.com/@${h.replace(/^@/, '')}`);
  const url = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=240`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profiles,
      resultsPerPage: POSTS_PER_HANDLE,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    }),
    signal: AbortSignal.timeout(260_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Apify ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as TiktokRaw[];
  return Array.isArray(data) ? data : [];
}

async function upsertTiktokPost(post: TiktokRaw, source: TrackedSource): Promise<boolean> {
  const shortcode = post.id || post.videoId;
  const url = post.webVideoUrl || (post.videoUrl as string | undefined) ||
              (shortcode ? `https://www.tiktok.com/@${post.authorMeta?.name ?? ''}/video/${shortcode}` : '');
  if (!shortcode || !url) return false;

  const hashtagNames = (post.hashtags ?? []).map((h: any) =>
    typeof h === 'string' ? h : (h?.name ?? '')
  ).filter(Boolean);

  try {
    await query(
      `INSERT INTO viral_tiktok_posts (
         shortcode, url, author, caption,
         views, likes, comments, shares,
         niche, hashtags, posted_at, scraped_at,
         thumbnail_url, video_url, metadata
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,NOW(),$12,$13,$14::jsonb)
       ON CONFLICT (shortcode) DO UPDATE SET
         views = EXCLUDED.views,
         likes = EXCLUDED.likes,
         comments = EXCLUDED.comments,
         shares = EXCLUDED.shares,
         scraped_at = NOW()`,
      [
        shortcode,
        url,
        post.authorMeta?.name ?? extractHandle(source.source_url),
        post.text ?? null,
        Number(post.playCount ?? 0),
        Number(post.diggCount ?? 0),
        Number(post.commentCount ?? 0),
        Number(post.shareCount ?? 0),
        source.niche ?? null,
        JSON.stringify(hashtagNames),
        post.createTimeISO ? new Date(post.createTimeISO).toISOString() : null,
        post.videoMeta?.coverUrl ?? null,
        post.videoUrl ?? null,
        JSON.stringify({ source_id: source.id }),
      ],
    );
    return true;
  } catch (err: any) {
    console.warn(`[cron-tiktok] upsert ${shortcode} failed:`, err?.message);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  const cronSecret = process.env.CRON_SECRET;
  const isCron =
    req.headers['x-vercel-cron'] === '1' ||
    (cronSecret && req.headers.authorization === `Bearer ${cronSecret}`);
  if (!isCron) {
    return jsonError(res, 401, 'Unauthorized');
  }

  const t0 = Date.now();
  const dry = String(req.query.dry || '') === 'true';
  const enabled = process.env.RADAR_TIKTOK_CRON_ENABLED === '1';

  // Per-client mode: ?client_id=<uuid> — só fontes daquele client
  // Default (global): só fontes sem client_id setado
  const clientIdRaw = req.query.client_id;
  const clientId = Array.isArray(clientIdRaw) ? clientIdRaw[0] : clientIdRaw;
  const isPerClient = typeof clientId === 'string' && clientId.length > 0;

  let sources: TrackedSource[] = [];
  try {
    const baseSelect = `SELECT id, source_url, source_name, category, niche
         FROM viral_tracked_sources
        WHERE source_type = 'tiktok'
          AND COALESCE(is_active, true) = true`;

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
          AND client_id IS NULL
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
        ? `No active TikTok sources for client ${clientId}`
        : 'No active global TikTok sources in viral_tracked_sources',
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
      apify_status: enabled ? 'would_call_apify' : 'disabled (set RADAR_TIKTOK_CRON_ENABLED=1)',
      duration_ms: Date.now() - t0,
    });
  }

  if (!enabled) {
    return res.status(200).json({
      ok: true,
      skipped: 'RADAR_TIKTOK_CRON_ENABLED not set — Apify calls disabled to avoid cost',
      sources: sources.length,
      handles,
      duration_ms: Date.now() - t0,
    });
  }

  const apifyKey = process.env.APIFY_API_KEY;
  if (!apifyKey) {
    return jsonError(res, 500, 'APIFY_API_KEY not configured');
  }

  // Map handle → source for upsert annotation
  const handleToSource = new Map<string, TrackedSource>();
  for (const s of sources) {
    const h = extractHandle(s.source_url);
    if (h) handleToSource.set(h, s);
  }

  let totalInserted = 0;
  let apifyError: string | null = null;
  let posts: TiktokRaw[] = [];

  try {
    posts = await callApify(apifyKey, handles);
  } catch (err: any) {
    apifyError = err?.message || String(err);
  }

  if (apifyError) {
    return res.status(500).json({
      ok: false,
      error: 'apify_failed',
      detail: apifyError,
      handles_attempted: handles.length,
      duration_ms: Date.now() - t0,
    });
  }

  for (const post of posts) {
    const author = (post.authorMeta?.name ?? '').toLowerCase();
    const source = handleToSource.get(author) ?? sources[0];
    const ok = await upsertTiktokPost(post, source);
    if (ok) totalInserted++;
  }

  // Update last_scraped_at for all sources we attempted
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
