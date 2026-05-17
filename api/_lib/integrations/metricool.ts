// Metricool Public API client wrapper.
//
// Provider canônico do KAI para scheduling, publish e analytics.
// Doc: https://help.metricool.com/en/article/basic-guide-for-api-integration-abukgf/
// Swagger: https://app.metricool.com/api/swagger.json
//
// Auth: header `X-Mc-Auth: <userToken>` + query params `userId` + `blogId` em TODA call.
//   userToken: Account Settings → API
//   userId:    identificador do owner da conta Metricool
//   blogId:    identificador da brand (= 1 cliente KAI)
//
// Base URL: https://app.metricool.com/api
// Available on Advanced ($67/mo, 15 brands) and Custom plans.
import { query } from '../db.js';

const METRICOOL_DEFAULT_BASE = 'https://app.metricool.com/api';

export interface MetricoolConfig {
  apiUrl: string;
  userToken: string;
  userId: string;
}

export function getMetricoolConfig(): MetricoolConfig {
  // Defensive: env vars em prod podem chegar com `\n` trailing (vide ../env.ts).
  // Sanitiza antes de usar em URLs / headers HTTP.
  const userToken = process.env.METRICOOL_USER_TOKEN?.replace(/\\n/g, '').trim();
  const userId = process.env.METRICOOL_USER_ID?.replace(/\\n/g, '').trim();
  if (!userToken) throw new Error('METRICOOL_USER_TOKEN not configured');
  if (!userId) throw new Error('METRICOOL_USER_ID not configured');
  const apiUrl = (process.env.METRICOOL_API_URL || METRICOOL_DEFAULT_BASE)
    .replace(/\\n/g, '')
    .trim()
    .replace(/\/$/, '');
  return { apiUrl, userToken, userId };
}

/**
 * Resolve o `blogId` Metricool de um cliente KAI via
 * `client_social_credentials.metadata.metricool_blog_id`.
 * Retorna o primeiro blogId encontrado pra qualquer plataforma do cliente
 * (todas as plataformas do mesmo cliente usam o mesmo blog_id na Metricool).
 */
export async function resolveBlogId(clientId: string): Promise<string | null> {
  const r = await query<any>(
    `SELECT metadata FROM client_social_credentials
      WHERE client_id = $1 AND metadata->>'metricool_blog_id' IS NOT NULL
      LIMIT 1`,
    [clientId],
  );
  return r[0]?.metadata?.metricool_blog_id || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types — espelham swagger.json definições principais
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricoolBrand {
  id: number;
  label: string;
  url: string;
  picture?: string;
  timezone?: string;
  ownerId?: number;
  role?: string;
}

export interface MetricoolDateTimeInfo {
  dateTime: string; // YYYY-MM-DDTHH:mm:ss
  timezone: string; // IANA (Europe/Madrid, America/Sao_Paulo)
}

export type MetricoolDateTimeInput = Date | string;

const METRICOOL_LOCAL_DATE_TIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/;

function getDateTimePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value || '';
}

/**
 * Metricool expects a local wall-clock datetime plus a separate IANA timezone.
 * Do not send `toISOString().slice(0, 19)` here: that converts Sao Paulo "now"
 * into UTC wall-clock and Metricool will schedule it hours in the future.
 */
export function formatMetricoolDateTime(
  value: MetricoolDateTimeInput,
  timezone = 'America/Sao_Paulo',
): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (METRICOOL_LOCAL_DATE_TIME_RE.test(trimmed)) {
      const withoutMillis = trimmed.replace(/\.\d+$/, '');
      return withoutMillis.length === 16 ? `${withoutMillis}:00` : withoutMillis;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Data inválida para Metricool: ${String(value)}`);
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const year = getDateTimePart(parts, 'year');
  const month = getDateTimePart(parts, 'month');
  const day = getDateTimePart(parts, 'day');
  const hour = getDateTimePart(parts, 'hour');
  const minute = getDateTimePart(parts, 'minute');
  const second = getDateTimePart(parts, 'second');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

export interface MetricoolProviderStatus {
  network: string; // facebook | instagram | twitter | linkedin | tiktok | youtube | threads | pinterest | bluesky | gmb
  id?: string;
  status?: 'PUBLISHED' | 'PUBLISHING' | 'PENDING' | 'ERROR' | 'DRAFT';
  publicUrl?: string;
  detailedStatus?: string;
}

export interface MetricoolInstagramData {
  // Campos válidos confirmados pela API (validação 2026-05-09):
  //   autoPublish, audioName, boost, boostBeneficiary, boostPayer,
  //   carouselProductTags, carouselTags, collaborators, productTags,
  //   shareTrialAutomatically, showReelOnFeed, tags, type
  type?: 'POST' | 'REEL' | 'STORY' | 'CAROUSEL';
  autoPublish?: boolean;
  showReelOnFeed?: boolean;
  shareTrialAutomatically?: boolean; // Trial Reel auto-promotion ('SS_PERFORMANCE'-equivalente)
  audioName?: string;
  collaborators?: string[];
  tags?: Array<{ username: string; x?: number; y?: number }>;
  productTags?: Array<unknown>;
  carouselTags?: Record<string, Array<unknown>>;
  carouselProductTags?: Record<string, Array<unknown>>;
  boost?: number;
  boostPayer?: string;
  boostBeneficiary?: string;
}

export interface MetricoolTwitterData {
  // Metricool scheduler API accepts lowercase Twitter post types.
  // A single tweet is `post`; polls use `poll`.
  type?: 'post' | 'poll';
  replySettings?: 'EVERYONE' | 'MENTIONED_USERS' | 'FOLLOWING' | 'VERIFIED';
  poll?: { options: string[]; durationMinutes: number };
}

export interface MetricoolFacebookData {
  type?: 'POST' | 'REEL' | 'STORY';
  title?: string;
}

export interface MetricoolTiktokData {
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  comment?: boolean;
  duet?: boolean;
  stitch?: boolean;
}

export interface MetricoolYoutubeData {
  title?: string;
  type?: 'public' | 'unlisted' | 'private';
  selfDeclaredMadeForKids?: 'yes' | 'no';
  tags?: string[];
  categoryId?: number;
  playlistId?: string;
}

export interface MetricoolScheduledPostBody {
  publicationDate: MetricoolDateTimeInfo;
  creationDate?: MetricoolDateTimeInfo;
  text: string;
  firstCommentText?: string;
  providers: MetricoolProviderStatus[];
  media?: string[];
  mediaAltText?: string[];
  autoPublish?: boolean;
  saveExternalMediaFiles?: boolean;
  shortener?: boolean;
  draft?: boolean;
  videoCoverMilliseconds?: number;
  videoThumbnailUrl?: string;
  parentId?: number; // pra threads (Twitter/Threads): id do tweet/post pai
  twitterData?: MetricoolTwitterData;
  facebookData?: MetricoolFacebookData;
  instagramData?: MetricoolInstagramData;
  tiktokData?: MetricoolTiktokData;
  youtubeData?: MetricoolYoutubeData;
  hasNotReadNotes?: boolean;
  creatorUserMail?: string;
  creatorUserId?: number;
}

export interface MetricoolPostMetrics {
  id: string | number;
  date?: string;
  url?: string;
  text?: string;
  type?: string;
  // Métricas variam por plataforma — shape solto
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  views?: number;
  videoViews?: number;
  watchTime?: number;
  engagementRate?: number;
  [key: string]: unknown;
}

export interface MetricoolInboxConversation {
  id: string;
  network: string;
  participantName?: string;
  participantPicture?: string;
  lastMessage?: string;
  lastMessageDate?: string;
  unreadCount?: number;
  status?: 'OPEN' | 'CLOSED' | 'PENDING';
  [key: string]: unknown;
}

export interface MetricoolHashtagSession {
  id: string | number;
  hashtag: string;
  network: string;
  startDate: string;
  endDate?: string;
  active: boolean;
}

export interface MetricoolBestTime {
  hour: number;
  day: number; // 0=Sunday..6=Saturday
  score: number;
  posts: number;
}

export interface MetricoolCompetitor {
  id: string | number;
  name: string;
  network: string;
  username?: string;
  followers?: number;
  growth?: number;
}

// Mapping nossa-plataforma → Metricool `network` identifier
export const METRICOOL_PLATFORM_MAP: Record<string, string> = {
  twitter: 'twitter',
  x: 'twitter', // Metricool ainda usa "twitter" no enum
  linkedin: 'linkedin',
  'linkedin-page': 'linkedin', // página LI mapeia pra mesma rede
  instagram: 'instagram',
  facebook: 'facebook',
  threads: 'threads',
  tiktok: 'tiktok',
  youtube: 'youtube',
  bluesky: 'bluesky',
  pinterest: 'pinterest',
  gmb: 'gmb',
  twitch: 'twitch',
};

// ─────────────────────────────────────────────────────────────────────────────
// HTTP core
// ─────────────────────────────────────────────────────────────────────────────

export interface CallOptions {
  blogId?: string | number;
  search?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
}

async function metricoolFetch<T>(
  cfg: MetricoolConfig,
  path: string,
  opts: CallOptions = {},
): Promise<T> {
  const url = new URL(`${cfg.apiUrl}${path.startsWith('/') ? path : '/' + path}`);
  url.searchParams.set('userId', cfg.userId);
  if (opts.blogId !== undefined) url.searchParams.set('blogId', String(opts.blogId));
  if (opts.search) {
    for (const [k, v] of Object.entries(opts.search)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    'X-Mc-Auth': cfg.userToken,
    Accept: 'application/json',
    ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(opts.headers || {}),
  };

  const method = opts.method || (opts.body !== undefined ? 'POST' : 'GET');
  const init: RequestInit = {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  };

  // Retry exponencial com jitter pra 429/503 (rate-limit Metricool ~30 req/h)
  const MAX_RETRIES = 3;
  let lastErr: any = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const r = await fetch(url.toString(), init);

    // Telemetria: log warning quando rate-limit ficando próximo
    const remaining = r.headers.get('x-ratelimit-remaining');
    if (remaining !== null && Number(remaining) < 5) {
      console.warn(`[metricool] rate-limit baixo: ${remaining} req restantes. path=${path}`);
    }

    const text = await r.text();
    if (r.ok) {
      if (!text) return undefined as unknown as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    }

    let msg = `Metricool ${r.status}`;
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = typeof j.error === 'string' ? j.error : JSON.stringify(j.error);
      else if (j?.message) msg = j.message;
      else if (text) msg = `Metricool ${r.status}: ${JSON.stringify(j).slice(0, 500)}`;
    } catch {
      // Non-JSON error bodies are handled by the plain-text fallback below.
    }
    if (msg === `Metricool ${r.status}` && text) {
      msg = `Metricool ${r.status}: ${text.slice(0, 500)}`;
    }
    const err = new Error(msg) as Error & { status?: number; body?: string };
    err.status = r.status;
    err.body = text;
    lastErr = err;

    // Retry só em 429 (rate-limit) ou 503/504 (transient)
    if ((r.status === 429 || r.status === 503 || r.status === 504) && attempt < MAX_RETRIES) {
      const delay = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
      console.warn(`[metricool] ${r.status} retry ${attempt + 1}/${MAX_RETRIES} em ${delay}ms — ${path}`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    throw err;
  }
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand / Profile management
// ─────────────────────────────────────────────────────────────────────────────

// Cache em módulo: brands raramente mudam, evita 1 req por load do dashboard
const BRANDS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
let brandsCache: { userId: string; data: MetricoolBrand[]; expiresAt: number } | null = null;

/** Lista todas as brands (= clientes) da conta Metricool. Cache 24h por userId. */
export async function listBrands(
  cfg: MetricoolConfig,
  opts: { force?: boolean } = {},
): Promise<MetricoolBrand[]> {
  const now = Date.now();
  if (
    !opts.force &&
    brandsCache &&
    brandsCache.userId === cfg.userId &&
    brandsCache.expiresAt > now
  ) {
    return brandsCache.data;
  }
  const data = await metricoolFetch<MetricoolBrand[]>(cfg, '/admin/simpleProfiles');
  const arr = Array.isArray(data) ? data : [];
  brandsCache = { userId: cfg.userId, data: arr, expiresAt: now + BRANDS_CACHE_TTL_MS };
  return arr;
}

/** Lista contas sociais conectadas de um brand. */
export async function listConnectedAccounts(
  cfg: MetricoolConfig,
  blogId: string | number,
): Promise<Array<{ network: string; username?: string; profileId?: string; connected: boolean }>> {
  // Endpoint dinâmico do Metricool — `getAccounts` retorna shape variando por plataforma.
  // Usamos /v2/settings/accounts como fonte canônica das integrações.
  const data = await metricoolFetch<any>(cfg, '/v2/settings/accounts', { blogId });
  const accounts: Array<{ network: string; username?: string; profileId?: string; connected: boolean }> = [];
  if (data && typeof data === 'object') {
    for (const [network, info] of Object.entries(data)) {
      const i = info as any;
      if (i && (i.connected || i.username || i.profileId)) {
        accounts.push({
          network,
          username: i.username || i.profile,
          profileId: i.profileId || i.id,
          connected: !!i.connected || !!i.id,
        });
      }
    }
  }
  return accounts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Media upload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Antes de criar post com mídia, Metricool exige "normalizar" a URL — eles fazem
 * uma cópia interna e retornam URL deles. Use ESSA URL no `media[]` do post.
 */
export async function normalizeMediaUrl(
  cfg: MetricoolConfig,
  blogId: string | number,
  fileUrl: string,
): Promise<string> {
  const data = await metricoolFetch<any>(cfg, '/actions/normalize/image/url', {
    blogId,
    search: { url: fileUrl },
  });
  // Resposta pode vir como { url: '...' } ou string direta
  if (typeof data === 'string') return data;
  return data?.url || data?.path || fileUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduling / Publishing
// ─────────────────────────────────────────────────────────────────────────────

export async function createScheduledPost(
  cfg: MetricoolConfig,
  blogId: string | number,
  body: MetricoolScheduledPostBody,
): Promise<{ id: number; providers: MetricoolProviderStatus[] }> {
  const data = await metricoolFetch<any>(cfg, '/v2/scheduler/posts', {
    blogId,
    method: 'POST',
    body,
  });
  return data?.data || data;
}

export async function updateScheduledPost(
  cfg: MetricoolConfig,
  blogId: string | number,
  postId: number | string,
  patch: Partial<MetricoolScheduledPostBody>,
): Promise<any> {
  const data = await metricoolFetch<any>(cfg, `/v2/scheduler/posts/${postId}`, {
    blogId,
    method: 'PUT',
    body: patch,
  });
  return data?.data || data;
}

export async function deleteScheduledPost(
  cfg: MetricoolConfig,
  blogId: string | number,
  postId: number | string,
): Promise<void> {
  await metricoolFetch(cfg, `/v2/scheduler/posts/${postId}`, {
    blogId,
    method: 'DELETE',
  });
}

export async function getScheduledPost(
  cfg: MetricoolConfig,
  blogId: string | number,
  postId: number | string,
): Promise<any> {
  const data = await metricoolFetch<any>(cfg, `/v2/scheduler/posts/${postId}`, { blogId });
  return data?.data || data;
}

export async function listScheduledPosts(
  cfg: MetricoolConfig,
  blogId: string | number,
  startDate: MetricoolDateTimeInput,
  endDate: MetricoolDateTimeInput,
  timezone = 'America/Sao_Paulo',
): Promise<any[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/scheduler/posts', {
    blogId,
    search: {
      start: formatMetricoolDateTime(startDate, timezone),
      end: formatMetricoolDateTime(endDate, timezone),
      timezone,
      extendedRange: true,
    },
  });
  if (Array.isArray(data)) return data;
  return data?.posts || data?.data || [];
}

/** Best time to post de uma plataforma específica. */
export async function getBestTimes(
  cfg: MetricoolConfig,
  blogId: string | number,
  network: string,
): Promise<MetricoolBestTime[]> {
  const data = await metricoolFetch<any>(cfg, `/v2/scheduler/besttimes/${network}`, { blogId });
  if (Array.isArray(data)) return data;
  return data?.bestTimes || data?.data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics — per-platform posts/reels/stories
// ─────────────────────────────────────────────────────────────────────────────

const ANALYTICS_NETWORKS_WITH_POSTS = [
  'instagram',
  'facebook',
  'twitter',
  'linkedin',
  'tiktok',
  'threads',
  'pinterest',
  'bluesky',
  'youtube',
] as const;

export type MetricoolAnalyticsNetwork = (typeof ANALYTICS_NETWORKS_WITH_POSTS)[number];

export async function getNetworkPosts(
  cfg: MetricoolConfig,
  blogId: string | number,
  network: MetricoolAnalyticsNetwork,
  from: string,
  to: string,
  timezone?: string,
): Promise<MetricoolPostMetrics[]> {
  const data = await metricoolFetch<any>(cfg, `/v2/analytics/posts/${network}`, {
    blogId,
    search: { from, to, ...(timezone ? { timezone } : {}) },
  });
  if (Array.isArray(data)) return data;
  return data?.data || data?.posts || [];
}

export async function getInstagramReels(
  cfg: MetricoolConfig,
  blogId: string | number,
  from: string,
  to: string,
): Promise<MetricoolPostMetrics[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/analytics/reels/instagram', {
    blogId,
    search: { from, to },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

export async function getFacebookReels(
  cfg: MetricoolConfig,
  blogId: string | number,
  from: string,
  to: string,
): Promise<MetricoolPostMetrics[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/analytics/reels/facebook', {
    blogId,
    search: { from, to },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

export async function getInstagramStories(
  cfg: MetricoolConfig,
  blogId: string | number,
  from: string,
  to: string,
): Promise<MetricoolPostMetrics[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/analytics/stories/instagram', {
    blogId,
    search: { from, to },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

export async function getFacebookStories(
  cfg: MetricoolConfig,
  blogId: string | number,
  from: string,
  to: string,
): Promise<MetricoolPostMetrics[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/analytics/stories/facebook', {
    blogId,
    search: { from, to },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/**
 * Timeline de uma métrica específica.
 * Endpoint correto: /v2/analytics/timelines com network+metric obrigatórios,
 * e `subject` quase sempre obrigatório (account/posts/reels/stories/etc).
 *
 * Networks suportadas: tiktok, tiktokads, pinterest, youtube, facebook, gmb,
 * instagram, linkedin, threads. Twitter só expõe postsCount.
 *
 * Resposta canônica: `{data: [{metric, values: [{dateTime, value}]}]}`.
 * Esta função desempacota para `[{date, value}]`.
 *
 * Métricas validadas (2026-05-09) para followers:
 *   instagram (account): followers
 *   facebook  (account): pageFollows
 *   youtube   (account): totalSubscribers
 *   threads   (account): followers_count
 *   linkedin  (account): followers
 *   tiktok    (account): followers_count
 */
export async function getTimeline(
  cfg: MetricoolConfig,
  blogId: string | number,
  network: string,
  metric: string,
  from: string,
  to: string,
  timezone?: string,
  subject?: string,
): Promise<Array<{ date: string; value: number }>> {
  const data = await metricoolFetch<any>(cfg, '/v2/analytics/timelines', {
    blogId,
    search: {
      network,
      metric,
      from,
      to,
      ...(subject ? { subject } : {}),
      ...(timezone ? { timezone } : {}),
    },
  });
  // Resposta nova: {data: [{metric, values: [{dateTime, value}]}]}
  const series = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const first = series[0];
  if (first && Array.isArray(first.values)) {
    return first.values.map((v: any) => ({
      date: v.dateTime ?? v.date ?? '',
      value: typeof v.value === 'number' ? v.value : Number(v.value) || 0,
    }));
  }
  // Fallback formato legado: array direto de {date,value}
  if (Array.isArray(data?.timeline)) return data.timeline;
  return [];
}

/** Brand summary: agregado de posts num período. */
export async function getBrandSummary(
  cfg: MetricoolConfig,
  blogId: string | number,
  from: string,
  to: string,
): Promise<any> {
  return metricoolFetch(cfg, '/v2/analytics/brand-summary/posts', {
    blogId,
    search: { from, to },
  });
}

/** Aggregation genérica — qualquer métrica agregada num período. */
export async function getAggregation(
  cfg: MetricoolConfig,
  blogId: string | number,
  metric: string,
  from: string,
  to: string,
): Promise<any> {
  return metricoolFetch(cfg, '/v2/analytics/aggregation', {
    blogId,
    search: { metric, from, to },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Inbox — DMs + comentários + reviews unificados
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista conversas inbox de uma plataforma específica.
 * `provider` é OBRIGATÓRIO (instagram/facebook/linkedin/twitter/etc).
 */
export async function listInboxConversations(
  cfg: MetricoolConfig,
  blogId: string | number,
  provider: string,
  filters: { status?: 'OPEN' | 'CLOSED' | 'PENDING'; limit?: number; offset?: number } = {},
): Promise<MetricoolInboxConversation[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/inbox/conversations', {
    blogId,
    search: {
      provider,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.limit ? { limit: filters.limit } : {}),
      ...(filters.offset ? { offset: filters.offset } : {}),
    },
  });
  if (Array.isArray(data)) return data;
  return data?.data || data?.conversations || [];
}

/** Envia mensagem em conversa existente OU resposta a comment. */
export async function sendInboxMessage(
  cfg: MetricoolConfig,
  blogId: string | number,
  body: { conversationId: string; text: string; mediaUrl?: string },
): Promise<any> {
  return metricoolFetch(cfg, '/v2/inbox/conversations', {
    blogId,
    method: 'POST',
    body,
  });
}

/** Lista comentários — `provider` obrigatório. */
export async function listPostComments(
  cfg: MetricoolConfig,
  blogId: string | number,
  provider: string,
  filters: { limit?: number; offset?: number } = {},
): Promise<any[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/inbox/post-comments', {
    blogId,
    search: { provider, ...filters } as Record<string, string | number>,
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

export async function replyToComment(
  cfg: MetricoolConfig,
  blogId: string | number,
  body: { commentId: string; text: string; network: string },
): Promise<any> {
  return metricoolFetch(cfg, '/v2/inbox/post-comments', {
    blogId,
    method: 'POST',
    body,
  });
}

export async function deleteComment(
  cfg: MetricoolConfig,
  blogId: string | number,
  commentId: string,
): Promise<void> {
  await metricoolFetch(cfg, '/v2/inbox/post-comments', {
    blogId,
    method: 'DELETE',
    search: { commentId },
  });
}

export async function setInboxStatus(
  cfg: MetricoolConfig,
  blogId: string | number,
  body: { id: string; status: 'OPEN' | 'CLOSED' | 'PENDING'; type: 'conversation' | 'comment' },
): Promise<any> {
  return metricoolFetch(cfg, '/v2/inbox/status', {
    blogId,
    method: 'PUT',
    body,
  });
}

/** Lista reviews — provider opcional (default 'gmb'). */
export async function listReviews(
  cfg: MetricoolConfig,
  blogId: string | number,
  provider = 'gmb',
): Promise<any[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/inbox/reviews', {
    blogId,
    search: { provider },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

export async function replyToReview(
  cfg: MetricoolConfig,
  blogId: string | number,
  body: { reviewId: string; text: string; network: string },
): Promise<any> {
  return metricoolFetch(cfg, '/v2/inbox/reviews/replies', {
    blogId,
    method: 'POST',
    body,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hashtags Tracker
// ─────────────────────────────────────────────────────────────────────────────

export async function listHashtagSessions(
  cfg: MetricoolConfig,
  blogId: string | number,
): Promise<MetricoolHashtagSession[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/hashtags-tracker/tracking-sessions', { blogId });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

export async function createHashtagSession(
  cfg: MetricoolConfig,
  blogId: string | number,
  body: { hashtag: string; network: string; durationDays?: number },
): Promise<any> {
  return metricoolFetch(cfg, '/v2/hashtags-tracker/tracking-sessions', {
    blogId,
    method: 'POST',
    body,
  });
}

export async function getHashtagDistribution(
  cfg: MetricoolConfig,
  blogId: string | number,
  sessionId: string | number,
): Promise<any> {
  return metricoolFetch(cfg, `/v2/hashtags-tracker/tracking-sessions/${sessionId}/distribution`, {
    blogId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Competitors
// ─────────────────────────────────────────────────────────────────────────────

export async function listCompetitors(
  cfg: MetricoolConfig,
  blogId: string | number,
  network: string,
): Promise<MetricoolCompetitor[]> {
  const data = await metricoolFetch<any>(cfg, `/v2/analytics/competitors/${network}`, { blogId });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

export async function addCompetitor(
  cfg: MetricoolConfig,
  blogId: string | number,
  network: string,
  body: { username: string; name?: string },
): Promise<any> {
  return metricoolFetch(cfg, `/v2/analytics/competitors/${network}`, {
    blogId,
    method: 'POST',
    body,
  });
}

export async function getCompetitorPosts(
  cfg: MetricoolConfig,
  blogId: string | number,
  network: string,
  competitorId: string | number,
  from: string,
  to: string,
): Promise<any[]> {
  const data = await metricoolFetch<any>(cfg, `/v2/analytics/competitors/${network}/${competitorId}/posts`, {
    blogId,
    search: { from, to },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports — Performance Dashboards (`/v2/reporting/campaigns-dashboard`) +
// Brand reports history (`/v2/brands/{blogId}/reports`) + custom report
// templates (`/stats/report/*`).
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricoolPerformanceDashboard {
  id: number | string;
  title?: string;
  description?: string;
  from?: string;
  to?: string;
  networks?: string[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface MetricoolDashboardCreationInput {
  title: string;
  description: string;
  from: string; // ISO YYYY-MM-DDTHH:mm:ss
  to: string;   // ISO YYYY-MM-DDTHH:mm:ss
  networks: string[]; // ['instagram','facebook','tiktok',...]
  timezone?: string;
  autoCategorize?: boolean;
}

export interface MetricoolReportHistoryItem {
  creationDate?: string;
  from?: string;
  to?: string;
  rss?: boolean;
  twitter?: boolean;
  facebook?: boolean;
  facebookAds?: boolean;
  instagram?: boolean;
  threads?: boolean;
  bluesky?: boolean;
  linkedin?: boolean;
  pinterest?: boolean;
  tiktok?: boolean;
  adwords?: boolean;
  gmb?: boolean;
  youtube?: boolean;
  twitch?: boolean;
  tiktokAds?: boolean;
  brandSummary?: boolean;
  reportType?: string;
  reportFile?: string;
  status?: 'PENDING' | 'RUNNING' | 'RETRYING' | 'FINISHED' | 'FAILED';
  engineVersion?: string;
  jobId?: string;
  [key: string]: unknown;
}

export interface MetricoolReportStatusInfo {
  status?: string;
  reportPath?: string;
  [key: string]: unknown;
}

export interface MetricoolReportTemplate {
  id: number | string;
  name?: string;
  userId?: number;
  blogId?: number;
  deleted?: number;
  [key: string]: unknown;
}

/** Lista todos os Performance Dashboards ativos da brand. */
export async function listPerformanceDashboards(
  cfg: MetricoolConfig,
  blogId: string | number,
): Promise<MetricoolPerformanceDashboard[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/reporting/campaigns-dashboard', { blogId });
  if (Array.isArray(data)) return data;
  return data?.data || data?.dashboards || [];
}

/** Cria novo Performance Dashboard. */
export async function createPerformanceDashboard(
  cfg: MetricoolConfig,
  blogId: string | number,
  input: MetricoolDashboardCreationInput,
): Promise<MetricoolPerformanceDashboard> {
  const tz = input.timezone || 'America/Sao_Paulo';
  const body = {
    title: input.title,
    description: input.description,
    from: { dateTime: input.from, timezone: tz },
    to: { dateTime: input.to, timezone: tz },
    networks: input.networks,
    autoCategorize: input.autoCategorize !== false,
  };
  const data = await metricoolFetch<any>(cfg, '/v2/reporting/campaigns-dashboard', {
    blogId,
    method: 'POST',
    body,
  });
  return data?.data || data;
}

export async function getPerformanceDashboard(
  cfg: MetricoolConfig,
  blogId: string | number,
  dashboardId: string | number,
): Promise<MetricoolPerformanceDashboard | null> {
  const data = await metricoolFetch<any>(
    cfg,
    `/v2/reporting/campaigns-dashboard/${dashboardId}`,
    { blogId },
  );
  return data?.data || data || null;
}

export async function deletePerformanceDashboard(
  cfg: MetricoolConfig,
  blogId: string | number,
  dashboardId: string | number,
): Promise<void> {
  await metricoolFetch(cfg, `/v2/reporting/campaigns-dashboard/${dashboardId}`, {
    blogId,
    method: 'DELETE',
  });
}

export async function syncPerformanceDashboard(
  cfg: MetricoolConfig,
  blogId: string | number,
  dashboardId: string | number,
): Promise<any> {
  return metricoolFetch(cfg, `/v2/reporting/campaigns-dashboard/${dashboardId}/sync`, {
    blogId,
    method: 'POST',
    body: {},
  });
}

export async function getPerformanceDashboardAnalytics(
  cfg: MetricoolConfig,
  blogId: string | number,
  dashboardId: string | number,
  networks?: string[],
): Promise<any> {
  const search: Record<string, string> = {};
  if (networks?.length) search.networks = networks.join(',');
  return metricoolFetch(cfg, `/v2/reporting/campaigns-dashboard/${dashboardId}/analytics`, {
    blogId,
    search,
  });
}

export async function getPerformanceDashboardInsights(
  cfg: MetricoolConfig,
  blogId: string | number,
  dashboardId: string | number,
): Promise<any> {
  return metricoolFetch(cfg, `/v2/reporting/campaigns-dashboard/${dashboardId}/insights`, {
    blogId,
  });
}

export async function getPerformanceDashboardBestPosts(
  cfg: MetricoolConfig,
  blogId: string | number,
  dashboardId: string | number,
  metric?: string,
): Promise<any> {
  return metricoolFetch(cfg, `/v2/reporting/campaigns-dashboard/${dashboardId}/best-posts`, {
    blogId,
    search: metric ? { metric } : undefined,
  });
}

/** Histórico de reports (PDFs gerados) da brand. */
export async function listBrandReports(
  cfg: MetricoolConfig,
  blogId: string | number,
): Promise<MetricoolReportHistoryItem[]> {
  const data = await metricoolFetch<any>(cfg, `/v2/brands/${blogId}/reports`, { blogId });
  if (Array.isArray(data)) return data;
  return data?.data || data?.reports || [];
}

/** Status de geração de um report (job assíncrono). */
export async function getBrandReportStatus(
  cfg: MetricoolConfig,
  blogId: string | number,
  jobId: string,
): Promise<MetricoolReportStatusInfo> {
  const data = await metricoolFetch<any>(cfg, `/v2/brands/${blogId}/reports/${jobId}`, { blogId });
  return data?.data || data || {};
}

/** Lista templates de report customizados do usuário. */
export async function listReportTemplates(
  cfg: MetricoolConfig,
): Promise<MetricoolReportTemplate[]> {
  const data = await metricoolFetch<any>(cfg, '/stats/report/reporttemplateName');
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

export async function getReportTemplateParams(
  cfg: MetricoolConfig,
  templateId: string | number,
): Promise<Record<string, string>> {
  const data = await metricoolFetch<any>(cfg, '/stats/report/reporttemplateparam', {
    search: { templateId },
  });
  return (data?.data || data || {}) as Record<string, string>;
}

/** Configuração de reports automáticos (recorrência + emails). */
export async function getReportConfiguration(
  cfg: MetricoolConfig,
  blogId: string | number,
  reportType: string,
): Promise<any> {
  return metricoolFetch(cfg, '/v2/analytics/reports/configuration', {
    blogId,
    search: { reportType },
  });
}

export async function updateReportConfiguration(
  cfg: MetricoolConfig,
  blogId: string | number,
  body: {
    reportType: string;
    emails?: string[];
    automaticReportDate?: number;
    text?: string;
    subscribe?: boolean;
    replyTo?: string;
    saveMonthlySetup?: boolean;
    reportLogo?: string;
  },
): Promise<any> {
  return metricoolFetch(cfg, '/v2/analytics/reports/configuration', {
    blogId,
    method: 'PUT',
    body: { ...body, blogId: Number(blogId), userId: Number(cfg.userId) },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar — `/v2/scheduler/calendars/*` (system + user calendars).
// System: datas comemorativas/holidays públicas mantidas pela Metricool.
// User: ICS calendars adicionados pelo cliente via URL pública.
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricoolCalendar {
  id: number;
  url?: string;
  name?: string;
  description?: string;
  publicCalendar?: boolean;
  timeZone?: string;
  language?: string;
  type?: 'SYSTEM' | 'USER';
  events?: MetricoolCalendarEvent[];
  [key: string]: unknown;
}

export interface MetricoolCalendarEvent {
  name?: string;
  description?: string;
  eventInit?: string; // ISO date-time
  eventEnd?: string;
  repeatEvent?: boolean;
  repeat?: { frequency?: string; interval?: number };
  dailyEvent?: boolean;
  uid?: string;
  calendarId?: number | string;
  calendarName?: string;
  [key: string]: unknown;
}

/** Lista todos os calendários "system" públicos (datas comemorativas, holidays). */
export async function listSystemCalendars(
  cfg: MetricoolConfig,
  language?: string,
): Promise<MetricoolCalendar[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/scheduler/calendars', {
    search: language ? { language } : undefined,
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/** Lista calendários assinados (system + user) por usuário/brand. */
export async function listAssignedCalendars(
  cfg: MetricoolConfig,
  blogId: string | number,
  language?: string,
): Promise<MetricoolCalendar[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/scheduler/calendars/assigned', {
    blogId,
    search: language ? { language } : undefined,
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/** Eventos de um calendário num período. */
export async function getCalendarEvents(
  cfg: MetricoolConfig,
  blogId: string | number,
  calendarId: string | number,
  initDate: string, // YYYY-MM-DDTHH:mm:ss
  endDate: string,
  timeZone = 'America/Sao_Paulo',
): Promise<MetricoolCalendarEvent[]> {
  const data = await metricoolFetch<any>(
    cfg,
    `/v2/scheduler/calendars/${calendarId}/events`,
    {
      blogId,
      search: { initDate, endDate, timeZone },
    },
  );
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.events)) return data.data.events;
  return [];
}

/** Adiciona um system calendar à brand (datas comemorativas BR, etc). */
export async function assignCalendarToBlog(
  cfg: MetricoolConfig,
  blogId: string | number,
  calendarId: string | number,
  aggregationFrom: 'user' | 'blog' | 'both' = 'blog',
): Promise<any> {
  return metricoolFetch(cfg, `/v2/scheduler/calendars/${calendarId}/assignation`, {
    blogId,
    method: 'POST',
    body: { aggregationFrom },
  });
}

export async function unassignCalendarFromBlog(
  cfg: MetricoolConfig,
  blogId: string | number,
  calendarId: string | number,
  aggregationFrom: 'user' | 'blog' | 'both' = 'blog',
): Promise<any> {
  return metricoolFetch(cfg, `/v2/scheduler/calendars/${calendarId}/assignation`, {
    blogId,
    method: 'DELETE',
    body: { aggregationFrom },
  });
}

/** Cria calendar "user" (ICS URL público) e atribui ao blog. */
export async function createUserCalendar(
  cfg: MetricoolConfig,
  blogId: string | number,
  body: {
    name: string;
    url: string;
    description?: string;
    language?: string;
    publicCalendar?: boolean;
    aggregationFrom?: 'user' | 'blog' | 'both';
  },
): Promise<MetricoolCalendar> {
  const payload = {
    name: body.name,
    url: body.url,
    description: body.description,
    language: body.language || 'pt',
    publicCalendar: body.publicCalendar ?? false,
    aggregationFrom: body.aggregationFrom || 'blog',
  };
  const data = await metricoolFetch<any>(cfg, '/v2/scheduler/calendars/user', {
    blogId,
    method: 'POST',
    body: payload,
  });
  return data?.data || data;
}

/** Refresh cache de um user calendar (re-fetch ICS). */
export async function refreshCalendarCache(
  cfg: MetricoolConfig,
  blogId: string | number,
  calendarId: string | number,
): Promise<any> {
  return metricoolFetch(cfg, `/v2/scheduler/calendars/${calendarId}/cache`, {
    blogId,
    method: 'POST',
    body: {},
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Realtime stats
// ─────────────────────────────────────────────────────────────────────────────

export async function getRealtimeValues(
  cfg: MetricoolConfig,
  blogId: string | number,
): Promise<any> {
  return metricoolFetch(cfg, '/stats/rt/values', { blogId });
}

export async function getRealtimeSessions(
  cfg: MetricoolConfig,
  blogId: string | number,
): Promise<any> {
  return metricoolFetch(cfg, '/stats/rt/sessions', { blogId });
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart Links — encurtador URL com tracking, UTMs, analytics
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricoolSmartLink {
  id?: number;
  slug?: string;
  name?: string;
  appearance?: Record<string, unknown>;
  content?: {
    icons?: any[];
    buttons?: any[];
    images?: any[];
    header?: Record<string, unknown>;
  };
  version?: number;
  free?: boolean;
  createDate?: { dateTime: string; timezone: string };
  youtubeFeed?: string;
  // Campos derivados/adicionais via API:
  shortUrl?: string;
  originalUrl?: string;
  clicks?: number;
  [key: string]: unknown;
}

export interface MetricoolSmartLinkLite {
  id: number;
  slug?: string;
  name?: string;
  imageUrl?: string;
  createDate?: { dateTime: string; timezone: string };
}

export interface MetricoolSmartLinkTimelinePoint {
  date?: string;
  value?: number;
  [key: string]: unknown;
}

/** Lista smart links (full payload). Filter opcional por slug. */
export async function getSmartLinks(
  cfg: MetricoolConfig,
  blogId: string | number,
  slug?: string,
): Promise<MetricoolSmartLink[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/smart-links/links', {
    blogId,
    search: slug ? { slug } : undefined,
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/** Lista smart links em formato "lite" (id, slug, name, imageUrl) — leve pra grids. */
export async function getSmartLinksLite(
  cfg: MetricoolConfig,
  blogId: string | number,
): Promise<MetricoolSmartLinkLite[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/smart-links/links/lite', { blogId });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/** Detalhe de um smart link. */
export async function getSmartLink(
  cfg: MetricoolConfig,
  blogId: string | number,
  id: number | string,
): Promise<MetricoolSmartLink | null> {
  const data = await metricoolFetch<any>(cfg, `/v2/smart-links/links/${id}`, { blogId });
  return data?.data || data || null;
}

/** Cria smart link novo. */
export async function createSmartLink(
  cfg: MetricoolConfig,
  blogId: string | number,
  body: Partial<MetricoolSmartLink>,
): Promise<MetricoolSmartLink> {
  const data = await metricoolFetch<any>(cfg, '/v2/smart-links/links', {
    blogId,
    method: 'POST',
    body,
  });
  return data?.data || data;
}

/** Atualiza smart link. */
export async function updateSmartLink(
  cfg: MetricoolConfig,
  blogId: string | number,
  id: number | string,
  body: Partial<MetricoolSmartLink>,
): Promise<MetricoolSmartLink> {
  const data = await metricoolFetch<any>(cfg, `/v2/smart-links/links/${id}`, {
    blogId,
    method: 'PUT',
    body,
  });
  return data?.data || data;
}

/** Deleta smart link. */
export async function deleteSmartLink(
  cfg: MetricoolConfig,
  blogId: string | number,
  id: number | string,
): Promise<void> {
  await metricoolFetch(cfg, `/v2/smart-links/links/${id}`, {
    blogId,
    method: 'DELETE',
  });
}

/** Verifica disponibilidade de slug. */
export async function isSmartLinkSlugAvailable(
  cfg: MetricoolConfig,
  blogId: string | number,
  value: string,
): Promise<boolean> {
  const data = await metricoolFetch<any>(cfg, '/v2/smart-links/links/slugs', {
    blogId,
    search: { value },
  });
  // API retorna JsonOkResponseString — heurística:
  if (typeof data === 'boolean') return data;
  if (typeof data?.data === 'boolean') return data.data;
  if (typeof data?.data === 'string') return data.data.toLowerCase() === 'true';
  return !!data?.data;
}

/** Timeline de uma métrica do smart link (ex: 'clicks'). */
export async function getSmartLinkTimeline(
  cfg: MetricoolConfig,
  blogId: string | number,
  id: number | string,
  metric: string,
  from: string,
  to: string,
  itemId?: number | string,
): Promise<MetricoolSmartLinkTimelinePoint[]> {
  const data = await metricoolFetch<any>(cfg, `/v2/smart-links/links/${id}/analytics/timeline`, {
    blogId,
    search: { metric, from, to, ...(itemId !== undefined ? { itemId } : {}) },
  });
  if (Array.isArray(data)) return data;
  return data?.data || data?.values || [];
}

/** Analytics por botão de smart link. */
export async function getSmartLinkButtonAnalytics(
  cfg: MetricoolConfig,
  blogId: string | number,
  id: number | string,
  from: string,
  to: string,
): Promise<any[]> {
  const data = await metricoolFetch<any>(cfg, `/v2/smart-links/links/${id}/analytics/buttons`, {
    blogId,
    search: { from, to },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/** Analytics por imagem de smart link. */
export async function getSmartLinkImageAnalytics(
  cfg: MetricoolConfig,
  blogId: string | number,
  id: number | string,
  from: string,
  to: string,
): Promise<any[]> {
  const data = await metricoolFetch<any>(cfg, `/v2/smart-links/links/${id}/analytics/images`, {
    blogId,
    search: { from, to },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Linkin Bio — Instagram bio link page (catalog images + buttons)
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricoolBioCatalogItem {
  id: number;
  blogId?: number;
  postId?: string;
  timestamp?: number;
  url?: string;
  imageUrl?: string;
  linkId?: number;
  shortUrl?: string;
  type?: string;
  [key: string]: unknown;
}

export interface MetricoolBioButton {
  id: number;
  blogId?: number;
  link?: string;
  text?: string;
  position?: number;
  color?: string;
  linkId?: number;
  shortUrl?: string;
  [key: string]: unknown;
}

/** Catálogo de imagens (posts) na Linkin Bio. */
export async function getInstagramBioCatalog(
  cfg: MetricoolConfig,
  blogId: string | number,
): Promise<MetricoolBioCatalogItem[]> {
  const data = await metricoolFetch<any>(cfg, '/linkinbio/instagram/getbiocatalog', { blogId });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/** Botões da Linkin Bio (links com texto). */
export async function getInstagramBioButtons(
  cfg: MetricoolConfig,
  blogId: string | number,
): Promise<MetricoolBioButton[]> {
  const data = await metricoolFetch<any>(cfg, '/linkinbio/instagram/getbioButtons', { blogId });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/** Adiciona imagem (post) ao catálogo Linkin Bio. */
export async function addInstagramBioCatalogItem(
  cfg: MetricoolConfig,
  blogId: string | number,
  params: { picture?: string; igid?: string; timestamp?: number },
): Promise<MetricoolBioCatalogItem[]> {
  const data = await metricoolFetch<any>(cfg, '/linkinbio/instagram/addcatalogitems', {
    blogId,
    method: 'POST',
    search: {
      ...(params.picture ? { picture: params.picture } : {}),
      ...(params.igid ? { igid: params.igid } : {}),
      ...(params.timestamp !== undefined ? { timestamp: params.timestamp } : {}),
    },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/** Adiciona botão (texto + link) à Linkin Bio. */
export async function addInstagramBioButton(
  cfg: MetricoolConfig,
  blogId: string | number,
  params: { textButton: string; link: string },
): Promise<MetricoolBioButton[]> {
  const data = await metricoolFetch<any>(cfg, '/linkinbio/instagram/addcatalogButton', {
    blogId,
    search: { textButton: params.textButton, link: params.link },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/** Edita link de uma imagem do catálogo. */
export async function editInstagramBioCatalogItem(
  cfg: MetricoolConfig,
  blogId: string | number,
  itemid: number | string,
  link: string,
): Promise<MetricoolBioCatalogItem[]> {
  const data = await metricoolFetch<any>(cfg, '/linkinbio/instagram/editcatalogitem', {
    blogId,
    search: { itemid, link },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/** Edita texto e link de um botão. */
export async function editInstagramBioButton(
  cfg: MetricoolConfig,
  blogId: string | number,
  itemid: number | string,
  patch: { link?: string; text?: string },
): Promise<MetricoolBioButton[]> {
  const data = await metricoolFetch<any>(cfg, '/linkinbio/instagram/editcatalogbutton', {
    blogId,
    search: {
      itemid,
      ...(patch.link !== undefined ? { link: patch.link } : {}),
      ...(patch.text !== undefined ? { text: patch.text } : {}),
    },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/** Atualiza posição/ordem de um botão. */
export async function updateInstagramBioButtonPosition(
  cfg: MetricoolConfig,
  blogId: string | number,
  itemid: number | string,
): Promise<MetricoolBioButton[]> {
  const data = await metricoolFetch<any>(cfg, '/linkinbio/instagram/updateButtonPosition', {
    blogId,
    search: { itemid },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/** Deleta imagem do catálogo. */
export async function deleteInstagramBioCatalogImage(
  cfg: MetricoolConfig,
  blogId: string | number,
  itemid: number | string,
): Promise<MetricoolBioCatalogItem[]> {
  const data = await metricoolFetch<any>(cfg, '/linkinbio/instagram/deletecatalogimage', {
    blogId,
    method: 'DELETE',
    search: { itemid },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

/** Deleta botão. */
export async function deleteInstagramBioButton(
  cfg: MetricoolConfig,
  blogId: string | number,
  itemid: number | string,
): Promise<MetricoolBioButton[]> {
  const data = await metricoolFetch<any>(cfg, '/linkinbio/instagram/deletecatalogitem', {
    blogId,
    method: 'DELETE',
    search: { itemid },
  });
  if (Array.isArray(data)) return data;
  return data?.data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Métricas — normalize shared helper (Gap #9, antes duplicado em 2 handlers)
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizedPostMetrics {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  video_views: number;
  saves: number;
  eng_rate: number;
  last_synced_at: string;
}

function pickNumberFrom(...vals: Array<unknown>): number {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const num = Number(v);
      if (Number.isFinite(num)) return num;
    }
  }
  return 0;
}

function sumNumberFrom(...vals: Array<unknown>): number | undefined {
  let hasValue = false;
  let total = 0;
  for (const value of vals) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      hasValue = true;
      total += value;
    } else if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        hasValue = true;
        total += parsed;
      }
    }
  }
  return hasValue ? total : undefined;
}

/**
 * Normaliza shape solto de Metricool/legacy em formato canônico de métrica.
 * Engagement rate cai pra `impressions` quando `reach` não vier (Gap #7).
 */
export function normalizeMetrics(
  m: MetricoolPostMetrics | Record<string, unknown>,
): NormalizedPostMetrics {
  const r = m as Record<string, unknown>;
  const likes = pickNumberFrom(
    r.likes,
    r.likeCount,
    r.reactions,
    r.totalLikes,
    sumNumberFrom(r.organicLikes, r.promotedLikes),
  );
  const comments = pickNumberFrom(
    r.comments,
    r.commentCount,
    r.replies,
    r.totalReplies,
    sumNumberFrom(r.organicReplies, r.promotedReplies),
  );
  const shares = pickNumberFrom(
    r.shares,
    r.shareCount,
    r.retweets,
    r.reposts,
    r.totalRetweets,
    sumNumberFrom(r.organicRetweets, r.promotedRetweets, r.quotes, r.totalQuotes),
  );
  const reach = pickNumberFrom(r.reach, r.uniqueReach);
  const impressions = pickNumberFrom(
    r.impressionsTotal,
    r.impressions,
    r.totalImpressions,
    sumNumberFrom(r.organicImpressions, r.promotedImpressions),
    r.views,
    r.viewCount,
  );
  const video_views = pickNumberFrom(
    r.videoViews,
    r.totalVideoViews,
    sumNumberFrom(r.organicVideoViews, r.promotedVideoViews),
    r.plays,
    r.videoPlays,
    r.viewCount,
    r.views,
  );
  const saves = pickNumberFrom(r.saves, r.saved, r.savedCount, r.bookmarkCount);
  let eng_rate = pickNumberFrom(r.engagement, r.engagementRate, r.engagement_rate);
  if (!eng_rate) {
    // Gap #7 — usa reach quando >0, senão fallback pra impressions.
    const denominator = reach > 0 ? reach : impressions;
    if (denominator > 0) {
      eng_rate = ((likes + comments + shares + saves) / denominator) * 100;
    }
  }
  return {
    likes,
    comments,
    shares,
    reach,
    impressions,
    video_views,
    saves,
    eng_rate: Number.isFinite(eng_rate) ? eng_rate : 0,
    last_synced_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de alto nível — usados pelos handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapeia nossa platform string + content type pra `instagramData.type` Metricool.
 * Aceita só os campos que a API Metricool confirmadamente reconhece.
 */
export function buildInstagramData(
  contentType?: string,
  opts: {
    autoPublish?: boolean;
    showReelOnFeed?: boolean;
    shareTrialAutomatically?: boolean;
    audioName?: string;
    collaborators?: string[];
    tags?: any[];
  } = {},
): MetricoolInstagramData {
  const ct = contentType?.toLowerCase();
  let type: MetricoolInstagramData['type'] = 'POST';
  if (ct === 'reel' || ct === 'reels') type = 'REEL';
  else if (ct === 'story' || ct === 'stories') type = 'STORY';
  else if (ct === 'carousel') type = 'CAROUSEL';

  const data: MetricoolInstagramData = {
    type,
    autoPublish: opts.autoPublish !== false,
  };
  if (type === 'REEL') {
    if (opts.showReelOnFeed !== undefined) data.showReelOnFeed = opts.showReelOnFeed;
    if (opts.shareTrialAutomatically !== undefined) {
      data.shareTrialAutomatically = opts.shareTrialAutomatically;
    }
  }
  if (opts.audioName) data.audioName = opts.audioName;
  if (opts.collaborators?.length) data.collaborators = opts.collaborators.slice(0, 3);
  if (opts.tags?.length) data.tags = opts.tags;
  return data;
}

export function buildFacebookData(contentType?: string, title?: string): MetricoolFacebookData {
  const ct = contentType?.toLowerCase();
  let type: MetricoolFacebookData['type'] = 'POST';
  if (ct === 'reel' || ct === 'reels') type = 'REEL';
  else if (ct === 'story' || ct === 'stories') type = 'STORY';
  return { type, ...(title ? { title } : {}) };
}

/** Constrói body completo pra POST /v2/scheduler/posts. */
export interface BuildPostInput {
  text: string;
  publicationDate: MetricoolDateTimeInput;
  timezone?: string; // default 'America/Sao_Paulo'
  platforms: string[]; // ['instagram', 'twitter']
  mediaUrls?: string[];
  mediaAltText?: string[];
  firstCommentText?: string;
  contentType?: string; // 'post' | 'reel' | 'story' | 'carousel'
  draft?: boolean;
  videoThumbnailUrl?: string;
  videoCoverMilliseconds?: number;
  instagramAutoPublish?: boolean;
  instagramShowReelOnFeed?: boolean;
  instagramShareTrialAutomatically?: boolean;
  instagramAudioName?: string;
  instagramCollaborators?: string[];
  igTags?: any[];
  ytTitle?: string;
  ytCategory?: number;
  ttPrivacy?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  twitterReplySettings?: 'EVERYONE' | 'MENTIONED_USERS' | 'FOLLOWING' | 'VERIFIED';
  twitterPoll?: { options: string[]; durationMinutes: number };
}

export function buildScheduledPostBody(input: BuildPostInput): MetricoolScheduledPostBody {
  const tz = input.timezone || 'America/Sao_Paulo';
  const publicationDate = formatMetricoolDateTime(input.publicationDate, tz);
  const creationDate = formatMetricoolDateTime(new Date(), tz);
  const providers: MetricoolProviderStatus[] = input.platforms.map((p) => ({
    network: METRICOOL_PLATFORM_MAP[p] || p,
  }));

  const body: MetricoolScheduledPostBody = {
    publicationDate: { dateTime: publicationDate, timezone: tz },
    creationDate: { dateTime: creationDate, timezone: tz },
    text: input.text,
    providers,
    autoPublish: !input.draft,
    draft: !!input.draft,
    saveExternalMediaFiles: true,
    shortener: false,
    ...(input.firstCommentText ? { firstCommentText: input.firstCommentText } : {}),
    ...(input.mediaUrls?.length ? { media: input.mediaUrls } : {}),
    ...(input.mediaAltText?.length ? { mediaAltText: input.mediaAltText } : {}),
    ...(input.videoThumbnailUrl ? { videoThumbnailUrl: input.videoThumbnailUrl } : {}),
    ...(typeof input.videoCoverMilliseconds === 'number'
      ? { videoCoverMilliseconds: input.videoCoverMilliseconds }
      : {}),
  };

  // Platform-specific data
  if (input.platforms.includes('instagram')) {
    body.instagramData = buildInstagramData(input.contentType, {
      autoPublish: input.instagramAutoPublish,
      showReelOnFeed: input.instagramShowReelOnFeed,
      shareTrialAutomatically: input.instagramShareTrialAutomatically,
      audioName: input.instagramAudioName,
      collaborators: input.instagramCollaborators,
      tags: input.igTags,
    });
  }
  if (input.platforms.includes('facebook')) {
    body.facebookData = buildFacebookData(input.contentType);
  }
  if (input.platforms.includes('twitter') || input.platforms.includes('x')) {
    body.twitterData = {
      type: input.twitterPoll ? 'poll' : 'post',
      ...(input.twitterReplySettings ? { replySettings: input.twitterReplySettings } : {}),
      ...(input.twitterPoll ? { poll: input.twitterPoll } : {}),
    };
  }
  if (input.platforms.includes('youtube')) {
    body.youtubeData = {
      title: input.ytTitle || input.text.slice(0, 100),
      type: 'public',
      selfDeclaredMadeForKids: 'no',
      ...(input.ytCategory ? { categoryId: input.ytCategory } : {}),
    };
  }
  if (input.platforms.includes('tiktok')) {
    body.tiktokData = {
      privacyLevel: input.ttPrivacy || 'PUBLIC_TO_EVERYONE',
      comment: true,
      duet: false,
      stitch: false,
    };
  }

  return body;
}
