/**
 * Tool F4 `getMetrics` — métricas de performance com chart inline.
 * Node port: queries diretas via Neon em vez de supabase client.
 */
import {
  newActionCardId,
  type KAIActionCard,
  type KAIMetricCardData,
} from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { query } from '../db.js';

type Platform = 'instagram' | 'linkedin' | 'youtube' | 'twitter' | 'all';
type Period = '7d' | '30d' | '90d' | 'all';
type Focus = 'engagement' | 'reach' | 'likes' | 'overview';

interface GetMetricsArgs {
  platform?: Platform;
  period: Period;
  focus?: Focus;
}

interface KpiOut {
  label: string;
  value: string;
  delta?: string;
}

interface TopPostOut {
  platform: string;
  engagement_rate: number;
  likes: number;
  comments: number;
  posted_at: string | null;
  url?: string | null;
  preview?: string | null;
}

interface GetMetricsData {
  period: string;
  platform: string;
  focus: string;
  kpis: KpiOut[];
  topPosts: TopPostOut[];
  totalPosts: number;
}

interface TableSpec {
  platform: 'instagram' | 'linkedin' | 'twitter' | 'youtube';
  table: string;
  /** Colunas a buscar (string SELECT). */
  selectCols: string;
  dateField: string;
  normalize: (row: Record<string, unknown>) => NormalizedPost;
}

interface NormalizedPost {
  platform: string;
  posted_at: string | null;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  engagement_rate: number;
  url: string | null;
  preview: string | null;
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

const TABLE_SPECS: Record<'instagram' | 'linkedin' | 'twitter' | 'youtube', TableSpec> = {
  instagram: {
    platform: 'instagram',
    table: 'instagram_posts',
    selectCols:
      'id, likes, comments, shares, reach, impressions, engagement_rate, posted_at, post_type, permalink, caption',
    dateField: 'posted_at',
    normalize: (row) => ({
      platform: 'instagram',
      posted_at: str(row.posted_at),
      likes: num(row.likes),
      comments: num(row.comments),
      shares: num(row.shares),
      reach: num(row.reach) || num(row.impressions),
      engagement_rate: num(row.engagement_rate),
      url: str(row.permalink),
      preview: str(row.caption)?.slice(0, 120) ?? null,
    }),
  },
  linkedin: {
    platform: 'linkedin',
    table: 'linkedin_posts',
    selectCols:
      'id, likes, comments, shares, clicks, impressions, engagement_rate, posted_at, post_url, content',
    dateField: 'posted_at',
    normalize: (row) => ({
      platform: 'linkedin',
      posted_at: str(row.posted_at),
      likes: num(row.likes),
      comments: num(row.comments),
      shares: num(row.shares),
      reach: num(row.impressions),
      engagement_rate: num(row.engagement_rate),
      url: str(row.post_url),
      preview: str(row.content)?.slice(0, 120) ?? null,
    }),
  },
  twitter: {
    platform: 'twitter',
    table: 'twitter_posts',
    selectCols:
      'id, likes, replies, retweets, impressions, engagement_rate, posted_at, tweet_id, content',
    dateField: 'posted_at',
    normalize: (row) => {
      const tweetId = str(row.tweet_id);
      return {
        platform: 'twitter',
        posted_at: str(row.posted_at),
        likes: num(row.likes),
        comments: num(row.replies),
        shares: num(row.retweets),
        reach: num(row.impressions),
        engagement_rate: num(row.engagement_rate),
        url: tweetId ? `https://x.com/i/web/status/${tweetId}` : null,
        preview: str(row.content)?.slice(0, 120) ?? null,
      };
    },
  },
  youtube: {
    platform: 'youtube',
    table: 'youtube_videos',
    selectCols: 'id, likes, comments, total_views, published_at, video_id, title',
    dateField: 'published_at',
    normalize: (row) => {
      const videoId = str(row.video_id);
      const views = num(row.total_views);
      const likes = num(row.likes);
      const comments = num(row.comments);
      const engagement_rate = views > 0 ? ((likes + comments) / views) * 100 : 0;
      return {
        platform: 'youtube',
        posted_at: str(row.published_at),
        likes,
        comments,
        shares: 0,
        reach: views,
        engagement_rate,
        url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
        preview: str(row.title)?.slice(0, 120) ?? null,
      };
    },
  },
};

function periodDays(period: Period): number | null {
  if (period === '7d') return 7;
  if (period === '30d') return 30;
  if (period === '90d') return 90;
  return null;
}

function periodLabel(period: Period): string {
  if (period === '7d') return 'últimos 7 dias';
  if (period === '30d') return 'últimos 30 dias';
  if (period === '90d') return 'últimos 90 dias';
  return 'todo o histórico';
}

function resolveTables(platform: Platform): TableSpec[] {
  if (platform === 'all') return Object.values(TABLE_SPECS);
  const spec = TABLE_SPECS[platform];
  return spec ? [spec] : [];
}

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

function deltaPct(curr: number, prev: number): string | undefined {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return undefined;
  if (prev === 0) {
    if (curr === 0) return undefined;
    return curr > 0 ? '+novo' : undefined;
  }
  const diff = ((curr - prev) / Math.abs(prev)) * 100;
  if (!Number.isFinite(diff)) return undefined;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(0)}%`;
}

function deltaPP(curr: number, prev: number): string | undefined {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return undefined;
  if (curr === 0 && prev === 0) return undefined;
  const diff = curr - prev;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}pp`;
}

async function fetchPosts(
  spec: TableSpec,
  clientId: string,
  cutoffISO: string | null,
): Promise<NormalizedPost[]> {
  try {
    let sql = `SELECT ${spec.selectCols} FROM ${spec.table} WHERE client_id = $1`;
    const params: any[] = [clientId];
    if (cutoffISO) {
      params.push(cutoffISO);
      sql += ` AND ${spec.dateField} >= $${params.length}`;
    }
    sql += ` ORDER BY ${spec.dateField} DESC NULLS LAST LIMIT 500`;
    const rows = await query<Record<string, unknown>>(sql, params);
    return rows.map((r) => spec.normalize(r));
  } catch (err: any) {
    console.warn(`[getMetrics] ${spec.table} query failed (soft):`, err?.message ?? err);
    return [];
  }
}

async function fetchPrevPosts(
  spec: TableSpec,
  clientId: string,
  prevCutoffISO: string,
  cutoffISO: string,
): Promise<NormalizedPost[]> {
  try {
    const sql = `SELECT ${spec.selectCols} FROM ${spec.table}
                  WHERE client_id = $1
                    AND ${spec.dateField} >= $2
                    AND ${spec.dateField} < $3
                  LIMIT 500`;
    const rows = await query<Record<string, unknown>>(sql, [clientId, prevCutoffISO, cutoffISO]);
    return rows.map((r) => spec.normalize(r));
  } catch (err: any) {
    console.warn(`[getMetrics] ${spec.table} prev query failed (soft):`, err?.message ?? err);
    return [];
  }
}

interface Aggregated {
  total: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  engSum: number;
  engAvg: number;
  maxEng: number;
}

function aggregate(posts: NormalizedPost[]): Aggregated {
  const total = posts.length;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let reach = 0;
  let engSum = 0;
  let maxEng = 0;
  for (const p of posts) {
    likes += p.likes;
    comments += p.comments;
    shares += p.shares;
    reach += p.reach;
    engSum += p.engagement_rate;
    if (p.engagement_rate > maxEng) maxEng = p.engagement_rate;
  }
  const engAvg = total > 0 ? engSum / total : 0;
  return { total, likes, comments, shares, reach, engSum, engAvg, maxEng };
}

function buildWeeklySeries(
  posts: NormalizedPost[],
): { labels: string[]; engagement: number[] } {
  const byWeek = new Map<string, { sum: number; count: number }>();
  for (const p of posts) {
    if (!p.posted_at) continue;
    const date = new Date(p.posted_at);
    if (isNaN(date.getTime())) continue;
    const key = isoWeekKey(date);
    const entry = byWeek.get(key) ?? { sum: 0, count: 0 };
    entry.sum += p.engagement_rate;
    entry.count += 1;
    byWeek.set(key, entry);
  }
  const keys = Array.from(byWeek.keys()).sort();
  const trimmed = keys.slice(-12);
  const labels: string[] = [];
  const engagement: number[] = [];
  trimmed.forEach((k, idx) => {
    const entry = byWeek.get(k)!;
    labels.push(`Sem ${idx + 1}`);
    engagement.push(entry.count > 0 ? Number((entry.sum / entry.count).toFixed(2)) : 0);
  });
  if (labels.length === 0) {
    labels.push('Sem 1');
    engagement.push(0);
  }
  return { labels, engagement };
}

function buildSummary(
  platform: Platform,
  period: Period,
  curr: Aggregated,
  prev: Aggregated,
  topPost: NormalizedPost | null,
): string {
  if (curr.total === 0) {
    return `Sem posts ${platform === 'all' ? '' : `em ${platform} `}nos ${periodLabel(period)}. Sem base pra análise.`;
  }
  const parts: string[] = [];
  const engPct = formatPct(curr.engAvg, 1);
  const platLabel = platform === 'all' ? 'nas plataformas' : `em ${platform}`;
  parts.push(`${curr.total} posts ${platLabel} nos ${periodLabel(period)}, engajamento médio de ${engPct}.`);

  const d = deltaPP(curr.engAvg, prev.engAvg);
  if (d && prev.total > 0) {
    const up = curr.engAvg >= prev.engAvg;
    parts.push(`Engajamento ${up ? 'subiu' : 'caiu'} ${d} vs período anterior.`);
  }

  if (topPost && topPost.engagement_rate > 0) {
    parts.push(
      `Melhor post: ${topPost.platform} com ${formatPct(topPost.engagement_rate)} de engajamento.`,
    );
  }
  return parts.join(' ');
}

export const getMetricsTool: RegisteredTool<GetMetricsArgs, GetMetricsData> = {
  definition: {
    name: 'getMetrics',
    description:
      'Busca métricas de performance do cliente (likes, engajamento, alcance) em uma plataforma específica ou geral. Use quando o usuário pergunta sobre performance, números, engajamento, melhor post, etc.',
    parameters: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description: "Plataforma alvo. 'all' para métricas consolidadas de todas.",
          enum: ['instagram', 'linkedin', 'youtube', 'twitter', 'all'],
        },
        period: {
          type: 'string',
          description:
            "Janela temporal. '7d' últimos 7 dias, '30d' últimos 30, '90d' últimos 90, 'all' todo histórico.",
          enum: ['7d', '30d', '90d', 'all'],
        },
        focus: {
          type: 'string',
          description:
            "Foco da análise. 'overview' (default) retorna panorama geral; outros destacam KPIs específicos.",
          enum: ['engagement', 'reach', 'likes', 'overview'],
        },
      },
      required: ['period'],
    },
  },

  handler: async (args, ctx) => {
    const platform: Platform = (args.platform ?? 'all') as Platform;
    const period: Period = (args.period ?? '30d') as Period;
    const focus: Focus = (args.focus ?? 'overview') as Focus;

    const days = periodDays(period);
    const now = Date.now();
    const cutoffISO = days ? new Date(now - days * 86400000).toISOString() : null;
    const prevCutoffISO = days ? new Date(now - 2 * days * 86400000).toISOString() : null;

    console.log(
      `[getMetrics] clientId=${ctx.clientId} platform=${platform} period=${period} focus=${focus} cutoff=${cutoffISO}`,
    );

    const specs = resolveTables(platform);
    if (specs.length === 0) {
      return { ok: false, error: `Plataforma inválida: ${platform}` };
    }

    try {
      const currResults = await Promise.all(
        specs.map((s) => fetchPosts(s, ctx.clientId, cutoffISO)),
      );
      const currPosts = currResults.flat();

      let prevPosts: NormalizedPost[] = [];
      if (prevCutoffISO && cutoffISO) {
        const prevResults = await Promise.all(
          specs.map((s) => fetchPrevPosts(s, ctx.clientId, prevCutoffISO, cutoffISO)),
        );
        prevPosts = prevResults.flat();
      }

      const curr = aggregate(currPosts);
      const prev = aggregate(prevPosts);

      const sortedTop = [...currPosts]
        .sort((a, b) => b.engagement_rate - a.engagement_rate)
        .slice(0, 3);

      const topPosts: TopPostOut[] = sortedTop.map((p) => ({
        platform: p.platform,
        engagement_rate: Number(p.engagement_rate.toFixed(2)),
        likes: p.likes,
        comments: p.comments,
        posted_at: p.posted_at,
        url: p.url,
        preview: p.preview,
      }));

      const topPost = sortedTop[0] ?? null;

      const kpis: KpiOut[] = [
        { label: 'Posts', value: String(curr.total), delta: deltaPct(curr.total, prev.total) },
        {
          label: 'Eng médio',
          value: formatPct(curr.engAvg, 1),
          delta: deltaPP(curr.engAvg, prev.engAvg),
        },
        { label: 'Total likes', value: formatNumber(curr.likes), delta: deltaPct(curr.likes, prev.likes) },
        {
          label: 'Comentários',
          value: formatNumber(curr.comments),
          delta: deltaPct(curr.comments, prev.comments),
        },
      ];

      const { labels, engagement } = buildWeeklySeries(currPosts);
      const summary = buildSummary(platform, period, curr, prev, topPost);

      const data: GetMetricsData = {
        period: periodLabel(period),
        platform,
        focus,
        kpis,
        topPosts,
        totalPosts: curr.total,
      };

      const cardData: KAIMetricCardData = {
        kind: 'metric',
        clientId: ctx.clientId,
        platform: platform === 'all' ? undefined : platform,
        period: periodLabel(period),
        summary,
        kpis: kpis.map((k) => ({
          label: k.label,
          value: k.value,
          ...(k.delta ? { delta: k.delta } : {}),
        })),
        chart: {
          labels,
          series: [{ name: 'Engagement %', values: engagement }],
        },
      };

      const card: KAIActionCard = {
        id: newActionCardId(),
        type: 'metric',
        status: 'done',
        data: cardData,
        requires_approval: false,
        available_actions: [
          {
            id: 'deep_dive',
            label: 'Análise detalhada (90d)',
            variant: 'secondary',
            tool_call: {
              name: 'getMetrics',
              args: { platform, period: '90d', focus: 'overview' },
            },
          },
        ],
      };

      console.log(
        `[getMetrics] retornando card — ${curr.total} posts, eng_avg=${curr.engAvg.toFixed(2)}%`,
      );

      return { ok: true, data, card };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getMetrics] error:', err);
      return { ok: false, error: message };
    }
  },
};
