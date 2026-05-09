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
  publishedAt?: string;
  publishDate?: string;
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
  return new Date(Date.now() - daysAgo * 86400_000).toISOString().slice(0, 19);
}

function isoNow(): string {
  return new Date().toISOString().slice(0, 19);
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
      return (data as any)?.posts || [];
    },
    enabled: !!clientId && !!network,
    staleTime: 1000 * 60 * 5,
  });
}

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
      return (data as any)?.reels || [];
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
      return (data as any)?.stories || [];
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
  return n(p.impressions ?? p.views ?? p.videoViews);
}

export function getPostMetric(p: MetricoolPost, key: 'likes' | 'comments' | 'shares' | 'reach' | 'impressions' | 'views' | 'saves' | 'engagement'): number {
  if (key === 'likes') return n(p.likes ?? p.reactions);
  if (key === 'comments') return n(p.comments);
  if (key === 'shares') return n(p.shares ?? p.reposts ?? p.retweets);
  if (key === 'reach') return n(p.reach);
  if (key === 'impressions') return n(p.impressions ?? p.views ?? p.videoViews);
  if (key === 'views') {
    // IG video fields variam: videoViews (Reels), views, plays. Fallback impressions só se nada de view existir.
    return n(p.videoViews ?? p.views ?? (p as any).plays ?? p.impressions);
  }
  if (key === 'saves') return n(p.saves ?? p.saved ?? (p as any).savedCount);
  if (key === 'engagement') {
    if (p.engagementRate) return n(p.engagementRate);
    const denom = denomFor(p);
    if (denom === 0) return 0;
    const eng = getPostMetric(p, 'likes') + getPostMetric(p, 'comments') + getPostMetric(p, 'shares');
    return (eng / denom) * 100;
  }
  return 0;
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
