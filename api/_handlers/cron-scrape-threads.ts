// Cron handler: scrape Meta Threads profiles into viral_threads_posts.
// Schedule (Pro plan): daily 11:30 UTC.
// Auth: x-vercel-cron OR Bearer $CRON_SECRET.
//
// Pipeline:
//  1. SELECT threads sources from viral_tracked_sources (source_type='threads')
//  2. Group handles into one Apify call (apify/threads-scraper or curious_coder/threads-scraper)
//  3. UPSERT in viral_threads_posts by url
//  4. UPDATE last_scraped_at
//
// IMPORTANT: Apify call costs money (~$0.01-0.02 per profile depending on actor).
// Set `RADAR_THREADS_CRON_ENABLED=1` in Vercel env to actually call Apify.
// Without it, runs in "shadow" mode (logs handles, no external calls).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { query } from '../_lib/db.js';
import { assertCronAuth } from '../_lib/cron-auth.js';

interface TrackedSource {
  id: string;
  source_url: string;
  source_name: string | null;
  category: string | null;
  niche: string | null;
}

// The Threads Apify actor schema varies — keep loose typing.
interface ThreadsRaw {
  id?: string;
  pk?: string;
  code?: string;
  url?: string;
  postUrl?: string;
  text?: string;
  caption?: string;
  user?: { username?: string; follower_count?: number; pk?: string };
  username?: string;
  authorUsername?: string;
  followerCount?: number;
  likeCount?: number;
  likes?: number;
  repostCount?: number;
  reposts?: number;
  replyCount?: number;
  replies?: number;
  viewCount?: number;
  views?: number;
  takenAt?: number | string;
  publishedOn?: string;
  posted_at?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  mediaUrls?: string[];
  [k: string]: unknown;
}

const POSTS_PER_HANDLE = 12;
// 2026-05-08 — padronizado pra `curious_coder~threads-scraper` (actor mais novo,
// melhor cobertura) alinhado com `import-client-social-content.ts`. Audit E
// identificou conflito anterior com `apify~threads-scraper`. Pode ser overrided
// via env APIFY_THREADS_ACTOR.
const DEFAULT_ACTOR = process.env.APIFY_THREADS_ACTOR || 'curious_coder~threads-scraper';

function extractHandle(value: string): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  const urlMatch = v.match(/threads\.(net|com)\/@?([A-Za-z0-9._-]+)/i);
  if (urlMatch) return urlMatch[2].toLowerCase();
  return v.replace(/^@/, '').replace(/^https?:\/\//i, '').toLowerCase();
}

function pickAuthor(post: ThreadsRaw, fallbackHandle: string): string {
  return (
    post.user?.username ||
    post.username ||
    post.authorUsername ||
    fallbackHandle
  );
}

function pickUrl(post: ThreadsRaw, author: string): string | null {
  if (post.url) return post.url;
  if (post.postUrl) return post.postUrl;
  if (post.code) return `https://www.threads.com/@${author}/post/${post.code}`;
  return null;
}

function pickPostedAt(post: ThreadsRaw): string | null {
  if (post.publishedOn) {
    try { return new Date(post.publishedOn).toISOString(); } catch {}
  }
  if (post.posted_at) {
    try { return new Date(post.posted_at).toISOString(); } catch {}
  }
  if (post.takenAt) {
    try {
      const ts = typeof post.takenAt === 'number' ? post.takenAt * 1000 : Date.parse(String(post.takenAt));
      return new Date(ts).toISOString();
    } catch {}
  }
  return null;
}

function pickMediaUrls(post: ThreadsRaw): string[] {
  const arr = post.mediaUrls ?? post.imageUrls ?? [];
  const vids = post.videoUrls ?? [];
  return [...arr, ...vids].filter(Boolean);
}

async function callApify(apifyKey: string, handles: string[]): Promise<ThreadsRaw[]> {
  const profiles = handles.map((h) => `https://www.threads.com/@${h.replace(/^@/, '')}`);
  // The Apify Threads scrapers tend to accept either `urls` or `profileUrls` —
  // we pass both for compatibility.
  const body: any = {
    urls: profiles,
    profileUrls: profiles,
    resultsLimit: POSTS_PER_HANDLE,
    resultsPerPage: POSTS_PER_HANDLE,
    maxItems: POSTS_PER_HANDLE * handles.length,
  };

  const url = `https://api.apify.com/v2/acts/${DEFAULT_ACTOR}/run-sync-get-dataset-items?token=${apifyKey}&timeout=240`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(260_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Apify ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as ThreadsRaw[];
  return Array.isArray(data) ? data : [];
}

async function upsertPost(post: ThreadsRaw, source: TrackedSource): Promise<boolean> {
  const fallback = extractHandle(source.source_url) ?? '';
  const author = pickAuthor(post, fallback);
  const postUrl = pickUrl(post, author);
  if (!postUrl) return false;

  const text = post.text ?? post.caption ?? null;
  const likes = Number(post.likeCount ?? post.likes ?? 0);
  const reposts = Number(post.repostCount ?? post.reposts ?? 0);
  const replies = Number(post.replyCount ?? post.replies ?? 0);
  const views = post.viewCount != null || post.views != null
    ? Number(post.viewCount ?? post.views ?? 0)
    : null;

  try {
    await query(
      `INSERT INTO viral_threads_posts (
         source_id, url, author_handle, author_followers,
         text_content, media_urls, views, likes, reposts, replies,
         niche, posted_at, scraped_at, metadata
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13::jsonb)
       ON CONFLICT (url) DO UPDATE SET
         views = COALESCE(EXCLUDED.views, viral_threads_posts.views),
         likes = EXCLUDED.likes,
         reposts = EXCLUDED.reposts,
         replies = EXCLUDED.replies,
         scraped_at = NOW()`,
      [
        source.id,
        postUrl,
        author,
        Number(post.user?.follower_count ?? post.followerCount ?? 0) || null,
        text,
        pickMediaUrls(post),
        views,
        likes,
        reposts,
        replies,
        source.niche ?? null,
        pickPostedAt(post),
        JSON.stringify({ raw_id: post.id ?? post.pk ?? null, source_id: source.id }),
      ],
    );
    return true;
  } catch (err: any) {
    console.warn('[cron-threads] upsert failed:', err?.message);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  if (!assertCronAuth(req, res)) return;

  const t0 = Date.now();
  const dry = String(req.query.dry || '') === 'true';
  const enabled = process.env.RADAR_THREADS_CRON_ENABLED === '1';

  // Per-client mode: ?client_id=<uuid> — só fontes daquele client
  // Default (global): só fontes sem client_id setado
  const clientIdRaw = req.query.client_id;
  const clientId = Array.isArray(clientIdRaw) ? clientIdRaw[0] : clientIdRaw;
  const isPerClient = typeof clientId === 'string' && clientId.length > 0;

  let sources: TrackedSource[] = [];
  try {
    const baseSelect = `SELECT id, source_url, source_name, category, niche
         FROM viral_tracked_sources
        WHERE source_type = 'threads'
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
        ? `No active Threads sources for client ${clientId}`
        : 'No active global Threads sources in viral_tracked_sources',
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
      actor: DEFAULT_ACTOR,
      sources: sources.length,
      handles,
      apify_status: enabled ? 'would_call_apify' : 'disabled (set RADAR_THREADS_CRON_ENABLED=1)',
      duration_ms: Date.now() - t0,
    });
  }

  if (!enabled) {
    return res.status(200).json({
      ok: true,
      skipped: 'RADAR_THREADS_CRON_ENABLED not set — Apify calls disabled to avoid cost',
      sources: sources.length,
      handles,
      duration_ms: Date.now() - t0,
    });
  }

  const apifyKey = process.env.APIFY_API_KEY_THREADS || process.env.APIFY_API_KEY;
  if (!apifyKey) {
    return jsonError(res, 500, 'APIFY_API_KEY not configured');
  }

  const handleToSource = new Map<string, TrackedSource>();
  for (const s of sources) {
    const h = extractHandle(s.source_url);
    if (h) handleToSource.set(h, s);
  }

  let posts: ThreadsRaw[] = [];
  try {
    posts = await callApify(apifyKey, handles);
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: 'apify_failed',
      detail: err?.message || String(err),
      handles_attempted: handles.length,
      duration_ms: Date.now() - t0,
    });
  }

  let totalInserted = 0;
  for (const post of posts) {
    const author = pickAuthor(post, '').toLowerCase();
    const source = handleToSource.get(author) ?? sources[0];
    const ok = await upsertPost(post, source);
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
