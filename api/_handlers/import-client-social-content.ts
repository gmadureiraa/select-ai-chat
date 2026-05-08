// Importa últimos posts dos perfis sociais do cliente (handles cadastrados)
// e salva em `client_content_library` com content_type apropriado.
//
// Plataformas suportadas (MVP):
//   - instagram → apify~instagram-scraper (resultsType=posts, top 30)
//   - tiktok    → clockworks~tiktok-scraper
//   - twitter   → apify~twitter-scraper (alt: apidojo~twitter-scraper-lite)
//   - threads   → curious_coder~threads-scraper
//   - linkedin  → harvestapi~linkedin-profile-scraper (apenas perfis)
//
// Estratégia:
//   1. Resolve handles do cliente (clients.social_media JSON ou query separada).
//   2. Pra cada plataforma com handle, dispara scrape Apify (run-sync, timeout 240s).
//   3. Mapeia cada post → row em client_content_library:
//        - title    = caption truncado a 120 chars (ou type+date)
//        - content  = caption full (texto pra embeddings + busca)
//        - content_type = enum da plataforma (instagram_post / tweet / etc)
//        - content_url = permalink
//        - thumbnail_url = display/thumbnail URL
//        - metadata = { platform, handle, posted_at, metrics, raw }
//        - engagement_score = calculado de likes+comments+shares (normalizado)
//   4. INSERT idempotente via ON CONFLICT (client_id, content_url) DO NOTHING.
//   5. Retorna contagem por plataforma e total inserido.
//
// Auth: JWT (workspace member do cliente OU super_admin).
// Errors: nunca derruba o handler — cada plataforma falha independente,
// erros vão pro array `errors` no response.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool, query, queryOne } from '../_lib/db.js';

const APIFY_BASE = 'https://api.apify.com/v2';

const PlatformEnum = z.enum([
  'instagram',
  'tiktok',
  'twitter',
  'threads',
  'linkedin',
]);
type Platform = z.infer<typeof PlatformEnum>;

const BodySchema = z.object({
  clientId: z.string().uuid(),
  platforms: z.array(PlatformEnum).min(1).optional(),
  postsPerPlatform: z.number().int().min(1).max(60).optional(),
});

interface PlatformResult {
  platform: Platform;
  handle: string | null;
  scraped: number;
  inserted: number;
  skipped: number;
  error?: string;
}

interface NormalizedPost {
  permalink: string;
  caption: string;
  content_type: string;
  thumbnail_url: string | null;
  posted_at: string | null;
  metrics: {
    likes: number | null;
    comments: number | null;
    views: number | null;
    shares: number | null;
  };
  raw: Record<string, unknown>;
}

const POSTS_DEFAULT = 30;
const APIFY_TIMEOUT_SEC = 240;

function buildEngagementScore(m: NormalizedPost['metrics']): number {
  const l = m.likes ?? 0;
  const c = m.comments ?? 0;
  const s = m.shares ?? 0;
  const v = m.views ?? 0;
  // Pesos: comments > shares > likes > views (ordem de intensidade do sinal).
  return c * 5 + s * 3 + l + v * 0.001;
}

async function fetchClientHandles(
  clientId: string,
): Promise<Record<Platform, string | null>> {
  const row = await queryOne<{ social_media: Record<string, string> | null }>(
    `SELECT social_media FROM clients WHERE id = $1`,
    [clientId],
  );
  const sm = row?.social_media ?? {};
  function normHandle(v: string | null | undefined): string | null {
    if (!v) return null;
    const trimmed = v.trim().replace(/^@/, '');
    if (!trimmed) return null;
    return trimmed;
  }
  return {
    instagram: normHandle(sm.instagram ?? sm.instagram_handle),
    tiktok: normHandle(sm.tiktok ?? sm.tiktok_handle),
    twitter: normHandle(sm.twitter ?? sm.twitter_handle ?? sm.x ?? sm.x_handle),
    threads: normHandle(sm.threads ?? sm.threads_handle),
    linkedin: normHandle(sm.linkedin ?? sm.linkedin_handle ?? sm.linkedin_url),
  };
}

async function scrapeInstagram(handle: string, limit: number): Promise<NormalizedPost[]> {
  const apifyKey = process.env.APIFY_API_KEY_INSTAGRAM || process.env.APIFY_API_KEY;
  if (!apifyKey) throw new Error('APIFY_API_KEY missing');
  const url = `${APIFY_BASE}/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=${APIFY_TIMEOUT_SEC}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directUrls: [`https://www.instagram.com/${handle}/`],
      resultsType: 'posts',
      resultsLimit: limit,
    }),
  });
  if (!res.ok) {
    throw new Error(`Apify Instagram ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const items = (await res.json()) as any[];
  return items.map((p) => {
    const isReel = String(p.type ?? p.productType ?? '').toLowerCase().includes('reel') ||
      String(p.url ?? p.permalink ?? '').includes('/reel/');
    return {
      permalink: p.url ?? p.permalink ?? `https://www.instagram.com/p/${p.shortCode ?? ''}/`,
      caption: p.caption ?? p.text ?? '',
      content_type: isReel ? 'reel_script' : 'instagram_post',
      thumbnail_url: p.displayUrl ?? p.thumbnailUrl ?? p.thumbnail ?? null,
      posted_at: p.timestamp ?? p.takenAt ?? null,
      metrics: {
        likes: p.likesCount ?? null,
        comments: p.commentsCount ?? null,
        views: p.videoViewCount ?? p.videoPlayCount ?? null,
        shares: null,
      },
      raw: p,
    } satisfies NormalizedPost;
  });
}

async function scrapeTikTok(handle: string, limit: number): Promise<NormalizedPost[]> {
  const apifyKey = process.env.APIFY_API_KEY_TIKTOK || process.env.APIFY_API_KEY;
  if (!apifyKey) throw new Error('APIFY_API_KEY missing');
  const url = `${APIFY_BASE}/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${apifyKey}&timeout=${APIFY_TIMEOUT_SEC}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profiles: [handle],
      resultsPerPage: limit,
      shouldDownloadCovers: false,
      shouldDownloadVideos: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Apify TikTok ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const items = (await res.json()) as any[];
  return items.map((p) => ({
    permalink:
      p.webVideoUrl ??
      `https://www.tiktok.com/@${p.authorMeta?.name ?? handle}/video/${p.id ?? ''}`,
    caption: p.text ?? p.desc ?? '',
    content_type: 'short_video',
    thumbnail_url: p.videoMeta?.coverUrl ?? p.covers?.[0] ?? null,
    posted_at: p.createTimeISO ?? (p.createTime ? new Date(p.createTime * 1000).toISOString() : null),
    metrics: {
      likes: p.diggCount ?? null,
      comments: p.commentCount ?? null,
      views: p.playCount ?? null,
      shares: p.shareCount ?? null,
    },
    raw: p,
  }));
}

async function scrapeTwitter(handle: string, limit: number): Promise<NormalizedPost[]> {
  const apifyKey = process.env.APIFY_API_KEY_TWITTER || process.env.APIFY_API_KEY;
  if (!apifyKey) throw new Error('APIFY_API_KEY missing');
  const actor = process.env.APIFY_TWITTER_ACTOR || 'apidojo~twitter-scraper-lite';
  const url = `${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?token=${apifyKey}&timeout=${APIFY_TIMEOUT_SEC}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      twitterHandles: [handle],
      maxItems: limit,
      tweetLanguage: 'pt',
    }),
  });
  if (!res.ok) {
    throw new Error(`Apify Twitter ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const items = (await res.json()) as any[];
  return items.map((p) => ({
    permalink: p.url ?? p.tweetUrl ?? `https://twitter.com/${p.author?.userName ?? handle}/status/${p.id ?? ''}`,
    caption: p.text ?? p.fullText ?? '',
    content_type: p.isThread || (p.replyCount > 0 && p.author?.userName === handle) ? 'thread' : 'tweet',
    thumbnail_url: p.media?.[0]?.media_url_https ?? p.media?.[0]?.url ?? null,
    posted_at: p.createdAt ?? p.created_at ?? null,
    metrics: {
      likes: p.likeCount ?? p.favorite_count ?? null,
      comments: p.replyCount ?? p.reply_count ?? null,
      views: p.viewCount ?? p.views_count ?? null,
      shares: p.retweetCount ?? p.retweet_count ?? null,
    },
    raw: p,
  }));
}

async function scrapeThreads(handle: string, limit: number): Promise<NormalizedPost[]> {
  const apifyKey = process.env.APIFY_API_KEY_THREADS || process.env.APIFY_API_KEY;
  if (!apifyKey) throw new Error('APIFY_API_KEY missing');
  const actor = process.env.APIFY_THREADS_ACTOR || 'curious_coder~threads-scraper';
  const url = `${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?token=${apifyKey}&timeout=${APIFY_TIMEOUT_SEC}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profiles: [handle],
      maxItems: limit,
    }),
  });
  if (!res.ok) {
    throw new Error(`Apify Threads ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const items = (await res.json()) as any[];
  return items.map((p) => ({
    permalink: p.url ?? p.permalink ?? `https://www.threads.net/@${handle}/post/${p.id ?? ''}`,
    caption: p.text ?? p.caption ?? '',
    content_type: 'social_post',
    thumbnail_url: p.imageUrl ?? p.media?.[0]?.url ?? null,
    posted_at: p.publishedAt ?? p.timestamp ?? null,
    metrics: {
      likes: p.likeCount ?? null,
      comments: p.replyCount ?? null,
      views: null,
      shares: p.repostCount ?? null,
    },
    raw: p,
  }));
}

async function scrapeLinkedIn(handle: string, limit: number): Promise<NormalizedPost[]> {
  const apifyKey = process.env.APIFY_API_KEY_LINKEDIN || process.env.APIFY_API_KEY;
  if (!apifyKey) throw new Error('APIFY_API_KEY missing');
  const actor =
    process.env.APIFY_LINKEDIN_PROFILE_ACTOR || 'harvestapi~linkedin-profile-scraper';
  const profileUrl = handle.startsWith('http')
    ? handle
    : `https://www.linkedin.com/in/${handle}/`;
  const url = `${APIFY_BASE}/acts/${actor}/run-sync-get-dataset-items?token=${apifyKey}&timeout=${APIFY_TIMEOUT_SEC}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profileUrls: [profileUrl],
      maxPosts: limit,
    }),
  });
  if (!res.ok) {
    throw new Error(`Apify LinkedIn ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const items = (await res.json()) as any[];
  // LinkedIn scraper geralmente retorna o profile + posts aninhados
  const posts: any[] = [];
  for (const it of items) {
    if (Array.isArray(it.posts)) posts.push(...it.posts);
    else if (Array.isArray(it.activities)) posts.push(...it.activities);
    else if (it.text || it.commentary) posts.push(it);
  }
  return posts.slice(0, limit).map((p) => ({
    permalink: p.url ?? p.permalink ?? p.activityUrl ?? '',
    caption: p.text ?? p.commentary ?? p.content ?? '',
    content_type: 'linkedin_post',
    thumbnail_url: p.media?.[0]?.url ?? p.thumbnailUrl ?? null,
    posted_at: p.publishedAt ?? p.postedAt ?? null,
    metrics: {
      likes: p.numLikes ?? p.likes ?? null,
      comments: p.numComments ?? p.comments ?? null,
      views: p.numViews ?? null,
      shares: p.numShares ?? p.shares ?? null,
    },
    raw: p,
  }));
}

const SCRAPERS: Record<Platform, (h: string, l: number) => Promise<NormalizedPost[]>> = {
  instagram: scrapeInstagram,
  tiktok: scrapeTikTok,
  twitter: scrapeTwitter,
  threads: scrapeThreads,
  linkedin: scrapeLinkedIn,
};

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const { clientId, postsPerPlatform = POSTS_DEFAULT } = parsed.data;

  // Verifica acesso (workspace member OU super_admin)
  const access = await queryOne<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM clients c
       JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
       WHERE c.id = $1 AND wm.user_id = $2
     ) OR EXISTS (
       SELECT 1 FROM super_admins sa WHERE sa.user_id = $2
     ) AS ok`,
    [clientId, user.id],
  );
  if (!access?.ok) {
    throw new Error('forbidden: cliente não pertence ao seu workspace');
  }

  const handles = await fetchClientHandles(clientId);
  const requested =
    parsed.data.platforms ??
    (Object.entries(handles)
      .filter(([, h]) => !!h)
      .map(([p]) => p) as Platform[]);

  const results: PlatformResult[] = [];
  const pool = getPool();

  for (const platform of requested) {
    const handle = handles[platform];
    if (!handle) {
      results.push({ platform, handle: null, scraped: 0, inserted: 0, skipped: 0, error: 'no_handle' });
      continue;
    }
    try {
      const posts = await SCRAPERS[platform](handle, postsPerPlatform);
      let inserted = 0;
      let skipped = 0;
      for (const p of posts) {
        if (!p.permalink) {
          skipped++;
          continue;
        }
        const title = (p.caption || `${platform} post`).slice(0, 120).replace(/\s+/g, ' ').trim();
        const content = p.caption || '';
        const score = buildEngagementScore(p.metrics);
        try {
          const r = await pool.query(
            `INSERT INTO client_content_library
               (client_id, title, content_type, content, thumbnail_url, content_url, metadata, engagement_score)
             VALUES ($1, $2, $3::content_type, $4, $5, $6, $7::jsonb, $8)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [
              clientId,
              title || `${platform} post`,
              p.content_type,
              content,
              p.thumbnail_url,
              p.permalink,
              JSON.stringify({
                platform,
                handle,
                posted_at: p.posted_at,
                metrics: p.metrics,
                imported_at: new Date().toISOString(),
              }),
              score,
            ],
          );
          if (r.rowCount && r.rowCount > 0) inserted++;
          else skipped++;
        } catch (insErr: any) {
          // Fallback: tenta sem engagement_score (caso schema antigo)
          if (String(insErr?.message ?? '').toLowerCase().includes('engagement_score')) {
            try {
              const r2 = await pool.query(
                `INSERT INTO client_content_library
                   (client_id, title, content_type, content, thumbnail_url, content_url, metadata)
                 VALUES ($1, $2, $3::content_type, $4, $5, $6, $7::jsonb)
                 ON CONFLICT DO NOTHING
                 RETURNING id`,
                [
                  clientId,
                  title || `${platform} post`,
                  p.content_type,
                  content,
                  p.thumbnail_url,
                  p.permalink,
                  JSON.stringify({
                    platform,
                    handle,
                    posted_at: p.posted_at,
                    metrics: p.metrics,
                    imported_at: new Date().toISOString(),
                  }),
                ],
              );
              if (r2.rowCount && r2.rowCount > 0) inserted++;
              else skipped++;
            } catch {
              skipped++;
            }
          } else {
            skipped++;
            console.warn(`[import-client-social] insert failed:`, insErr?.message);
          }
        }
      }
      results.push({ platform, handle, scraped: posts.length, inserted, skipped });
    } catch (err: any) {
      console.error(`[import-client-social] ${platform} failed:`, err?.message);
      results.push({
        platform,
        handle,
        scraped: 0,
        inserted: 0,
        skipped: 0,
        error: err?.message ?? 'unknown',
      });
    }
  }

  const totals = results.reduce(
    (acc, r) => ({
      scraped: acc.scraped + r.scraped,
      inserted: acc.inserted + r.inserted,
      skipped: acc.skipped + r.skipped,
    }),
    { scraped: 0, inserted: 0, skipped: 0 },
  );

  return {
    ok: true,
    clientId,
    totals,
    results,
  };
});
