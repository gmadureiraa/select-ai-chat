// Metricool Public API client wrapper.
//
// Substitui (ou complementa) Postiz como provider de scheduling/publish/analytics.
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
  const userToken = process.env.METRICOOL_USER_TOKEN;
  const userId = process.env.METRICOOL_USER_ID;
  if (!userToken) throw new Error('METRICOOL_USER_TOKEN not configured');
  if (!userId) throw new Error('METRICOOL_USER_ID not configured');
  const apiUrl = (process.env.METRICOOL_API_URL || METRICOOL_DEFAULT_BASE).replace(/\/$/, '');
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

export interface MetricoolProviderStatus {
  network: string; // facebook | instagram | twitter | linkedin | tiktok | youtube | threads | pinterest | bluesky | gmb
  id?: string;
  status?: 'PUBLISHED' | 'PUBLISHING' | 'PENDING' | 'ERROR' | 'DRAFT';
  publicUrl?: string;
  detailedStatus?: string;
}

export interface MetricoolInstagramData {
  type?: 'POST' | 'REEL' | 'STORY' | 'CAROUSEL';
  autoPublish?: boolean;
  showReelOnFeed?: boolean;
  tags?: Array<{ username: string; x?: number; y?: number }>;
  productTags?: Array<unknown>;
  carouselTags?: Record<string, Array<unknown>>;
}

export interface MetricoolTwitterData {
  type?: 'TWEET' | 'THREAD';
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
  // userId é OBRIGATÓRIO em toda call (vai como query param)
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

  const r = await fetch(url.toString(), {
    method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

  const text = await r.text();
  if (!r.ok) {
    let msg = `Metricool ${r.status}`;
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = typeof j.error === 'string' ? j.error : JSON.stringify(j.error);
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

// ─────────────────────────────────────────────────────────────────────────────
// Brand / Profile management
// ─────────────────────────────────────────────────────────────────────────────

/** Lista todas as brands (= clientes) da conta Metricool. */
export async function listBrands(cfg: MetricoolConfig): Promise<MetricoolBrand[]> {
  const data = await metricoolFetch<MetricoolBrand[]>(cfg, '/admin/simpleProfiles');
  return Array.isArray(data) ? data : [];
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
  return metricoolFetch(cfg, '/v2/scheduler/posts', {
    blogId,
    method: 'POST',
    body,
  });
}

export async function updateScheduledPost(
  cfg: MetricoolConfig,
  blogId: string | number,
  postId: number | string,
  patch: Partial<MetricoolScheduledPostBody>,
): Promise<any> {
  return metricoolFetch(cfg, `/v2/scheduler/posts/${postId}`, {
    blogId,
    method: 'PUT',
    body: patch,
  });
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
  return metricoolFetch(cfg, `/v2/scheduler/posts/${postId}`, { blogId });
}

export async function listScheduledPosts(
  cfg: MetricoolConfig,
  blogId: string | number,
  startDate: string,
  endDate: string,
): Promise<any[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/scheduler/posts', {
    blogId,
    search: { startDate, endDate },
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

/** Timeline de uma métrica específica (followers, impressions, reach, etc). */
export async function getTimeline(
  cfg: MetricoolConfig,
  blogId: string | number,
  metric: string, // e.g. "igFollowers", "fbFans", "twFollowers"
  start: string,
  end: string,
): Promise<Array<{ date: string; value: number }>> {
  const data = await metricoolFetch<any>(cfg, `/stats/timeling/${metric}`, {
    blogId,
    search: { start, end },
  });
  if (Array.isArray(data)) return data;
  return data?.data || data?.timeline || [];
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

export async function listInboxConversations(
  cfg: MetricoolConfig,
  blogId: string | number,
  filters: { status?: 'OPEN' | 'CLOSED' | 'PENDING'; limit?: number; offset?: number } = {},
): Promise<MetricoolInboxConversation[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/inbox/conversations', {
    blogId,
    search: {
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

export async function listPostComments(
  cfg: MetricoolConfig,
  blogId: string | number,
  filters: { network?: string; limit?: number; offset?: number } = {},
): Promise<any[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/inbox/post-comments', {
    blogId,
    search: filters as Record<string, string | number>,
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

export async function listReviews(
  cfg: MetricoolConfig,
  blogId: string | number,
  filters: { network?: string } = {},
): Promise<any[]> {
  const data = await metricoolFetch<any>(cfg, '/v2/inbox/reviews', {
    blogId,
    search: filters as Record<string, string>,
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
// Helpers de alto nível — usados pelos handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapeia nossa platform string + content type pra `instagramData.type` Metricool.
 */
export function buildInstagramData(
  contentType?: string,
  opts: { autoPublish?: boolean; showReelOnFeed?: boolean; tags?: any[] } = {},
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
  if (type === 'REEL' && opts.showReelOnFeed !== undefined) {
    data.showReelOnFeed = opts.showReelOnFeed;
  }
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
  publicationDate: string; // ISO 8601 com timezone
  timezone?: string; // default 'America/Sao_Paulo'
  platforms: string[]; // ['instagram', 'twitter']
  mediaUrls?: string[];
  mediaAltText?: string[];
  firstCommentText?: string;
  contentType?: string; // 'post' | 'reel' | 'story' | 'carousel'
  draft?: boolean;
  videoThumbnailUrl?: string;
  igTags?: any[];
  ytTitle?: string;
  ytCategory?: number;
  ttPrivacy?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  twitterReplySettings?: 'EVERYONE' | 'MENTIONED_USERS' | 'FOLLOWING' | 'VERIFIED';
  twitterPoll?: { options: string[]; durationMinutes: number };
}

export function buildScheduledPostBody(input: BuildPostInput): MetricoolScheduledPostBody {
  const tz = input.timezone || 'America/Sao_Paulo';
  const providers: MetricoolProviderStatus[] = input.platforms.map((p) => ({
    network: METRICOOL_PLATFORM_MAP[p] || p,
  }));

  const body: MetricoolScheduledPostBody = {
    publicationDate: { dateTime: input.publicationDate, timezone: tz },
    creationDate: { dateTime: new Date().toISOString().slice(0, 19), timezone: tz },
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
  };

  // Platform-specific data
  if (input.platforms.includes('instagram')) {
    body.instagramData = buildInstagramData(input.contentType, { tags: input.igTags });
  }
  if (input.platforms.includes('facebook')) {
    body.facebookData = buildFacebookData(input.contentType);
  }
  if (input.platforms.includes('twitter') || input.platforms.includes('x')) {
    body.twitterData = {
      type: 'TWEET',
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
