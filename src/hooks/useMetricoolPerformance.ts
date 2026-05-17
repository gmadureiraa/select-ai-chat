// Hooks consolidados pra puxar TUDO da Metricool API pra Performance Tab.
//
// Substitui usePerformanceMetrics + useInstagramPosts + useTwitterPosts +
// useLinkedInPosts + useYouTubeVideos (todas Apify-backed) por queries
// diretas na Metricool API via /api/metricool-analytics + metricool-summary.
import { useQuery } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiInvoke';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricoolPost {
  id?: string | number;
  postId?: string;
  text?: string;
  content?: string;
  caption?: string;
  url?: string;
  permalink?: string;
  imageUrl?: string;
  thumbnail?: string;
  mediaUrl?: string;
  date?: string;
  publishedAt?: string | { dateTime?: string; timezone?: string };
  publishedDate?: string | { dateTime?: string; timezone?: string };
  publishDate?: string;
  createdAt?: string | number | { dateTime?: string; timezone?: string };
  type?: string;
  likes?: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  reposts?: number;
  retweets?: number;
  saves?: number;
  saved?: number;
  reach?: number;
  impressions?: number;
  views?: number;
  videoViews?: number;
  engagementRate?: number;
  [key: string]: unknown;
}

export type MetricoolNetwork =
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'tiktok'
  | 'youtube'
  | 'threads'
  | 'pinterest'
  | 'bluesky';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isoFromDays(daysAgo: number): string {
  return metricoolLocalDateTime(new Date(Date.now() - daysAgo * 86400_000));
}

function isoNow(): string {
  return metricoolLocalDateTime(new Date());
}

function metricoolLocalDateTime(date: Date, timezone = 'America/Sao_Paulo'): string {
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
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || '00';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function sumNumbers(...values: unknown[]): number | undefined {
  let hasValue = false;
  let total = 0;
  for (const value of values) {
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
 * Normaliza posts da Metricool API. A API retorna `postId` / `reelId` /
 * `videoId` / `storyId` / etc — NUNCA `id` puro. Sem isso o frontend usa
 * `String(post.id)` que vira `"undefined"`, colidindo todas as React keys e
 * quebrando ordenação, hover e click handlers no grid de Instagram.
 *
 * Bug ativo até 2026-05-16. Fix idempotente: se já houver `id`, preserva.
 */
export function normalizeMetricoolPost(p: any): MetricoolPost {
  if (!p || typeof p !== 'object') return p;
  if (p.id != null && p.id !== '') return p as MetricoolPost;
  const candidate =
    p.postId ??
    p.reelId ??
    p.videoId ??
    p.storyId ??
    p.tweetId ??
    p.urn ??
    p.url ??
    p.permalink ??
    p.shareUrl ??
    null;
  if (candidate != null) {
    return { ...p, id: String(candidate) } as MetricoolPost;
  }
  // Stories IG: Metricool NÃO retorna id/url — só businessId + publishedAt.
  // Assina por publishedAt + businessId pra evitar React-key collision quando
  // múltiplas stories aparecem juntas.
  const pubAt =
    (p.publishedAt && typeof p.publishedAt === 'object' && p.publishedAt.dateTime) ||
    p.publishedAt ||
    p.date ||
    p.publishedDate ||
    '';
  const fp = `${pubAt}-${p.businessId ?? p.mediaId ?? ''}-${(p.content ?? p.text ?? p.caption ?? '').slice(0, 30)}`;
  return { ...p, id: fp || `metricool-${Math.random().toString(36).slice(2, 10)}` } as MetricoolPost;
}

function normalizeList(arr: unknown): MetricoolPost[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeMetricoolPost);
}

// ─────────────────────────────────────────────────────────────────────────────
// Posts genérico por plataforma
// ─────────────────────────────────────────────────────────────────────────────

export function useMetricoolPosts(
  clientId: string,
  network: MetricoolNetwork,
  period: number = 30,
) {
  return useQuery({
    queryKey: ['metricool-posts', clientId, network, period],
    queryFn: async (): Promise<MetricoolPost[]> => {
      const { data, error } = await apiInvoke('metricool-analytics', {
        body: {
          clientId,
          mode: 'posts',
          network,
          from: isoFromDays(period),
          to: isoNow(),
        },
      });
      if (error) throw error;
      return normalizeList((data as any)?.posts);
    },
    enabled: !!clientId && !!network,
    staleTime: 1000 * 60 * 5,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Posts locais (tabela metricool_posts populada por cron-metricool-backfill-posts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lê posts da tabela local `metricool_posts` (em vez de chamar Metricool API
 * direto). Sobrevive ao window de 30-90d da API e responde mais rápido.
 *
 * Cron `cron-metricool-backfill-posts` (5h UTC) atualiza a tabela todo dia.
 * Use isto pra TODA leitura de "últimos 30/60/90 dias" — só caia pra
 * `useMetricoolPosts` (API direta) em janelas mais curtas que ainda não
 * foram backfilled (ex: posts publicados nas últimas horas).
 */
export function useMetricoolPostsLocal(
  clientId: string,
  network: MetricoolNetwork,
  period: number = 30,
  options: { limit?: number } = {},
) {
  return useQuery({
    queryKey: ['metricool-posts-local', clientId, network, period, options.limit ?? 200],
    queryFn: async (): Promise<MetricoolPost[]> => {
      const { data, error } = await apiInvoke('metricool-posts-local', {
        body: {
          clientId,
          network,
          from: isoFromDays(period),
          to: isoNow(),
          limit: options.limit ?? 200,
        },
      });
      if (error) throw error;
      return normalizeList((data as any)?.posts);
    },
    enabled: !!clientId && !!network,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Estratégia "local first, API fallback": tenta `metricool_posts` local;
 * se vazio, cai pra Metricool API direta. Útil pra clientes recém-mapeados
 * onde o cron ainda não rodou.
 */
export function useMetricoolPostsHybrid(
  clientId: string,
  network: MetricoolNetwork,
  period: number = 30,
) {
  const local = useMetricoolPostsLocal(clientId, network, period);
  const remoteEnabled = local.isFetched && (local.data?.length ?? 0) === 0;
  const remote = useQuery({
    queryKey: ['metricool-posts-hybrid-remote', clientId, network, period],
    queryFn: async (): Promise<MetricoolPost[]> => {
      const { data, error } = await apiInvoke('metricool-analytics', {
        body: {
          clientId,
          mode: 'posts',
          network,
          from: isoFromDays(period),
          to: isoNow(),
        },
      });
      if (error) throw error;
      return normalizeList((data as any)?.posts);
    },
    enabled: !!clientId && !!network && remoteEnabled,
    staleTime: 1000 * 60 * 5,
  });

  return {
    data: (local.data?.length ?? 0) > 0 ? local.data : remote.data ?? [],
    isLoading: local.isLoading || (remoteEnabled && remote.isLoading),
    error: local.error || remote.error,
    source: (local.data?.length ?? 0) > 0 ? ('local' as const) : ('remote' as const),
  };
}

/**
 * LinkedIn personal profiles NÃO retornam posts pela Metricool API (apenas
 * Company Pages com OAuth full). Solução: scrape via Apify
 * (`fetch-linkedin-posts-apify`) e persiste em `metricool_posts` local.
 *
 * Esse hook:
 *   1. Lê posts LI da tabela local
 *   2. Se vazio e ainda não tentou esta sessão, dispara scrape uma vez
 *   3. Re-fetch após scrape resolver
 *
 * Network deve ser 'linkedin'. Pra outras redes use useMetricoolPosts direto.
 */
export function useLinkedInPostsHybrid(clientId: string, period: number = 30) {
  const local = useMetricoolPostsLocal(clientId, 'linkedin', period);
  // Dispara scrape em background se local vazio (uma vez por mount).
  // Use useEffect import dinamicamente pra não quebrar SSR; aqui simples
  // com flag estática no module.
  const _key = `${clientId}:${period}`;
  if (
    typeof window !== 'undefined' &&
    clientId &&
    local.isFetched &&
    (local.data?.length ?? 0) === 0 &&
    !linkedInScrapeAttempts.has(_key)
  ) {
    linkedInScrapeAttempts.add(_key);
    apiInvoke('fetch-linkedin-posts-apify', { body: { clientId } })
      .then(({ data, error }) => {
        if (error) {
          console.warn('[useLinkedInPostsHybrid] scrape failed:', error);
          // libera retry depois
          setTimeout(() => linkedInScrapeAttempts.delete(_key), 5 * 60 * 1000);
          return;
        }
        if ((data as any)?.skipped) {
          // cooldown — não refetch agora
          return;
        }
        // Sucesso: invalida cache pra refetch
        local.refetch();
      })
      .catch((e) => {
        console.warn('[useLinkedInPostsHybrid] scrape exception:', e);
        setTimeout(() => linkedInScrapeAttempts.delete(_key), 5 * 60 * 1000);
      });
  }
  return local;
}

// Set de tentativas em curso pra evitar storm de scrapes (~$0.05/call).
// Limpa em retry-after de 5min em caso de erro.
const linkedInScrapeAttempts = new Set<string>();

// ─────────────────────────────────────────────────────────────────────────────
// Reels (IG/FB) e Stories (IG/FB)
// ─────────────────────────────────────────────────────────────────────────────

export function useMetricoolReels(
  clientId: string,
  network: 'instagram' | 'facebook' = 'instagram',
  period: number = 30,
) {
  return useQuery({
    queryKey: ['metricool-reels', clientId, network, period],
    queryFn: async (): Promise<MetricoolPost[]> => {
      const { data, error } = await apiInvoke('metricool-analytics', {
        body: {
          clientId,
          mode: 'reels',
          network,
          from: isoFromDays(period),
          to: isoNow(),
        },
      });
      if (error) throw error;
      return normalizeList((data as any)?.reels);
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useMetricoolStories(
  clientId: string,
  network: 'instagram' | 'facebook' = 'instagram',
  period: number = 7,
) {
  return useQuery({
    queryKey: ['metricool-stories', clientId, network, period],
    queryFn: async (): Promise<MetricoolPost[]> => {
      const { data, error } = await apiInvoke('metricool-analytics', {
        body: {
          clientId,
          mode: 'stories',
          network,
          from: isoFromDays(period),
          to: isoNow(),
        },
      });
      if (error) throw error;
      return normalizeList((data as any)?.stories);
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 5,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand summary (drop-in já existente — re-exporta com nome melhor)
// ─────────────────────────────────────────────────────────────────────────────

export { useMetricoolAnalytics as useMetricoolBrandSummary } from './useMetricoolAnalytics';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de cálculo (usados pelos sub-componentes)
// ─────────────────────────────────────────────────────────────────────────────

export function n(v: unknown, fallback = 0): number {
  const num = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Denominador real pra eng rate: reach quando existe, senão impressions/views.
 * Twitter, Threads e LinkedIn frequentemente não retornam `reach` mas têm
 * `impressions` — sem isso, eng% cai a 0%.
 */
function denomFor(p: MetricoolPost): number {
  const reach = n(p.reach);
  if (reach > 0) return reach;
  const raw = p as Record<string, unknown>;
  return firstNumber(
    raw.impressionsTotal,
    p.impressions,
    raw.totalImpressions,
    sumNumbers(raw.organicImpressions, raw.promotedImpressions),
    p.views,
    p.videoViews,
    raw.viewCount,
  );
}

export function getPostMetric(p: MetricoolPost, key: 'likes' | 'comments' | 'shares' | 'reach' | 'impressions' | 'views' | 'saves' | 'engagement'): number {
  const raw = p as Record<string, unknown>;
  if (key === 'likes') {
    return firstNumber(
      p.likes,
      raw.likeCount,
      p.reactions,
      raw.totalLikes,
      sumNumbers(raw.organicLikes, raw.promotedLikes),
    );
  }
  if (key === 'comments') {
    return firstNumber(
      p.comments,
      raw.commentCount,
      raw.replies,
      raw.totalReplies,
      sumNumbers(raw.organicReplies, raw.promotedReplies),
    );
  }
  if (key === 'shares') {
    return firstNumber(
      p.shares,
      raw.shareCount,
      p.reposts,
      p.retweets,
      raw.totalRetweets,
      sumNumbers(raw.organicRetweets, raw.promotedRetweets, raw.quotes, raw.totalQuotes),
    );
  }
  if (key === 'reach') return n(p.reach);
  if (key === 'impressions') {
    return firstNumber(
      raw.impressionsTotal,
      p.impressions,
      raw.totalImpressions,
      sumNumbers(raw.organicImpressions, raw.promotedImpressions),
      p.views,
      p.videoViews,
      raw.viewCount,
    );
  }
  if (key === 'views') {
    // IG video fields variam: videoViews (Reels), views, plays. Fallback impressions só se nada de view existir.
    return firstNumber(
      p.videoViews,
      raw.totalVideoViews,
      sumNumbers(raw.organicVideoViews, raw.promotedVideoViews),
      p.views,
      raw.viewCount,
      raw.plays,
      p.impressions,
    );
  }
  if (key === 'saves') return firstNumber(p.saves, p.saved, raw.savedCount);
  if (key === 'engagement') {
    const directEngagement = firstNumber(raw.engagement, p.engagementRate);
    if (directEngagement > 0) return directEngagement;
    const denom = denomFor(p);
    if (denom === 0) return 0;
    const eng = getPostMetric(p, 'likes') + getPostMetric(p, 'comments') + getPostMetric(p, 'shares');
    return (eng / denom) * 100;
  }
  return 0;
}

export function getPostTimestamp(p: MetricoolPost): number {
  let raw: unknown =
    p.date ||
    p.publishedAt ||
    p.publishedDate ||
    p.publishDate ||
    p.createdAt ||
    (p as Record<string, unknown>).timestamp ||
    (p as Record<string, unknown>).createTime;

  if (raw && typeof raw === 'object' && 'dateTime' in raw) {
    raw = (raw as { dateTime?: string }).dateTime;
  }
  if (!raw) return 0;
  const timestamp = typeof raw === 'number'
    ? raw > 10_000_000_000 ? raw : raw * 1000
    : new Date(String(raw)).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function aggregatePostsMetrics(posts: MetricoolPost[]) {
  let imp = 0, likes = 0, comments = 0, shares = 0, reach = 0, views = 0, saves = 0;
  for (const p of posts) {
    imp += getPostMetric(p, 'impressions');
    likes += getPostMetric(p, 'likes');
    comments += getPostMetric(p, 'comments');
    shares += getPostMetric(p, 'shares');
    reach += getPostMetric(p, 'reach');
    views += getPostMetric(p, 'views');
    saves += getPostMetric(p, 'saves');
  }
  const eng = likes + comments + shares;
  // Denominador da agregada: reach se houver, senão impressions (ou views).
  // Reflete redes sem reach (Twitter/Threads/LI) — antes tudo virava 0%.
  const denom = Math.max(reach, imp);
  return {
    totalImpressions: imp,
    totalLikes: likes,
    totalComments: comments,
    totalShares: shares,
    totalReach: reach,
    totalViews: views,
    totalSaves: saves,
    avgEngagementRate: denom > 0 ? (eng / denom) * 100 : 0,
    postsCount: posts.length,
  };
}

export function topPostsByMetric(
  posts: MetricoolPost[],
  metric: 'engagement' | 'reach' | 'likes' | 'comments' | 'impressions' | 'views' | 'saves',
  limit = 5,
): MetricoolPost[] {
  return [...posts]
    .sort((a, b) => getPostMetric(b, metric) - getPostMetric(a, metric))
    .slice(0, limit);
}
