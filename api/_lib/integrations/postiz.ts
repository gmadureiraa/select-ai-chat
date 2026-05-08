// Postiz Public API client wrapper.
//
// Substitui Late.ai como provider de scheduling/publish multi-platform.
// Docs: https://docs.postiz.com/public-api
//
// Auth: header `Authorization: <api-key>` (sem prefixo "Bearer"). Tokens OAuth2 começam com `pos_`,
// usam o mesmo formato.
//
// Cloud base URL:        https://api.postiz.com/public/v1
// Self-host base URL:    https://<host>/api/public/v1
//
// Concurrency safety: 30 req/h por API key. Postiz suporta batchear múltiplos posts numa única
// chamada — preferir bulk quando possível.

const POSTIZ_DEFAULT_BASE = 'https://api.postiz.com/public/v1';

export interface PostizConfig {
  apiKey: string;
  apiUrl: string; // base URL sem trailing slash
}

export function getPostizConfig(): PostizConfig {
  const apiKey = process.env.POSTIZ_API_KEY;
  if (!apiKey) throw new Error('POSTIZ_API_KEY not configured');
  const apiUrl = (process.env.POSTIZ_API_URL || POSTIZ_DEFAULT_BASE).replace(/\/$/, '');
  return { apiKey, apiUrl };
}

export interface PostizIntegration {
  id: string;
  name: string;
  identifier: string; // x | linkedin | facebook | instagram | threads | bluesky | youtube | tiktok | reddit | discord | pinterest | wordpress | ...
  picture?: string;
  disabled?: boolean;
  profile?: string;
  customer?: { id: string; name: string };
}

export interface PostizMedia {
  id: string;
  path: string;
}

// O Postiz Settings exige o campo `__type` que identifica a plataforma.
// Tipo bem solto pra cada platform expor seus próprios campos.
export type PostizPlatformSettings = Record<string, unknown> & { __type: string };

export interface PostizPostItemValue {
  content: string;
  image?: PostizMedia[];
}

export interface PostizPostItem {
  integration: { id: string };
  value: PostizPostItemValue[]; // array — múltiplos = thread
  settings: PostizPlatformSettings;
  group?: string;
}

export type PostizPostType = 'draft' | 'schedule' | 'now';

export interface PostizCreatePostBody {
  type: PostizPostType;
  date: string; // ISO 8601. Pra `type: 'now'` ainda obrigatório (a doc pede), mande agora.
  shortLink?: boolean;
  tags?: Array<{ value: string; label: string }>;
  posts: PostizPostItem[];
  order?: string;
  inter?: number;
}

export interface PostizCreatePostResponseItem {
  postId: string;
  integration: string;
}

export type PostizCreatePostResponse = PostizCreatePostResponseItem[];

export interface PostizAnalyticsMetric {
  label: string; // Followers | Impressions | Likes | etc.
  data: Array<{ total: string | number; date: string }>;
  percentageChange: number;
}

// Mapa platform-name (ours) → Postiz `identifier` and Postiz settings `__type`.
// Nota: Postiz usa `x` pra Twitter/X.
export const POSTIZ_PLATFORM_MAP: Record<string, { identifier: string; type: string }> = {
  twitter:   { identifier: 'x',         type: 'x' },
  x:         { identifier: 'x',         type: 'x' },
  linkedin:  { identifier: 'linkedin',  type: 'linkedin' },
  instagram: { identifier: 'instagram', type: 'instagram' },
  facebook:  { identifier: 'facebook',  type: 'facebook' },
  threads:   { identifier: 'threads',   type: 'threads' },
  tiktok:    { identifier: 'tiktok',    type: 'tiktok' },
  youtube:   { identifier: 'youtube',   type: 'youtube' },
  bluesky:   { identifier: 'bluesky',   type: 'bluesky' },
  mastodon:  { identifier: 'mastodon',  type: 'mastodon' },
  reddit:    { identifier: 'reddit',    type: 'reddit' },
  pinterest: { identifier: 'pinterest', type: 'pinterest' },
  discord:   { identifier: 'discord',   type: 'discord' },
  telegram:  { identifier: 'telegram',  type: 'telegram' },
};

// ---------- HTTP core ----------

async function postizFetch<T>(
  cfg: PostizConfig,
  path: string,
  init?: RequestInit & { search?: Record<string, string> },
): Promise<T> {
  const url = new URL(`${cfg.apiUrl}${path.startsWith('/') ? path : '/' + path}`);
  if (init?.search) {
    for (const [k, v] of Object.entries(init.search)) url.searchParams.set(k, v);
  }
  const headers: Record<string, string> = {
    Authorization: cfg.apiKey,
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) || {}),
  };
  const r = await fetch(url.toString(), { ...init, headers });
  const text = await r.text();
  if (!r.ok) {
    let msg = `Postiz ${r.status}`;
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = j.error;
      else if (j?.message) msg = j.message;
    } catch {}
    const err = new Error(msg) as Error & { status?: number; body?: string };
    err.status = r.status;
    err.body = text;
    throw err;
  }
  if (!text) return undefined as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// ---------- Endpoints ----------

export async function listIntegrations(cfg: PostizConfig): Promise<PostizIntegration[]> {
  const data = await postizFetch<PostizIntegration[]>(cfg, '/integrations');
  return Array.isArray(data) ? data : [];
}

export async function checkConnection(cfg: PostizConfig): Promise<{ ok: boolean; status: number; body?: string }> {
  // Postiz não documenta um endpoint /check explícito; usamos /integrations como sentinela.
  try {
    await listIntegrations(cfg);
    return { ok: true, status: 200 };
  } catch (e: any) {
    return { ok: false, status: e.status ?? 0, body: e.body };
  }
}

export async function deleteIntegration(cfg: PostizConfig, integrationId: string): Promise<void> {
  await postizFetch<void>(cfg, `/integrations/${integrationId}`, { method: 'DELETE' });
}

export async function createPost(
  cfg: PostizConfig,
  body: PostizCreatePostBody,
): Promise<PostizCreatePostResponse> {
  return postizFetch<PostizCreatePostResponse>(cfg, '/posts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deletePost(cfg: PostizConfig, postId: string): Promise<void> {
  await postizFetch<void>(cfg, `/posts/${postId}`, { method: 'DELETE' });
}

export interface ListPostsParams {
  startDate?: string; // ISO
  endDate?: string;   // ISO
}

export async function listPosts(cfg: PostizConfig, params: ListPostsParams = {}): Promise<any[]> {
  const search: Record<string, string> = {};
  if (params.startDate) search.startDate = params.startDate;
  if (params.endDate) search.endDate = params.endDate;
  const data = await postizFetch<any>(cfg, '/posts', { search });
  // resposta pode vir como { posts: [...] } ou array direto — tolerar ambos.
  if (Array.isArray(data)) return data;
  if (data?.posts && Array.isArray(data.posts)) return data.posts;
  return [];
}

export async function getPlatformAnalytics(
  cfg: PostizConfig,
  integrationId: string,
  daysBack: number = 30,
): Promise<PostizAnalyticsMetric[]> {
  return postizFetch<PostizAnalyticsMetric[]>(cfg, `/analytics/${integrationId}`, {
    search: { date: String(daysBack) },
  });
}

export async function getPostAnalytics(
  cfg: PostizConfig,
  postId: string,
  daysBack: number = 30,
): Promise<PostizAnalyticsMetric[]> {
  return postizFetch<PostizAnalyticsMetric[]>(cfg, `/analytics/post/${postId}`, {
    search: { date: String(daysBack) },
  });
}

export async function uploadFromUrl(cfg: PostizConfig, fileUrl: string): Promise<PostizMedia> {
  // Postiz expõe POST /upload-from-url segundo docs.postiz.com.
  return postizFetch<PostizMedia>(cfg, '/upload-from-url', {
    method: 'POST',
    body: JSON.stringify({ url: fileUrl }),
  });
}

// ---------- Helpers ----------

/**
 * Constrói o `settings` correto pra cada plataforma, respeitando os campos exigidos pela doc.
 * Campos opcionais como `firstComment`, `title`, etc. podem ser passados via `extra`.
 */
export function buildPlatformSettings(
  platform: string,
  opts: {
    contentType?: string; // 'reel' | 'post' | 'story' | 'feed' (instagram)
    firstComment?: string;
    title?: string;
    privacyLevel?: string; // tiktok
    threadItemsCount?: number; // x: pra split? (no postiz a thread é via array `value`)
    extra?: Record<string, unknown>;
  } = {},
): PostizPlatformSettings {
  const map = POSTIZ_PLATFORM_MAP[platform] || POSTIZ_PLATFORM_MAP[platform.toLowerCase()];
  const __type = map?.type || platform;

  const settings: PostizPlatformSettings = { __type };

  switch (__type) {
    case 'x':
      // Doc exige who_can_reply_post.
      settings.who_can_reply_post = opts.extra?.who_can_reply_post || 'everyone';
      break;
    case 'instagram':
      // Doc exige post_type.
      settings.post_type = opts.contentType || opts.extra?.post_type || 'post';
      if (opts.firstComment) settings.firstComment = opts.firstComment;
      break;
    case 'youtube':
      // Doc exige title, type.
      settings.title = opts.title || (opts.extra?.title as string) || 'Untitled';
      settings.type = (opts.extra?.type as string) || 'public';
      break;
    case 'tiktok':
      // Doc exige privacy_level, duet, stitch, comment, autoAddMusic, brand_content_toggle, brand_organic_toggle, content_posting_method.
      settings.privacy_level = opts.privacyLevel || (opts.extra?.privacy_level as string) || 'PUBLIC_TO_EVERYONE';
      settings.duet = (opts.extra?.duet as boolean) ?? false;
      settings.stitch = (opts.extra?.stitch as boolean) ?? false;
      settings.comment = (opts.extra?.comment as boolean) ?? true;
      settings.autoAddMusic = (opts.extra?.autoAddMusic as boolean) ?? false;
      settings.brand_content_toggle = (opts.extra?.brand_content_toggle as boolean) ?? false;
      settings.brand_organic_toggle = (opts.extra?.brand_organic_toggle as boolean) ?? false;
      settings.content_posting_method = (opts.extra?.content_posting_method as string) || 'DIRECT_POST';
      break;
    case 'reddit':
      // Doc exige subreddit[].
      settings.subreddit = (opts.extra?.subreddit as unknown[]) || [];
      break;
    case 'linkedin':
      // Doc só exige __type. Opcional: post_as_images_carousel.
      if (opts.extra?.post_as_images_carousel !== undefined) {
        settings.post_as_images_carousel = opts.extra.post_as_images_carousel;
      }
      break;
    case 'facebook':
      if (opts.firstComment) settings.firstComment = opts.firstComment;
      break;
    default:
      // Threads, Mastodon, Bluesky, Telegram, Nostr, VK — só __type.
      break;
  }

  // Merge any extra keys not handled above (allow override).
  if (opts.extra) {
    for (const [k, v] of Object.entries(opts.extra)) {
      if (!(k in settings)) settings[k] = v;
    }
  }

  return settings;
}

/**
 * Converte mediaUrls (do nosso shape Late) numa array `image[]` Postiz.
 * Como Postiz PRECISA de `id` + `path`, fazemos upload-from-url quando `id` ainda não existe.
 *
 * Retorna media items prontos pro `value[].image`.
 */
export async function ensureMediaItems(
  cfg: PostizConfig,
  inputs: Array<{ url: string; postizId?: string }>,
): Promise<PostizMedia[]> {
  const out: PostizMedia[] = [];
  for (const m of inputs) {
    if (m.postizId) {
      out.push({ id: m.postizId, path: m.url });
    } else {
      try {
        const uploaded = await uploadFromUrl(cfg, m.url);
        out.push(uploaded);
      } catch (e) {
        console.warn('[postiz] upload-from-url failed, falling back to ad-hoc id', e);
        // fallback: generate fake-but-stable id from URL
        out.push({ id: m.url, path: m.url });
      }
    }
  }
  return out;
}

/**
 * Constrói o `value[]` de um post (ou thread) Postiz a partir do nosso shape:
 *  - content único OU array de items (thread)
 *  - mediaUrls global ou per-item (threadItems[i].media_urls)
 */
export async function buildPostValue(
  cfg: PostizConfig,
  args: {
    content?: string;
    mediaUrls?: string[];
    threadItems?: Array<{ text: string; media_urls?: string[] }>;
  },
): Promise<PostizPostItemValue[]> {
  if (args.threadItems && args.threadItems.length > 0) {
    const out: PostizPostItemValue[] = [];
    for (const item of args.threadItems) {
      const value: PostizPostItemValue = { content: item.text };
      if (item.media_urls?.length) {
        value.image = await ensureMediaItems(cfg, item.media_urls.map((u) => ({ url: u })));
      }
      out.push(value);
    }
    return out;
  }

  const value: PostizPostItemValue = { content: args.content || '' };
  if (args.mediaUrls?.length) {
    value.image = await ensureMediaItems(cfg, args.mediaUrls.map((u) => ({ url: u })));
  }
  return [value];
}
