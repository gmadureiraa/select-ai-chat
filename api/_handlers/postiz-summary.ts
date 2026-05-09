// Postiz summary handler — retorna shape compatível com `late-analytics` pra
// drop-in no front (KaiAnalyticsTab + KaiPerformanceTab).
//
// Strategy:
//   1. Busca todas client_social_credentials do clientId com postiz_integration_id.
//   2. Para cada plataforma, chama Postiz /analytics/{integrationId} em paralelo.
//   3. Parseia PostizAnalyticsMetric[] → PlatformMetrics shape (followers/aggregates).
//   4. Retorna { success, lastSyncedAt, platforms: { instagram: {...}, twitter: {...} } }
//
// Não puxa recentPosts (precisaria N requests adicionais e estoura rate limit).
// Pra recentPosts use o handler postiz-list-posts separado (ou Performance Tab que
// já lê de `*_posts` tables locais).
import { authedPost } from '../_lib/handler.js';
import { query } from '../_lib/db.js';
import {
  getPostizConfig,
  getPlatformAnalytics,
  type PostizAnalyticsMetric,
} from '../_lib/integrations/postiz.js';

interface PlatformMetrics {
  followerStats: {
    current: number;
    change7d: number;
    change30d: number;
    history: Array<{ date: string; followers: number }>;
  };
  recentPosts: Array<any>;
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

interface PostizSummaryResponse {
  success: boolean;
  lastSyncedAt: string;
  platforms: Record<string, PlatformMetrics>;
  errors?: Record<string, string>;
}

function findMetric(metrics: PostizAnalyticsMetric[], labelMatch: string): number {
  const m = metrics.find((x) => x.label?.toLowerCase().includes(labelMatch.toLowerCase()));
  if (!m || !m.data?.length) return 0;
  const last = m.data[m.data.length - 1];
  return Number(last?.total ?? 0);
}

function findMetricSum(metrics: PostizAnalyticsMetric[], labelMatch: string): number {
  const m = metrics.find((x) => x.label?.toLowerCase().includes(labelMatch.toLowerCase()));
  if (!m || !m.data?.length) return 0;
  return m.data.reduce((acc, d) => acc + Number(d.total ?? 0), 0);
}

function buildHistory(metrics: PostizAnalyticsMetric[], labelMatch: string): Array<{ date: string; followers: number }> {
  const m = metrics.find((x) => x.label?.toLowerCase().includes(labelMatch.toLowerCase()));
  if (!m || !m.data?.length) return [];
  return m.data.map((d) => ({ date: d.date, followers: Number(d.total ?? 0) }));
}

function calcChange(history: Array<{ date: string; followers: number }>, days: number): number {
  if (history.length < 2) return 0;
  const last = history[history.length - 1];
  const cutoff = new Date(Date.now() - days * 86400_000);
  // Encontra o snapshot mais antigo dentro do window de N dias.
  const old = history.find((h) => new Date(h.date) >= cutoff) ?? history[0];
  return last.followers - old.followers;
}

export default authedPost<PostizSummaryResponse>(async ({ body }) => {
  const { clientId, period = 30 } = body;
  if (!clientId) throw new Error('clientId obrigatório');

  let cfg;
  try {
    cfg = getPostizConfig();
  } catch (e: any) {
    return {
      success: false,
      lastSyncedAt: new Date().toISOString(),
      platforms: {},
      errors: { _config: e.message },
    };
  }

  const credentials = await query<any>(
    `SELECT platform, account_id, account_name, metadata, is_valid
       FROM client_social_credentials
      WHERE client_id = $1 AND is_valid = true`,
    [clientId],
  );

  if (credentials.length === 0) {
    return {
      success: true,
      lastSyncedAt: new Date().toISOString(),
      platforms: {},
    };
  }

  const platforms: Record<string, PlatformMetrics> = {};
  const errors: Record<string, string> = {};

  // Fan-out paralelo, max 5 simultâneos pra não estourar rate limit Postiz (30/h por key).
  const work = credentials.map(async (cred: any) => {
    const meta = (cred.metadata as any) || {};
    const integrationId = meta.postiz_integration_id || cred.account_id;
    if (!integrationId) return;
    try {
      const metrics = await getPlatformAnalytics(cfg, integrationId, period);
      const history = buildHistory(metrics, 'follower');
      const current = history.length > 0 ? history[history.length - 1].followers : findMetric(metrics, 'follower');
      const change7d = calcChange(history, 7);
      const change30d = calcChange(history, 30);

      platforms[cred.platform] = {
        followerStats: {
          current,
          change7d,
          change30d,
          history,
        },
        recentPosts: [], // não puxa aqui (rate limit) — Performance Tab lê de tabelas locais
        aggregates: {
          avgEngagementRate: 0, // Postiz não retorna eng rate direto; calcular se Reach disponível
          totalImpressions: findMetricSum(metrics, 'impression'),
          totalLikes: findMetricSum(metrics, 'like'),
          totalComments: findMetricSum(metrics, 'comment'),
          totalShares: findMetricSum(metrics, 'share'),
          totalReach: findMetricSum(metrics, 'reach'),
          postsCount: 0,
        },
      };

      // Calcula avgEngagementRate se houver reach + likes/comments
      const agg = platforms[cred.platform].aggregates;
      if (agg.totalReach > 0) {
        const engagement = agg.totalLikes + agg.totalComments + agg.totalShares;
        agg.avgEngagementRate = (engagement / agg.totalReach) * 100;
      }
    } catch (e: any) {
      errors[cred.platform] = e.message || String(e);
    }
  });

  // batch de 5
  const batches: Array<Promise<void>[]> = [];
  for (let i = 0; i < work.length; i += 5) batches.push(work.slice(i, i + 5));
  for (const batch of batches) await Promise.all(batch);

  return {
    success: true,
    lastSyncedAt: new Date().toISOString(),
    platforms,
    ...(Object.keys(errors).length > 0 ? { errors } : {}),
  };
});
