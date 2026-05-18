// Metricool summary handler — drop-in pro postiz-summary / late-analytics.
// Retorna shape PlatformMetrics compatível com KaiAnalyticsTab.
import { authedPost } from '../_lib/handler.js';
import { assertClientAccess } from '../_lib/access.js';
import { getMetricoolConfig, resolveBlogId, getNetworkPosts, getInstagramReels, getInstagramStories, getTimeline } from '../_lib/integrations/metricool.js';

interface PlatformMetrics {
  followerStats: {
    current: number;
    change7d: number;
    change30d: number;
    history: Array<{ date: string; followers: number }>;
  };
  recentPosts: Array<{
    id: string;
    content: string;
    publishedAt: string;
    url: string;
    metrics: {
      impressions: number;
      reach: number;
      likes: number;
      comments: number;
      shares: number;
      engagementRate: number;
    };
  }>;
  aggregates: {
    avgEngagementRate: number;
    totalImpressions: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalReach: number;
    postsCount: number;
  };
}

interface SummaryResponse {
  success: boolean;
  lastSyncedAt: string;
  platforms: Record<string, PlatformMetrics>;
  errors?: Record<string, string>;
}

// Timeline "followers" — Metricool aceita métricas DIFERENTES pra cada rede,
// e quase TODAS exigem `subject` no endpoint /v2/analytics/timelines.
// Mapeamentos abaixo foram VALIDADOS via curl (2026-05-09):
//
//   instagram:  network=instagram&subject=account&metric=followers      -> ok (1 ponto/dia)
//   facebook:   network=facebook&subject=account&metric=pageFollows     -> ok (série diária)
//   youtube:    network=youtube&subject=account&metric=totalSubscribers -> ok
//   threads:    network=threads&subject=account&metric=followers_count  -> ok (1 ponto/dia)
//   linkedin:   network=linkedin&subject=account&metric=followers       -> ok (sem subject = 500)
//   tiktok:     network=tiktok&subject=account&metric=followers_count   -> ok
//
// NÃO suportadas pelo timelines (Metricool não expõe followers history):
//   twitter:    valid values=[postsCount] (sem followers)
//   pinterest/bluesky: dependem de connection do blog
//
// Histórico curto: para Instagram/Threads/TikTok/LinkedIn/YouTube a Metricool
// só retorna ~1 ponto/dia (snapshot atual), então o gráfico fica praticamente
// flat. Facebook é a exceção e retorna série diária real.
const TIMELINE_FOLLOWER_METRICS: Record<string, { metric: string; subject?: string }> = {
  instagram: { metric: 'followers', subject: 'account' },
  facebook: { metric: 'pageFollows', subject: 'account' },
  youtube: { metric: 'totalSubscribers', subject: 'account' },
  threads: { metric: 'followers_count', subject: 'account' },
  linkedin: { metric: 'followers', subject: 'account' },
  tiktok: { metric: 'followers_count', subject: 'account' },
};

const ANALYTICS_NETWORKS = ['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'threads', 'youtube'] as const;

function n(v: unknown, fallback = 0): number {
  const num = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(num) ? num : fallback;
}

function aggregatePosts(posts: any[]): PlatformMetrics['aggregates'] {
  let imp = 0, likes = 0, comments = 0, shares = 0, reach = 0;
  for (const p of posts) {
    imp += n(p.impressions ?? p.views ?? p.videoViews);
    likes += n(p.likes ?? p.reactions);
    comments += n(p.comments);
    shares += n(p.shares ?? p.retweets ?? p.reposts);
    reach += n(p.reach);
  }
  const eng = likes + comments + shares;
  return {
    avgEngagementRate: reach > 0 ? (eng / reach) * 100 : 0,
    totalImpressions: imp,
    totalLikes: likes,
    totalComments: comments,
    totalShares: shares,
    totalReach: reach,
    postsCount: posts.length,
  };
}

function mapPosts(posts: any[]): PlatformMetrics['recentPosts'] {
  return posts.slice(0, 12).map((p) => ({
    id: String(p.id ?? p.postId ?? Math.random()),
    content: p.text ?? p.caption ?? p.content ?? '',
    publishedAt: p.date ?? p.publishedAt ?? p.timestamp ?? '',
    url: p.url ?? p.permalink ?? '',
    metrics: {
      impressions: n(p.impressions ?? p.views),
      reach: n(p.reach),
      likes: n(p.likes ?? p.reactions),
      comments: n(p.comments),
      shares: n(p.shares ?? p.retweets),
      engagementRate: n(p.engagementRate),
    },
  }));
}

function calcChange(history: Array<{ date: string; followers: number }>, days: number): number {
  if (history.length < 2) return 0;
  const last = history[history.length - 1];
  const cutoff = new Date(Date.now() - days * 86400_000);
  const old = history.find((h) => new Date(h.date) >= cutoff) ?? history[0];
  return last.followers - old.followers;
}

export default authedPost(async ({ body, user }): Promise<SummaryResponse> => {
  const { clientId, period = 30, blogId: directBlogId } = body;
  if (clientId) await assertClientAccess(user.id, clientId);

  let cfg;
  try {
    cfg = getMetricoolConfig();
  } catch (e: any) {
    return {
      success: false,
      lastSyncedAt: new Date().toISOString(),
      platforms: {},
      errors: { _config: e.message },
    };
  }

  const blogId = directBlogId || (clientId ? await resolveBlogId(clientId) : null);
  if (!blogId) {
    return {
      success: false,
      lastSyncedAt: new Date().toISOString(),
      platforms: {},
      errors: { _config: 'Cliente sem blog Metricool mapeado' },
    };
  }

  const now = new Date();
  const fromDate = new Date(now.getTime() - period * 86400_000);
  const from = fromDate.toISOString().slice(0, 19);
  const to = now.toISOString().slice(0, 19);

  const platforms: Record<string, PlatformMetrics> = {};
  const errors: Record<string, string> = {};

  // Fan-out paralelo por plataforma
  await Promise.all(
    ANALYTICS_NETWORKS.map(async (network) => {
      try {
        const tlConfig = TIMELINE_FOLLOWER_METRICS[network];
        const [posts, timelineSeries] = await Promise.all([
          getNetworkPosts(cfg, blogId, network, from, to).catch(() => []),
          tlConfig
            ? getTimeline(
                cfg,
                blogId,
                network,
                tlConfig.metric,
                from,
                to,
                undefined,
                tlConfig.subject,
              ).catch(() => [])
            : Promise.resolve([]),
        ]);

        const history = (timelineSeries as Array<{ date: string; value: number }>)
          .map((t) => ({ date: t.date, followers: n(t.value) }))
          .filter((h) => h.date);

        const current = history.length > 0 ? history[history.length - 1].followers : 0;

        const allPosts: any[] = [...posts];

        // IG: anexa Reels e Stories ao posts agregados
        if (network === 'instagram') {
          const [reels, stories] = await Promise.all([
            getInstagramReels(cfg, blogId, from, to).catch(() => []),
            getInstagramStories(cfg, blogId, from, to).catch(() => []),
          ]);
          allPosts.push(...reels, ...stories);
        }

        platforms[network] = {
          followerStats: {
            current,
            change7d: calcChange(history, 7),
            change30d: calcChange(history, 30),
            history,
          },
          recentPosts: mapPosts(allPosts),
          aggregates: aggregatePosts(allPosts),
        };
      } catch (e: any) {
        errors[network] = e.message || String(e);
      }
    }),
  );

  return {
    success: true,
    lastSyncedAt: new Date().toISOString(),
    platforms,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  };
});
