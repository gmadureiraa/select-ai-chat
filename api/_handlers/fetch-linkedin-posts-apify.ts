// Scrapes LinkedIn posts (personal profile or company) of a client via Apify
// and upserts into metricool_posts (network='linkedin').
// (nome da tabela é legado Metricool — schema mantido, conteúdo hoje vem de
// Late/Zernio ou scrape direto via Apify.)
//
// MOTIVAÇÃO (2026-05-16):
//   APIs de publisher (era Metricool, hoje Late/Zernio) NÃO retornam analytics
//   de posts de perfis LinkedIn pessoais (só Company Pages). Madureira e a
//   maioria dos creators usam perfil pessoal — então o dashboard Performance >
//   LinkedIn fica zerado sem este scrape.
//
//   Esta função faz o scrape via Apify (mesma estratégia do `cron-scrape-linkedin`
//   pra Radar, mas escrevendo numa tabela do CLIENTE em vez do Radar). O endpoint
//   é authedPost manual (não cron) — chamado pelo botão "Atualizar" do dashboard
//   ou pelo cron `cron-metricool-backfill-posts` (nome legado).
//
// INPUT:
//   { clientId: uuid, handle?: string }
//   - handle: ex "ogmadureira" ou "https://www.linkedin.com/in/og-madureira/"
//     Se omitido, busca em `client_social_credentials` (campo metadata.linkedin_handle).
//
// AUTH: authedPost — valida user.id × clientId via assertClientAccess.
//
// COST: ~$0.05-0.10 por scrape (Apify harvestapi~linkedin-profile-scraper).
// Rate limit defensivo: 1 scrape por client por 30min.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth, type AuthUser } from '../_lib/auth.js';
import { assertClientAccess } from '../_lib/access.js';
import { getPool, query } from '../_lib/db.js';

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
  authorName?: string;
  authorHeadline?: string;
  authorFollowers?: number;
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
  thumbnailUrl?: string;
  [k: string]: unknown;
}

const SCRAPE_COOLDOWN_MS = 30 * 60 * 1000; // 30min entre scrapes do mesmo cliente
const POSTS_PER_RUN = 30;

function cleanEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  return String(raw).replace(/\\n/g, '').trim() || null;
}

function detectTarget(input: string): { url: string; type: 'person' | 'company'; handle: string } {
  const cleaned = input.trim();
  const slug = cleaned.replace(/^@/, '').replace(/^https?:\/\/.+\/in\//, '').replace(/^https?:\/\/.+\/company\//, '').replace(/\/$/, '');
  let url = cleaned;
  if (!/^https?:\/\//i.test(cleaned)) {
    url = `https://www.linkedin.com/in/${cleaned.replace(/^@/, '')}`;
  }
  const type: 'person' | 'company' = /linkedin\.com\/(company|school)\//i.test(url) ? 'company' : 'person';
  return { url, type, handle: slug };
}

function pickId(p: LinkedInPostRaw): string | null {
  const raw = p.urn || p.postId || p.id;
  if (raw) return String(raw);
  if (p.url) {
    const m = p.url.match(/(?:activity|ugcPost|share)[:_-]?(\d+)/i);
    if (m?.[1]) return m[1];
  }
  return null;
}

function pickReactions(p: LinkedInPostRaw): number {
  return Number(p.totalReactionCount ?? p.numReactions ?? p.reactions ?? p.numLikes ?? p.likes ?? 0);
}

function pickPostType(p: LinkedInPostRaw): string {
  const t = (p.postType || p.contentType || '').toLowerCase();
  if (t) return t.toUpperCase();
  if (p.videoUrl) return 'VIDEO';
  if (p.images?.length || p.imageUrls?.length) return 'IMAGE';
  return 'TEXT';
}

function pickMedia(p: LinkedInPostRaw): string[] {
  const out: string[] = [];
  if (p.thumbnailUrl) out.push(p.thumbnailUrl);
  if (p.images) out.push(...p.images);
  if (p.imageUrls) out.push(...p.imageUrls);
  if (p.videoUrl) out.push(p.videoUrl);
  return Array.from(new Set(out.filter(Boolean)));
}

function pickThumbnail(p: LinkedInPostRaw): string | null {
  return (
    p.thumbnailUrl ||
    p.images?.[0] ||
    p.imageUrls?.[0] ||
    null
  );
}

function pickPostedAt(p: LinkedInPostRaw): string | null {
  const s = p.postedAt || p.postedDate || p.publishedAt || p.timestamp;
  if (!s) return null;
  try {
    return typeof s === 'number' ? new Date(s).toISOString() : new Date(s as string).toISOString();
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  // Auth
  let user: AuthUser | null = null;
  try {
    user = await tryAuth(req);
  } catch {
    // ignore — null user
  }
  if (!user) return jsonError(res, 401, 'Authentication required');

  const startedAt = Date.now();
  try {
    const body =
      req.body && typeof req.body === 'object'
        ? req.body
        : req.body
        ? JSON.parse(req.body as string)
        : {};
    const { clientId, handle: providedHandle, force } = body as {
      clientId?: string;
      handle?: string;
      force?: boolean;
    };
    if (!clientId) throw new Error('clientId is required');
    await assertClientAccess(user.id, clientId);

    // Cooldown check: evita scrape repetido em 30min
    if (!force) {
      const recent = await query<{ last_synced_at: string }>(
        `SELECT MAX(last_synced_at) AS last_synced_at
           FROM metricool_posts
          WHERE client_id = $1 AND network = 'linkedin'`,
        [clientId],
      );
      const last = recent[0]?.last_synced_at ? new Date(recent[0].last_synced_at).getTime() : 0;
      if (last && Date.now() - last < SCRAPE_COOLDOWN_MS) {
        return res.status(200).json({
          success: true,
          skipped: true,
          reason: 'cooldown',
          last_synced_at: recent[0].last_synced_at,
          next_available_in_ms: SCRAPE_COOLDOWN_MS - (Date.now() - last),
        });
      }
    }

    // Descobre handle: prioridade body > client_social_credentials.metadata.linkedin_handle
    let handle = providedHandle;
    if (!handle) {
      const cred = await query<{ metadata: any }>(
        `SELECT metadata FROM client_social_credentials
          WHERE client_id = $1
            AND (metadata->>'linkedin_handle' IS NOT NULL OR metadata->>'linkedinHandle' IS NOT NULL)
          LIMIT 1`,
        [clientId],
      );
      handle = cred[0]?.metadata?.linkedin_handle || cred[0]?.metadata?.linkedinHandle;
    }
    if (!handle) {
      throw new Error(
        'Handle LinkedIn não encontrado. Forneça `handle` no body ou configure metadata.linkedin_handle em client_social_credentials.',
      );
    }

    const apifyApiKey = cleanEnv('APIFY_API_KEY_LINKEDIN') || cleanEnv('APIFY_API_KEY') || cleanEnv('APIFY_API_TOKEN');
    if (!apifyApiKey) throw new Error('APIFY_API_KEY not configured');

    const { url, type } = detectTarget(handle);
    const actorId =
      type === 'company'
        ? cleanEnv('APIFY_LINKEDIN_COMPANY_ACTOR') || 'apify~linkedin-company-scraper'
        : cleanEnv('APIFY_LINKEDIN_PROFILE_ACTOR') || 'harvestapi~linkedin-profile-scraper';

    // harvestapi expects profileUrls (string[]); maxItems caps cost.
    const input: Record<string, unknown> =
      type === 'company'
        ? { urls: [url], companyUrls: [url], maxPosts: POSTS_PER_RUN }
        : { profileUrls: [url], urls: [url], maxItems: POSTS_PER_RUN, maxPosts: POSTS_PER_RUN };

    console.log(`[fetch-linkedin-posts-apify] client=${clientId} ${type}: ${url} actor=${actorId}`);

    const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyApiKey}&timeout=240`;
    const apifyResponse = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(260_000),
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('[fetch-linkedin-posts-apify] apify error:', apifyResponse.status, errorText.slice(0, 300));
      // Apify 403 com "hard limit exceeded" = plano mensal Apify estourou (~$10/mo).
      // Apify 429 = rate limit por segundo. 402 = payment required.
      if (
        apifyResponse.status === 429 ||
        apifyResponse.status === 402 ||
        /hard limit exceeded|monthly usage/i.test(errorText)
      ) {
        return res.status(200).json({
          success: false,
          error: 'apify_quota_exceeded',
          message:
            'Limite mensal do Apify atingido. Pra continuar puxando posts do LinkedIn, ' +
            'aumente o plano Apify ou aguarde renovação. Posts existentes seguem disponíveis.',
          status: apifyResponse.status,
          retryable: true,
          retry_after_hint: 'next_month_or_upgrade',
        });
      }
      throw new Error(`Apify ${apifyResponse.status}: ${errorText.slice(0, 200)}`);
    }

    const items = (await apifyResponse.json()) as LinkedInPostRaw[];
    if (!Array.isArray(items)) {
      throw new Error('Apify response não é array');
    }

    // Detect Apify actor returning a profile envelope (harvestapi returns posts INSIDE profile object)
    const flatPosts: LinkedInPostRaw[] = [];
    for (const item of items) {
      if (item && typeof item === 'object') {
        // harvestapi-style: { posts: [...] } or { activity: [...] }
        const nested = (item as any).posts || (item as any).activity || (item as any).updates;
        if (Array.isArray(nested)) {
          flatPosts.push(...nested);
        } else if ((item as any).urn || (item as any).text || (item as any).id) {
          flatPosts.push(item);
        }
      }
    }

    const pool = getPool();
    let upserts = 0;
    let skipped = 0;
    const blogIdRow = await query<{ blog_id: string }>(
      `SELECT metadata->>'metricool_blog_id' AS blog_id
         FROM client_social_credentials
        WHERE client_id = $1 AND metadata->>'metricool_blog_id' IS NOT NULL
        LIMIT 1`,
      [clientId],
    );
    const blogId = blogIdRow[0]?.blog_id || null;

    for (const post of flatPosts) {
      const rawPostId = pickId(post);
      if (!rawPostId) {
        skipped++;
        continue;
      }
      const postId = `linkedin:${rawPostId}`;
      const text = post.text || post.textContent || post.description || null;
      const reactions = pickReactions(post);
      const comments = Number(post.numComments ?? post.comments ?? 0);
      const shares = Number(post.numShares ?? post.shares ?? post.numReposts ?? post.reposts ?? 0);
      const url = post.url || post.postUrl || null;
      const postedAt = pickPostedAt(post);
      const thumbnail = pickThumbnail(post);
      const mediaUrls = pickMedia(post);
      const postType = pickPostType(post);

      try {
        await pool.query(
          `INSERT INTO metricool_posts
            (client_id, blog_id, network, post_id, post_type, url, caption,
             thumbnail_url, media_urls, published_at,
             likes, comments, shares, saves, reach, impressions, views,
             video_views, engagement_rate, raw_data,
             first_seen_at, last_synced_at)
           VALUES ($1, $2, 'linkedin', $3, $4, $5, $6, $7, $8::jsonb, $9,
                   $10, $11, $12, 0, 0, 0, 0, 0, NULL, $13::jsonb,
                   NOW(), NOW())
           ON CONFLICT (client_id, network, post_id) DO UPDATE SET
             post_type = COALESCE(EXCLUDED.post_type, metricool_posts.post_type),
             url = COALESCE(EXCLUDED.url, metricool_posts.url),
             caption = COALESCE(EXCLUDED.caption, metricool_posts.caption),
             thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, metricool_posts.thumbnail_url),
             media_urls = EXCLUDED.media_urls,
             published_at = COALESCE(EXCLUDED.published_at, metricool_posts.published_at),
             likes = EXCLUDED.likes,
             comments = EXCLUDED.comments,
             shares = EXCLUDED.shares,
             raw_data = EXCLUDED.raw_data,
             last_synced_at = NOW()`,
          [
            clientId,
            blogId,
            postId,
            postType,
            url,
            text,
            thumbnail,
            JSON.stringify(mediaUrls),
            postedAt,
            reactions,
            comments,
            shares,
            JSON.stringify(post),
          ],
        );
        upserts++;
      } catch (err: any) {
        console.warn(`[fetch-linkedin-posts-apify] upsert ${postId} failed:`, err?.message);
      }
    }

    return res.status(200).json({
      success: true,
      duration_ms: Date.now() - startedAt,
      received: flatPosts.length,
      upserted: upserts,
      skipped,
      actor: actorId,
      handle,
      type,
      estimated_cost_usd: 0.05,
    });
  } catch (err: any) {
    console.error('[fetch-linkedin-posts-apify] error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      duration_ms: Date.now() - startedAt,
    });
  }
}
