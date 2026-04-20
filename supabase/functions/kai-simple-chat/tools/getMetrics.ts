/**
 * Tool F4 `getMetrics` — métricas de performance do cliente com gráfico inline.
 *
 * Fluxo:
 *   1. LLM chama getMetrics({ platform?, period, focus? })
 *   2. Resolve tabelas alvo (instagram_posts, linkedin_posts, twitter_posts,
 *      youtube_videos) conforme platform (default: "all")
 *   3. Query direta ao Supabase em paralelo, filtrada por period (cutoff)
 *   4. Agrega KPIs (total posts, avg engagement, total likes, total comments)
 *   5. Compara vs período anterior pra calcular delta (%)
 *   6. Top 3 posts por engagement_rate
 *   7. Series semanais (agrupadas por ISO week) pro chart
 *   8. Emite action_card type="metric" com chart + kpis + summary
 *   9. Retorna `data` compacto pro LLM poder narrar em texto
 *
 * Decisão: NÃO invoca kai-metrics-agent (queries diretas são mais rápidas
 * e o card já carrega dados estruturados). O agent pode ser usado em uma
 * tool separada `analyzeMetrics` pra análises narrativas profundas.
 */

import {
  newActionCardId,
  type KAIActionCard,
  type KAIMetricCardData,
} from "../../_shared/kai-stream.ts";
import type { RegisteredTool } from "./types.ts";

type Platform = "instagram" | "linkedin" | "youtube" | "twitter" | "all";
type Period = "7d" | "30d" | "90d" | "all";
type Focus = "engagement" | "reach" | "likes" | "overview";

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

/* ────────────────── config das tabelas ────────────────── */

interface TableSpec {
  platform: "instagram" | "linkedin" | "twitter" | "youtube";
  table: string;
  /** Campos SELECT necessários. */
  select: string;
  /** Nome da coluna com a data de publicação. */
  dateField: string;
  /** Função pra normalizar linha pra shape comum. */
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
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

const TABLE_SPECS: Record<"instagram" | "linkedin" | "twitter" | "youtube", TableSpec> = {
  instagram: {
    platform: "instagram",
    table: "instagram_posts",
    select:
      "id, likes, comments, shares, reach, impressions, engagement_rate, posted_at, post_type, permalink, caption",
    dateField: "posted_at",
    normalize: (row) => ({
      platform: "instagram",
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
    platform: "linkedin",
    table: "linkedin_posts",
    select:
      "id, likes, comments, shares, clicks, impressions, engagement_rate, posted_at, post_url, content",
    dateField: "posted_at",
    normalize: (row) => ({
      platform: "linkedin",
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
    platform: "twitter",
    table: "twitter_posts",
    select:
      "id, likes, replies, retweets, impressions, engagement_rate, posted_at, tweet_id, content",
    dateField: "posted_at",
    normalize: (row) => {
      const tweetId = str(row.tweet_id);
      return {
        platform: "twitter",
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
    platform: "youtube",
    table: "youtube_videos",
    select:
      "id, likes, comments, total_views, published_at, video_id, title",
    dateField: "published_at",
    normalize: (row) => {
      const videoId = str(row.video_id);
      const views = num(row.total_views);
      const likes = num(row.likes);
      const comments = num(row.comments);
      // YouTube não tem eng_rate armazenado — calculamos aqui (likes+comments)/views.
      const engagement_rate = views > 0 ? ((likes + comments) / views) * 100 : 0;
      return {
        platform: "youtube",
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

/* ────────────────── helpers ────────────────── */

function periodDays(period: Period): number | null {
  if (period === "7d") return 7;
  if (period === "30d") return 30;
  if (period === "90d") return 90;
  return null;
}

function periodLabel(period: Period): string {
  if (period === "7d") return "últimos 7 dias";
  if (period === "30d") return "últimos 30 dias";
  if (period === "90d") return "últimos 90 dias";
  return "todo o histórico";
}

function resolveTables(platform: Platform): TableSpec[] {
  if (platform === "all") return Object.values(TABLE_SPECS);
  const spec = TABLE_SPECS[platform];
  return spec ? [spec] : [];
}

/** ISO week key: YYYY-Www (ex: "2026-W16") */
function isoWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // Thursday of the current ISO week determines year.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
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
    return curr > 0 ? "+novo" : undefined;
  }
  const diff = ((curr - prev) / Math.abs(prev)) * 100;
  if (!Number.isFinite(diff)) return undefined;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(0)}%`;
}

function deltaPP(curr: number, prev: number): string | undefined {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return undefined;
  if (curr === 0 && prev === 0) return undefined;
  const diff = curr - prev;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)}pp`;
}

/* ────────────────── query ────────────────── */

async function fetchPosts(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  spec: TableSpec,
  clientId: string,
  cutoffISO: string | null,
  secondaryCutoffISO?: string | null,
): Promise<NormalizedPost[]> {
  try {
    let query = supabase
      .from(spec.table)
      .select(spec.select)
      .eq("client_id", clientId);

    // Filtro baixo (cutoff pra baixo; sempre que `cutoffISO` for o limite inferior).
    if (secondaryCutoffISO) {
      query = query.gte(spec.dateField, secondaryCutoffISO);
    } else if (cutoffISO) {
      query = query.gte(spec.dateField, cutoffISO);
    }

    const { data, error } = await query.order(spec.dateField, {
      ascending: false,
    }).limit(500);

    if (error) {
      console.warn(
        `[getMetrics] ${spec.table} query failed (soft):`,
        error.message ?? error,
      );
      return [];
    }

    const rows = Array.isArray(data) ? data : [];
    return rows.map((r) => spec.normalize(r as Record<string, unknown>));
  } catch (err) {
    console.warn(`[getMetrics] ${spec.table} exception (soft):`, err);
    return [];
  }
}

/* ────────────────── agregações ────────────────── */

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

/** Agrupa posts por semana ISO e retorna series ordenadas asc. */
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
  // Limita a últimas 12 semanas pra não poluir o chart.
  const trimmed = keys.slice(-12);

  const labels: string[] = [];
  const engagement: number[] = [];
  trimmed.forEach((k, idx) => {
    const entry = byWeek.get(k)!;
    labels.push(`Sem ${idx + 1}`);
    engagement.push(
      entry.count > 0 ? Number((entry.sum / entry.count).toFixed(2)) : 0,
    );
  });

  // Fallback: se não houver nenhuma semana, garante 1 bucket zero.
  if (labels.length === 0) {
    labels.push("Sem 1");
    engagement.push(0);
  }

  return { labels, engagement };
}

/* ────────────────── summary narrativo ────────────────── */

function buildSummary(
  platform: Platform,
  period: Period,
  curr: Aggregated,
  prev: Aggregated,
  topPost: NormalizedPost | null,
): string {
  if (curr.total === 0) {
    return `Sem posts ${platform === "all" ? "" : `em ${platform} `}nos ${
      periodLabel(period)
    }. Sem base pra análise.`;
  }

  const parts: string[] = [];
  const engPct = formatPct(curr.engAvg, 1);
  const platLabel = platform === "all" ? "nas plataformas" : `em ${platform}`;
  parts.push(
    `${curr.total} posts ${platLabel} nos ${
      periodLabel(period)
    }, engajamento médio de ${engPct}.`,
  );

  const d = deltaPP(curr.engAvg, prev.engAvg);
  if (d && prev.total > 0) {
    const up = curr.engAvg >= prev.engAvg;
    parts.push(
      `Engajamento ${up ? "subiu" : "caiu"} ${d} vs período anterior.`,
    );
  }

  if (topPost && topPost.engagement_rate > 0) {
    parts.push(
      `Melhor post: ${topPost.platform} com ${
        formatPct(topPost.engagement_rate)
      } de engajamento.`,
    );
  }

  return parts.join(" ");
}

/* ────────────────── tool ────────────────── */

export const getMetricsTool: RegisteredTool<GetMetricsArgs, GetMetricsData> = {
  definition: {
    name: "getMetrics",
    description:
      "Busca métricas de performance do cliente (likes, engajamento, alcance) em uma plataforma específica ou geral. Use quando o usuário pergunta sobre performance, números, engajamento, melhor post, etc.",
    parameters: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          description:
            "Plataforma alvo. 'all' para métricas consolidadas de todas.",
          enum: ["instagram", "linkedin", "youtube", "twitter", "all"],
        },
        period: {
          type: "string",
          description:
            "Janela temporal. '7d' últimos 7 dias, '30d' últimos 30, '90d' últimos 90, 'all' todo histórico.",
          enum: ["7d", "30d", "90d", "all"],
        },
        focus: {
          type: "string",
          description:
            "Foco da análise. 'overview' (default) retorna panorama geral; outros destacam KPIs específicos.",
          enum: ["engagement", "reach", "likes", "overview"],
        },
      },
      required: ["period"],
    },
  },

  handler: async (args, ctx) => {
    const platform: Platform = (args.platform ?? "all") as Platform;
    const period: Period = (args.period ?? "30d") as Period;
    const focus: Focus = (args.focus ?? "overview") as Focus;

    const days = periodDays(period);
    const now = Date.now();
    const cutoffISO = days
      ? new Date(now - days * 86400000).toISOString()
      : null;
    const prevCutoffISO = days
      ? new Date(now - 2 * days * 86400000).toISOString()
      : null;

    console.log(
      `[getMetrics] clientId=${ctx.clientId} platform=${platform} period=${period} focus=${focus} cutoff=${cutoffISO}`,
    );

    const specs = resolveTables(platform);
    if (specs.length === 0) {
      return {
        ok: false,
        error: `Plataforma inválida: ${platform}`,
      };
    }

    try {
      // Fetch em paralelo — período atual + período anterior (pra delta).
      const currResults = await Promise.all(
        specs.map((s) => fetchPosts(ctx.supabase, s, ctx.clientId, cutoffISO)),
      );
      const currPosts = currResults.flat();

      let prevPosts: NormalizedPost[] = [];
      if (prevCutoffISO && cutoffISO) {
        // Pega tudo de prevCutoff até cutoff (janela anterior equivalente).
        const prevResults = await Promise.all(
          specs.map(async (s) => {
            try {
              const { data, error } = await ctx.supabase
                .from(s.table)
                .select(s.select)
                .eq("client_id", ctx.clientId)
                .gte(s.dateField, prevCutoffISO)
                .lt(s.dateField, cutoffISO)
                .limit(500);
              if (error) {
                console.warn(
                  `[getMetrics] ${s.table} prev query failed (soft):`,
                  error.message ?? error,
                );
                return [] as NormalizedPost[];
              }
              const rows = Array.isArray(data) ? data : [];
              return rows.map((r) =>
                s.normalize(r as Record<string, unknown>)
              );
            } catch (err) {
              console.warn(
                `[getMetrics] ${s.table} prev exception (soft):`,
                err,
              );
              return [] as NormalizedPost[];
            }
          }),
        );
        prevPosts = prevResults.flat();
      }

      const curr = aggregate(currPosts);
      const prev = aggregate(prevPosts);

      // Top 3 posts por engagement_rate.
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

      // KPIs (com deltas onde faz sentido).
      const kpis: KpiOut[] = [
        {
          label: "Posts",
          value: String(curr.total),
          delta: deltaPct(curr.total, prev.total),
        },
        {
          label: "Eng médio",
          value: formatPct(curr.engAvg, 1),
          delta: deltaPP(curr.engAvg, prev.engAvg),
        },
        {
          label: "Total likes",
          value: formatNumber(curr.likes),
          delta: deltaPct(curr.likes, prev.likes),
        },
        {
          label: "Comentários",
          value: formatNumber(curr.comments),
          delta: deltaPct(curr.comments, prev.comments),
        },
      ];

      // Series semanais pro chart.
      const { labels, engagement } = buildWeeklySeries(currPosts);

      const summary = buildSummary(platform, period, curr, prev, topPost);

      // Data compacta pro LLM narrar.
      const data: GetMetricsData = {
        period: periodLabel(period),
        platform,
        focus,
        kpis,
        topPosts,
        totalPosts: curr.total,
      };

      // Action card type="metric".
      const cardData: KAIMetricCardData = {
        kind: "metric",
        clientId: ctx.clientId,
        platform: platform === "all" ? undefined : platform,
        period: periodLabel(period),
        summary,
        kpis: kpis.map((k) => ({
          label: k.label,
          value: k.value,
          ...(k.delta ? { delta: k.delta } : {}),
        })),
        chart: {
          labels,
          series: [{ name: "Engagement %", values: engagement }],
        },
      };

      const card: KAIActionCard = {
        id: newActionCardId(),
        type: "metric",
        status: "done",
        data: cardData,
        requires_approval: false,
        available_actions: [
          {
            id: "deep_dive",
            label: "Análise detalhada (90d)",
            variant: "secondary",
            tool_call: {
              name: "getMetrics",
              args: {
                platform,
                period: "90d",
                focus: "overview",
              },
            },
          },
        ],
      };

      console.log(
        `[getMetrics] retornando card — ${curr.total} posts, eng_avg=${
          curr.engAvg.toFixed(2)
        }%`,
      );

      return {
        ok: true,
        data,
        card,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[getMetrics] error:", err);
      return { ok: false, error: message };
    }
  },
};
