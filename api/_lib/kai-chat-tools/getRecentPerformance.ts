/**
 * Tool `getRecentPerformance` — atalho de "como tá performance da semana?"
 *
 * Diferente do `getMetrics` (que devolve 30/90d com card), este é otimizado
 * para perguntas curtas tipo "como tá essa semana?" / "performance ontem"
 * — retorna janela curta (default 7d) com KPIs por plataforma + nº de posts.
 * Sem chart inline, sem comparativo: mais rápido e mais barato.
 *
 * Use QUANDO o usuário pergunta sobre performance recente sem especificar
 * tudo. Para análises profundas (90d, deep dive, comparativos), prefira
 * `getMetrics`.
 */
import type { RegisteredTool } from './types.js';
import { query } from '../db.js';
import { assertToolClientAccess } from './tool-access.js';

interface GetRecentPerformanceArgs {
  network?: string;
  period?: '24h' | '7d' | '14d' | '30d';
}

interface PlatformStats {
  platform: string;
  posts: number;
  likes: number;
  comments: number;
  reach: number;
  engagementAvgPct: number;
  topPostUrl: string | null;
  topPostEngagementPct: number;
}

interface GetRecentPerformanceData {
  period: string;
  totalPosts: number;
  byPlatform: PlatformStats[];
  summary: string;
}

const NETWORK_MAP: Record<string, { table: string; date: string; selectCols: string }> = {
  instagram: {
    table: 'instagram_posts',
    date: 'posted_at',
    selectCols: 'likes, comments, shares, reach, impressions, engagement_rate, posted_at, permalink',
  },
  linkedin: {
    table: 'linkedin_posts',
    date: 'posted_at',
    selectCols: 'likes, comments, shares, impressions, engagement_rate, posted_at, post_url',
  },
  twitter: {
    table: 'twitter_posts',
    date: 'posted_at',
    selectCols: 'likes, replies, retweets, impressions, engagement_rate, posted_at, tweet_id',
  },
  youtube: {
    table: 'youtube_videos',
    date: 'published_at',
    selectCols: 'likes, comments, total_views, published_at, video_id',
  },
};

function periodHours(period: string): number {
  if (period === '24h') return 24;
  if (period === '7d') return 24 * 7;
  if (period === '14d') return 24 * 14;
  if (period === '30d') return 24 * 30;
  return 24 * 7;
}

function periodLabel(period: string): string {
  if (period === '24h') return 'últimas 24h';
  if (period === '7d') return 'últimos 7 dias';
  if (period === '14d') return 'últimas 2 semanas';
  if (period === '30d') return 'últimos 30 dias';
  return 'últimos 7 dias';
}

function buildSummaryLine(stats: PlatformStats[], period: string): string {
  if (stats.length === 0) {
    return `Sem posts nos ${periodLabel(period)}.`;
  }
  const parts: string[] = [];
  for (const s of stats) {
    if (s.posts === 0) continue;
    parts.push(
      `${s.platform}: ${s.posts} ${s.posts === 1 ? 'post' : 'posts'}, eng médio ${s.engagementAvgPct.toFixed(1)}%`,
    );
  }
  if (parts.length === 0) {
    return `Sem posts nos ${periodLabel(period)}.`;
  }
  return parts.join(' · ');
}

export const getRecentPerformanceTool: RegisteredTool<
  GetRecentPerformanceArgs,
  GetRecentPerformanceData
> = {
  definition: {
    name: 'getRecentPerformance',
    description:
      'Atalho rápido pra performance recente do cliente (default últimos 7 dias). Use quando o usuário fizer perguntas curtas tipo "como tá essa semana?", "performance hoje", "como foi ontem". Para deep dives (30d+, comparativos, charts) use `getMetrics`.',
    parameters: {
      type: 'object',
      properties: {
        network: {
          type: 'string',
          description: "Plataforma alvo. Default 'all'.",
          enum: ['instagram', 'linkedin', 'twitter', 'youtube', 'all'],
        },
        period: {
          type: 'string',
          description: "Janela curta. Default '7d'.",
          enum: ['24h', '7d', '14d', '30d'],
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const network = String(args.network ?? 'all');
    const period = (args.period ?? '7d') as string;
    const cutoffISO = new Date(Date.now() - periodHours(period) * 3600 * 1000).toISOString();

    // SECURITY: lê instagram_posts/linkedin_posts/etc filtrado por ctx.clientId.
    // Em MCP service mode, attacker poderia setar clientId arbitrário no
    // contexto. Validar que ctx.userId (se houver) tem acesso.
    if (!ctx.clientId) {
      return { ok: false, error: 'Cliente atual obrigatório.' };
    }
    const guard = await assertToolClientAccess(ctx, ctx.clientId);
    if (!guard.ok) return { ok: false, error: guard.error };

    const targetPlatforms =
      network === 'all'
        ? Object.keys(NETWORK_MAP)
        : Object.keys(NETWORK_MAP).filter((p) => p === network);

    if (targetPlatforms.length === 0) {
      return { ok: false, error: `Network inválido: ${network}` };
    }

    try {
      const byPlatform: PlatformStats[] = [];
      let totalPosts = 0;

      for (const plat of targetPlatforms) {
        const spec = NETWORK_MAP[plat];
        let rows: any[] = [];
        try {
          rows = await query<any>(
            `SELECT ${spec.selectCols} FROM ${spec.table}
              WHERE client_id = $1 AND ${spec.date} >= $2
              ORDER BY ${spec.date} DESC LIMIT 200`,
            [ctx.clientId, cutoffISO],
          );
        } catch (err: any) {
          console.warn(`[getRecentPerformance] ${spec.table} soft-fail:`, err?.message);
          continue;
        }

        if (rows.length === 0) continue;

        let likes = 0, comments = 0, reach = 0, engSum = 0, topEng = 0;
        let topUrl: string | null = null;
        for (const r of rows) {
          const lk = Number(r.likes) || 0;
          const cm = Number(r.replies ?? r.comments) || 0;
          const rh = Number(r.reach ?? r.impressions ?? r.total_views) || 0;
          const eg = Number(r.engagement_rate) || 0;
          likes += lk;
          comments += cm;
          reach += rh;
          engSum += eg;
          if (eg > topEng) {
            topEng = eg;
            if (plat === 'instagram') topUrl = r.permalink ?? null;
            else if (plat === 'linkedin') topUrl = r.post_url ?? null;
            else if (plat === 'twitter' && r.tweet_id) topUrl = `https://x.com/i/web/status/${r.tweet_id}`;
            else if (plat === 'youtube' && r.video_id) topUrl = `https://www.youtube.com/watch?v=${r.video_id}`;
          }
        }

        const stat: PlatformStats = {
          platform: plat,
          posts: rows.length,
          likes,
          comments,
          reach,
          engagementAvgPct: rows.length > 0 ? Number((engSum / rows.length).toFixed(2)) : 0,
          topPostUrl: topUrl,
          topPostEngagementPct: Number(topEng.toFixed(2)),
        };
        byPlatform.push(stat);
        totalPosts += rows.length;
      }

      const data: GetRecentPerformanceData = {
        period: periodLabel(period),
        totalPosts,
        byPlatform,
        summary: buildSummaryLine(byPlatform, period),
      };

      return { ok: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getRecentPerformance] error:', err);
      return { ok: false, error: message };
    }
  },
};
