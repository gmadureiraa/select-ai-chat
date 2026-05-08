// Cron handler: scrape LinkedIn posts into viral_linkedin_posts.
// Schedule (Pro plan): daily 11:45 UTC.
// Auth: x-vercel-cron OR Bearer $CRON_SECRET.
//
// Pipeline:
//  1. SELECT viral_tracked_sources where source_type='linkedin'
//  2. Two modes per source (auto-detected from source_url):
//     - Profile/Company URL  → apify/linkedin-profile-scraper or linkedin-companies-scraper
//     - "search:<query>"     → apify/linkedin-post-search
//  3. UPSERT in viral_linkedin_posts by post_id (urn)
//  4. UPDATE last_scraped_at
//
// ⚠️  LinkedIn detecta bots agressivamente. Esses scrapers falham mais que TikTok/IG.
//     Esperamos ~70% taxa de sucesso. Errors são logados mas não derrubam o cron.
//
// Set `RADAR_LINKEDIN_CRON_ENABLED=1` to enable Apify calls.
// Estimate cost: ~$0.05-0.10 per profile (LinkedIn scrapers cost more).

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

interface LinkedInPostRaw {
  urn?: string;
  postId?: string;
  id?: string;
  url?: string;
  postUrl?: string;
  text?: string;
  textContent?: string;
  description?: string;
  postType?: string;
  contentType?: string;
  author?: {
    name?: string;
    fullName?: string;
    publicIdentifier?: string;
    headline?: string;
    description?: string;
    followers?: number;
    followerCount?: number;
    [k: string]: unknown;
  };
  authorName?: string;
  authorHeadline?: string;
  authorFollowers?: number;
  reactions?: number;
  numReactions?: number;
  totalReactionCount?: number;
  likes?: number;
  numLikes?: number;
  comments?: number;
  numComments?: number;
  shares?: number;
  numShares?: number;
  numReposts?: number;
  reposts?: number;
  postedAt?: string;
  postedDate?: string;
  publishedAt?: string;
  timestamp?: string | number;
  images?: string[];
  imageUrls?: string[];
  videoUrl?: string;
  [k: string]: unknown;
}

const POSTS_PER_PROFILE = 10;
// Default actors. Override per-source kind via env.
const DEFAULT_PROFILE_ACTOR = process.env.APIFY_LINKEDIN_PROFILE_ACTOR || 'apify~linkedin-profile-scraper';
const DEFAULT_SEARCH_ACTOR  = process.env.APIFY_LINKEDIN_SEARCH_ACTOR  || 'apimaestro~linkedin-post-search-scraper';
const DEFAULT_COMPANY_ACTOR = process.env.APIFY_LINKEDIN_COMPANY_ACTOR || 'apify~linkedin-company-scraper';

type SourceKind = 'profile' | 'company' | 'search';

function classify(value: string): { kind: SourceKind; value: string } | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (v.toLowerCase().startsWith('search:')) {
    return { kind: 'search', value: v.slice(7).trim() };
  }
  if (/linkedin\.com\/company\//i.test(v)) return { kind: 'company', value: v };
  if (/linkedin\.com\/in\//i.test(v))      return { kind: 'profile', value: v };
  // Bare slug → assume profile
  return { kind: 'profile', value: `https://www.linkedin.com/in/${v.replace(/^@/, '')}/` };
}

function pickPostId(p: LinkedInPostRaw): string | null {
  return p.urn || p.postId || p.id || (p.url ? extractIdFromUrl(p.url) : null);
}

function extractIdFromUrl(url: string): string | null {
  const m = url.match(/(?:activity|ugcPost|share)[:_-]?(\d+)/i);
  return m?.[1] ?? null;
}

function pickAuthor(p: LinkedInPostRaw): {
  handle: string | null;
  name: string | null;
  headline: string | null;
  followers: number | null;
} {
  const handle = p.author?.publicIdentifier ?? null;
  const name = p.author?.fullName || p.author?.name || p.authorName || null;
  const headline = p.author?.headline || p.author?.description || p.authorHeadline || null;
  const followers = Number(p.author?.followerCount ?? p.author?.followers ?? p.authorFollowers ?? 0) || null;
  return { handle, name, headline, followers };
}

function pickPostType(p: LinkedInPostRaw): string {
  const t = (p.postType || p.contentType || '').toLowerCase();
  if (t) return t;
  if (p.videoUrl) return 'video';
  if (p.images?.length || p.imageUrls?.length) return 'image';
  return 'text';
}

function pickPostedAt(p: LinkedInPostRaw): string | null {
  const s = p.postedAt || p.postedDate || p.publishedAt || p.timestamp;
  if (!s) return null;
  try {
    if (typeof s === 'number') return new Date(s).toISOString();
    return new Date(s).toISOString();
  } catch {
    return null;
  }
}

function pickMedia(p: LinkedInPostRaw): string[] {
  const out: string[] = [];
  if (p.images) out.push(...p.images);
  if (p.imageUrls) out.push(...p.imageUrls);
  if (p.videoUrl) out.push(p.videoUrl);
  return out.filter(Boolean);
}

function pickReactions(p: LinkedInPostRaw): number {
  return Number(p.totalReactionCount ?? p.numReactions ?? p.reactions ?? p.numLikes ?? p.likes ?? 0);
}

async function callApifyActor(
  apifyKey: string,
  actorId: string,
  input: Record<string, unknown>,
): Promise<LinkedInPostRaw[]> {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyKey}&timeout=240`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(260_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Apify ${actorId} ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as LinkedInPostRaw[];
  return Array.isArray(data) ? data : [];
}

async function upsertPost(p: LinkedInPostRaw, source: TrackedSource): Promise<boolean> {
  const postId = pickPostId(p);
  if (!postId) return false;
  const url = p.url || p.postUrl;
  if (!url) return false;

  const author = pickAuthor(p);
  const reactions = pickReactions(p);

  try {
    await query(
      `INSERT INTO viral_linkedin_posts (
         source_id, post_id, url, author_handle, author_name,
         author_headline, author_followers, text_content, media_urls,
         post_type, reactions, likes, comments, shares,
         niche, posted_at, scraped_at, metadata
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),$17::jsonb)
       ON CONFLICT (post_id) DO UPDATE SET
         text_content = COALESCE(EXCLUDED.text_content, viral_linkedin_posts.text_content),
         reactions = EXCLUDED.reactions,
         likes = EXCLUDED.likes,
         comments = EXCLUDED.comments,
         shares = EXCLUDED.shares,
         scraped_at = NOW()`,
      [
        source.id,
        postId,
        url,
        author.handle,
        author.name,
        author.headline,
        author.followers,
        p.text ?? p.textContent ?? p.description ?? null,
        pickMedia(p),
        pickPostType(p),
        reactions,
        Number(p.numLikes ?? p.likes ?? 0),
        Number(p.numComments ?? p.comments ?? 0),
        Number(p.numShares ?? p.shares ?? p.numReposts ?? p.reposts ?? 0),
        source.niche ?? null,
        pickPostedAt(p),
        JSON.stringify({ source_id: source.id }),
      ],
    );
    return true;
  } catch (err: any) {
    console.warn('[cron-linkedin] upsert failed:', err?.message);
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
  const enabled = process.env.RADAR_LINKEDIN_CRON_ENABLED === '1';

  // Per-client mode: ?client_id=<uuid> — só fontes daquele client
  // Default (global): só fontes sem client_id setado
  const clientIdRaw = req.query.client_id;
  const clientId = Array.isArray(clientIdRaw) ? clientIdRaw[0] : clientIdRaw;
  const isPerClient = typeof clientId === 'string' && clientId.length > 0;

  let sources: TrackedSource[] = [];
  try {
    const baseSelect = `SELECT id, source_url, source_name, category, niche
         FROM viral_tracked_sources
        WHERE source_type = 'linkedin'
          AND COALESCE(is_active, true) = true`;

    if (isPerClient) {
      sources = await query<TrackedSource>(
        `${baseSelect}
          AND client_id = $1
        ORDER BY last_scraped_at NULLS FIRST
        LIMIT 20`,
        [clientId],
      );
    } else {
      sources = await query<TrackedSource>(
        `${baseSelect}
          AND client_id IS NULL
        ORDER BY last_scraped_at NULLS FIRST
        LIMIT 20`,
      );
    }
  } catch (err: any) {
    return jsonError(res, 500, 'Failed to query sources', { detail: err?.message });
  }

  if (sources.length === 0) {
    return res.status(200).json({
      ok: true,
      skipped: isPerClient
        ? `No active LinkedIn sources for client ${clientId}`
        : 'No active global LinkedIn sources in viral_tracked_sources',
      scope: isPerClient ? 'client' : 'global',
      client_id: isPerClient ? clientId : null,
      duration_ms: Date.now() - t0,
    });
  }

  const grouped: Record<SourceKind, Array<{ src: TrackedSource; value: string }>> = {
    profile: [],
    company: [],
    search: [],
  };
  for (const s of sources) {
    const c = classify(s.source_url);
    if (!c) continue;
    grouped[c.kind].push({ src: s, value: c.value });
  }

  if (dry) {
    return res.status(200).json({
      ok: true,
      dry: true,
      cron_enabled: enabled,
      actors: {
        profile: DEFAULT_PROFILE_ACTOR,
        company: DEFAULT_COMPANY_ACTOR,
        search: DEFAULT_SEARCH_ACTOR,
      },
      sources: sources.length,
      breakdown: {
        profiles: grouped.profile.map((g) => g.value),
        companies: grouped.company.map((g) => g.value),
        searches: grouped.search.map((g) => g.value),
      },
      apify_status: enabled ? 'would_call_apify' : 'disabled (set RADAR_LINKEDIN_CRON_ENABLED=1)',
      duration_ms: Date.now() - t0,
    });
  }

  if (!enabled) {
    return res.status(200).json({
      ok: true,
      skipped: 'RADAR_LINKEDIN_CRON_ENABLED not set — Apify calls disabled to avoid cost',
      sources: sources.length,
      duration_ms: Date.now() - t0,
    });
  }

  const apifyKey = process.env.APIFY_API_KEY_LINKEDIN || process.env.APIFY_API_KEY;
  if (!apifyKey) {
    return jsonError(res, 500, 'APIFY_API_KEY not configured');
  }

  const errors: Array<{ kind: string; detail: string }> = [];
  let totalInserted = 0;
  let totalReceived = 0;

  // PROFILES
  if (grouped.profile.length > 0) {
    try {
      const posts = await callApifyActor(apifyKey, DEFAULT_PROFILE_ACTOR, {
        urls: grouped.profile.map((g) => g.value),
        profileUrls: grouped.profile.map((g) => g.value),
        maxPosts: POSTS_PER_PROFILE,
        resultsLimit: POSTS_PER_PROFILE,
      });
      totalReceived += posts.length;
      // Match posts back to sources by URL prefix
      for (const p of posts) {
        const author = pickAuthor(p);
        const src = grouped.profile.find((g) => {
          if (!author.handle) return false;
          return g.value.toLowerCase().includes(author.handle.toLowerCase());
        })?.src ?? grouped.profile[0].src;
        if (await upsertPost(p, src)) totalInserted++;
      }
    } catch (e: any) {
      errors.push({ kind: 'profile', detail: e?.message?.slice(0, 200) ?? String(e) });
    }
  }

  // COMPANIES
  if (grouped.company.length > 0) {
    try {
      const posts = await callApifyActor(apifyKey, DEFAULT_COMPANY_ACTOR, {
        urls: grouped.company.map((g) => g.value),
        companyUrls: grouped.company.map((g) => g.value),
        maxPosts: POSTS_PER_PROFILE,
        resultsLimit: POSTS_PER_PROFILE,
      });
      totalReceived += posts.length;
      for (const p of posts) {
        const src = grouped.company[0].src;
        if (await upsertPost(p, src)) totalInserted++;
      }
    } catch (e: any) {
      errors.push({ kind: 'company', detail: e?.message?.slice(0, 200) ?? String(e) });
    }
  }

  // SEARCHES
  if (grouped.search.length > 0) {
    for (const g of grouped.search) {
      try {
        const posts = await callApifyActor(apifyKey, DEFAULT_SEARCH_ACTOR, {
          query: g.value,
          searchTerm: g.value,
          maxPosts: POSTS_PER_PROFILE * 2,
          resultsLimit: POSTS_PER_PROFILE * 2,
        });
        totalReceived += posts.length;
        for (const p of posts) {
          if (await upsertPost(p, g.src)) totalInserted++;
        }
      } catch (e: any) {
        errors.push({ kind: `search:${g.value}`, detail: e?.message?.slice(0, 200) ?? String(e) });
      }
    }
  }

  await query(
    `UPDATE viral_tracked_sources
        SET last_scraped_at = NOW()
      WHERE id = ANY($1::uuid[])`,
    [sources.map((s) => s.id)],
  ).catch(() => null);

  return res.status(200).json({
    ok: errors.length === 0,
    sources: sources.length,
    posts_received: totalReceived,
    inserted: totalInserted,
    errors,
    duration_ms: Date.now() - t0,
  });
}
