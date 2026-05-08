// Cron handler: scrape X/Twitter profiles & queries into viral_twitter_posts.
// Schedule (Pro plan): daily 11:15 UTC.
// Auth: x-vercel-cron OR Bearer $CRON_SECRET.
//
// Pipeline:
//  1. SELECT viral_tracked_sources with source_type='twitter'
//  2. Group handles into one Apify call (xtdata/twitter-x-scraper — same actor
//     used by fetch-twitter-apify). source_url can be a profile URL/handle OR
//     a search query (recognized by leading "search:" prefix in URL).
//  3. Detect threads (multi-tweet by same author within 30min of original) —
//     stored on metadata.thread_tweets JSONB.
//  4. UPSERT in viral_twitter_posts by tweet_id.
//
// Set `RADAR_TWITTER_CRON_ENABLED=1` to enable Apify calls (~$0.02/run).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { query } from '../_lib/db.js';

interface TrackedSource {
  id: string;
  source_url: string;
  source_name: string | null;
  category: string | null;
  niche: string | null;
}

interface TweetRaw {
  id?: string;
  id_str?: string;
  tweetId?: string;
  url?: string;
  full_text?: string;
  text?: string;
  content?: string;
  created_at?: string;
  createdAt?: string;
  date?: string;
  user?: {
    screen_name?: string;
    name?: string;
    followers_count?: number;
    verified?: boolean;
    [k: string]: unknown;
  };
  author?: {
    userName?: string;
    handle?: string;
    name?: string;
    followersCount?: number;
    isVerified?: boolean;
    [k: string]: unknown;
  };
  conversation_id?: string;
  in_reply_to_status_id_str?: string | null;
  favorite_count?: number;
  likeCount?: number;
  likes?: number;
  retweet_count?: number;
  retweetCount?: number;
  retweets?: number;
  reply_count?: number;
  replyCount?: number;
  replies?: number;
  view_count?: number;
  viewCount?: number;
  views?: number;
  bookmark_count?: number;
  bookmarkCount?: number;
  bookmarks?: number;
  entities?: { media?: Array<{ media_url_https?: string }> };
  media?: Array<{ media_url_https?: string; url?: string; preview_image_url?: string }>;
  [k: string]: unknown;
}

const TWEETS_PER_HANDLE = 20;
const ACTOR_ID = process.env.APIFY_TWITTER_ACTOR || 'xtdata~twitter-x-scraper';

function parseCount(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/,/g, '');
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}

function extractHandleOrQuery(value: string): { kind: 'handle' | 'query'; value: string } | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  // search: prefix → treat as query
  if (v.toLowerCase().startsWith('search:')) {
    return { kind: 'query', value: v.slice(7).trim() };
  }
  // URL with /search? → query
  if (/x\.com\/search|twitter\.com\/search/i.test(v)) {
    const u = new URL(v);
    return { kind: 'query', value: u.searchParams.get('q') ?? '' };
  }
  // Standard profile URL or @handle
  const urlMatch = v.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]+)/i);
  if (urlMatch) return { kind: 'handle', value: urlMatch[1] };
  return { kind: 'handle', value: v.replace(/^@/, '') };
}

function tweetMedia(t: TweetRaw): string[] {
  const out: string[] = [];
  if (t.entities?.media) for (const m of t.entities.media) if (m.media_url_https) out.push(m.media_url_https);
  if (Array.isArray(t.media)) {
    for (const m of t.media) {
      const url = m.media_url_https || m.url || m.preview_image_url;
      if (url) out.push(url);
    }
  }
  return out;
}

function pickAuthor(t: TweetRaw): {
  handle: string;
  name: string | null;
  followers: number | null;
  verified: boolean;
} {
  const handle =
    t.user?.screen_name ||
    t.author?.userName ||
    t.author?.handle ||
    '';
  const name = t.user?.name || t.author?.name || null;
  const followers =
    Number(t.user?.followers_count ?? t.author?.followersCount ?? 0) || null;
  const verified = Boolean(t.user?.verified ?? t.author?.isVerified ?? false);
  return { handle, name, followers, verified };
}

function pickTweetId(t: TweetRaw): string | null {
  let tweetId = t.id_str || t.id || t.tweetId || '';
  if (!tweetId && t.url) {
    const m = String(t.url).match(/status\/(\d+)/);
    if (m) tweetId = m[1];
  }
  return tweetId ? String(tweetId) : null;
}

function pickPostedAt(t: TweetRaw): string | null {
  const s = t.created_at || t.createdAt || t.date;
  if (!s) return null;
  try { return new Date(s).toISOString(); } catch { return null; }
}

async function callApify(apifyKey: string, handles: string[], queries: string[]): Promise<TweetRaw[]> {
  const startUrl = `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${apifyKey}`;
  const input: any = { sort: 'Latest', maxItems: TWEETS_PER_HANDLE * Math.max(1, handles.length + queries.length) };
  if (handles.length > 0) input.twitterHandles = handles;
  if (queries.length > 0) input.searchTerms = queries;

  const sr = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!sr.ok) {
    const text = await sr.text().catch(() => '');
    throw new Error(`Apify start ${sr.status}: ${text.slice(0, 200)}`);
  }
  const runData = await sr.json();
  const runId = runData.data?.id;
  const datasetId = runData.data?.defaultDatasetId;
  let status = runData.data?.status;

  const maxWaitMs = 220_000;
  const startTime = Date.now();
  while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED' && status !== 'TIMED-OUT') {
    if (Date.now() - startTime > maxWaitMs) throw new Error('Twitter scrape timed out');
    await new Promise((r) => setTimeout(r, 5000));
    const sr2 = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyKey}`);
    const sd = await sr2.json();
    status = sd.data?.status;
  }
  if (status !== 'SUCCEEDED') throw new Error(`Apify run ${status}`);

  const dr = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyKey}`);
  const items = (await dr.json()) as TweetRaw[];
  return Array.isArray(items) ? items : [];
}

function detectThreads(tweets: TweetRaw[]): Map<string, TweetRaw[]> {
  // Group tweets by conversation_id where original author posts >1 tweet.
  const byConv = new Map<string, TweetRaw[]>();
  for (const t of tweets) {
    const conv = t.conversation_id || pickTweetId(t);
    if (!conv) continue;
    if (!byConv.has(conv)) byConv.set(conv, []);
    byConv.get(conv)!.push(t);
  }
  // Filter convs with 2+ tweets by SAME author
  const threads = new Map<string, TweetRaw[]>();
  for (const [conv, items] of byConv.entries()) {
    if (items.length < 2) continue;
    const firstAuthor = pickAuthor(items[0]).handle.toLowerCase();
    const sameAuthor = items.filter((t) => pickAuthor(t).handle.toLowerCase() === firstAuthor);
    if (sameAuthor.length < 2) continue;
    threads.set(conv, sameAuthor.sort((a, b) => {
      const ta = Date.parse(pickPostedAt(a) ?? '0');
      const tb = Date.parse(pickPostedAt(b) ?? '0');
      return ta - tb;
    }));
  }
  return threads;
}

async function upsertTweet(
  t: TweetRaw,
  source: TrackedSource,
  threadTweets: TweetRaw[] | null,
): Promise<boolean> {
  const tweetId = pickTweetId(t);
  if (!tweetId) return false;
  const author = pickAuthor(t);
  const url = t.url || `https://x.com/${author.handle}/status/${tweetId}`;
  const text = t.full_text || t.text || t.content || null;

  const likes = parseCount(t.favorite_count ?? t.likeCount ?? t.likes ?? 0);
  const retweets = parseCount(t.retweet_count ?? t.retweetCount ?? t.retweets ?? 0);
  const replies = parseCount(t.reply_count ?? t.replyCount ?? t.replies ?? 0);
  const views = parseCount(t.view_count ?? t.viewCount ?? t.views ?? 0);
  const bookmarks = parseCount(t.bookmark_count ?? t.bookmarkCount ?? t.bookmarks ?? 0);

  const isThread = !!threadTweets && threadTweets.length > 1;
  const threadJson = isThread
    ? threadTweets!.map((x) => ({
        id: pickTweetId(x),
        text: x.full_text ?? x.text ?? x.content ?? '',
        media_urls: tweetMedia(x),
        posted_at: pickPostedAt(x),
      }))
    : [];

  try {
    await query(
      `INSERT INTO viral_twitter_posts (
         source_id, tweet_id, url, author_handle, author_name,
         author_followers, author_verified, text_content, media_urls,
         is_thread, thread_tweets,
         views, likes, retweets, replies, bookmarks,
         niche, posted_at, scraped_at, metadata
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,NOW(),$19::jsonb)
       ON CONFLICT (tweet_id) DO UPDATE SET
         text_content = COALESCE(EXCLUDED.text_content, viral_twitter_posts.text_content),
         views = EXCLUDED.views,
         likes = EXCLUDED.likes,
         retweets = EXCLUDED.retweets,
         replies = EXCLUDED.replies,
         bookmarks = EXCLUDED.bookmarks,
         is_thread = EXCLUDED.is_thread,
         thread_tweets = CASE
           WHEN EXCLUDED.is_thread THEN EXCLUDED.thread_tweets
           ELSE viral_twitter_posts.thread_tweets
         END,
         scraped_at = NOW()`,
      [
        source.id,
        tweetId,
        url,
        author.handle,
        author.name,
        author.followers,
        author.verified,
        text,
        tweetMedia(t),
        isThread,
        JSON.stringify(threadJson),
        views,
        likes,
        retweets,
        replies,
        bookmarks,
        source.niche ?? null,
        pickPostedAt(t),
        JSON.stringify({ source_id: source.id, conversation_id: t.conversation_id ?? null }),
      ],
    );
    return true;
  } catch (err: any) {
    console.warn('[cron-twitter] upsert failed:', err?.message);
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
  const enabled = process.env.RADAR_TWITTER_CRON_ENABLED === '1';

  // Per-client mode: ?client_id=<uuid> — só fontes daquele client
  // Default (global): só fontes sem client_id setado
  const clientIdRaw = req.query.client_id;
  const clientId = Array.isArray(clientIdRaw) ? clientIdRaw[0] : clientIdRaw;
  const isPerClient = typeof clientId === 'string' && clientId.length > 0;

  let sources: TrackedSource[] = [];
  try {
    const baseSelect = `SELECT id, source_url, source_name, category, niche
         FROM viral_tracked_sources
        WHERE source_type = 'twitter'
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
        ? `No active Twitter sources for client ${clientId}`
        : 'No active global Twitter sources in viral_tracked_sources',
      scope: isPerClient ? 'client' : 'global',
      client_id: isPerClient ? clientId : null,
      duration_ms: Date.now() - t0,
    });
  }

  const handles: string[] = [];
  const queries: string[] = [];
  const handleToSource = new Map<string, TrackedSource>();
  const querySources: TrackedSource[] = [];

  for (const s of sources) {
    const parsed = extractHandleOrQuery(s.source_url);
    if (!parsed) continue;
    if (parsed.kind === 'handle') {
      handles.push(parsed.value);
      handleToSource.set(parsed.value.toLowerCase(), s);
    } else {
      queries.push(parsed.value);
      querySources.push(s);
    }
  }

  if (dry) {
    return res.status(200).json({
      ok: true,
      dry: true,
      cron_enabled: enabled,
      actor: ACTOR_ID,
      sources: sources.length,
      handles,
      queries,
      apify_status: enabled ? 'would_call_apify' : 'disabled (set RADAR_TWITTER_CRON_ENABLED=1)',
      duration_ms: Date.now() - t0,
    });
  }

  if (!enabled) {
    return res.status(200).json({
      ok: true,
      skipped: 'RADAR_TWITTER_CRON_ENABLED not set — Apify calls disabled to avoid cost',
      sources: sources.length,
      handles,
      queries,
      duration_ms: Date.now() - t0,
    });
  }

  const apifyKey = process.env.APIFY_API_KEY_TWITTER || process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY;
  if (!apifyKey) {
    return jsonError(res, 500, 'APIFY_API_KEY not configured');
  }

  let tweets: TweetRaw[] = [];
  try {
    tweets = await callApify(apifyKey, handles, queries);
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: 'apify_failed',
      detail: err?.message || String(err),
      duration_ms: Date.now() - t0,
    });
  }

  // Detect threads (group by conversation_id)
  const threadMap = detectThreads(tweets);
  // Map "source" per tweet by author OR fall back to first query source.
  let totalInserted = 0;
  for (const t of tweets) {
    const author = pickAuthor(t).handle.toLowerCase();
    const src = handleToSource.get(author) ?? querySources[0] ?? sources[0];
    const conv = t.conversation_id || pickTweetId(t) || '';
    const threadTweets = threadMap.get(conv) ?? null;
    // Only persist the FIRST tweet of a thread as the canonical row,
    // with all sibling tweets in thread_tweets[].
    if (threadTweets && pickTweetId(t) !== pickTweetId(threadTweets[0])) {
      continue;
    }
    const ok = await upsertTweet(t, src, threadTweets);
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
    queries: queries.length,
    tweets_received: tweets.length,
    threads_detected: threadMap.size,
    inserted: totalInserted,
    duration_ms: Date.now() - t0,
  });
}
