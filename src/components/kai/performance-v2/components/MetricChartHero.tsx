// MetricChartHero — UM chart grande (full width, ~320px) com seletor de métrica.
// Substitui TimeSeriesCharts (que era 4 charts pequenos).
//
// 9 métricas:
//   1. Seguidores (followers) — vem de followersHistory
//   2. Engajamento (likes+comments+shares)
//   3. Curtidas
//   4. Comentários
//   5. Alcance (reach)
//   6. Impressões
//   7. Visualizações de vídeo (views)
//   8. Salvamentos (saves)
//   9. Eng % (engagement rate)
//
// Inspiração: src/components/performance/EnhancedAreaChart.tsx (legacy) — header
// com seletor + total agregado + delta vs período anterior, gradient suave,
// tooltip rico em pt-BR.
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  TrendingUp,
  Heart,
  MessageCircle,
  Eye,
  BarChart3,
  PlayCircle,
  Bookmark,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { type MetricoolPost, getPostMetric } from '@/hooks/useMetricoolPerformance';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Métricas suportadas
// ─────────────────────────────────────────────────────────────────────────────
export type HeroMetric =
  | 'followers'
  | 'engagement'
  | 'likes'
  | 'comments'
  | 'reach'
  | 'impressions'
  | 'views'
  | 'saves'
  | 'engagementRate';

interface MetricDef {
  key: HeroMetric;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; // hex ou hsl()
  unit?: string;
  // Quando true, total = último valor (não soma). Útil pra followers/eng%.
  isPoint?: boolean;
  isPercent?: boolean;
}

const METRICS: MetricDef[] = [
  { key: 'followers', label: 'Seguidores', icon: Users, color: '#6366f1', isPoint: true },
  { key: 'engagement', label: 'Engajamento', icon: TrendingUp, color: '#10b981' },
  { key: 'likes', label: 'Curtidas', icon: Heart, color: '#ef4444' },
  { key: 'comments', label: 'Comentários', icon: MessageCircle, color: '#0ea5e9' },
  { key: 'reach', label: 'Alcance', icon: Eye, color: '#8b5cf6' },
  { key: 'impressions', label: 'Impressões', icon: BarChart3, color: '#f59e0b' },
  { key: 'views', label: 'Visualizações', icon: PlayCircle, color: '#ec4899' },
  { key: 'saves', label: 'Salvamentos', icon: Bookmark, color: '#14b8a6' },
  { key: 'engagementRate', label: 'Eng %', icon: Percent, color: '#22c55e', isPercent: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface FollowersPoint {
  date: string;
  followers: number;
}

interface Props {
  posts: MetricoolPost[];
  followersHistory: FollowersPoint[];
  loading?: boolean;
  period: number;
  /** Timestamp da última atualização do summary (Date.now() ou ISO). */
  lastUpdatedAt?: number;
  /** Métrica inicial. Default: engagement. */
  defaultMetric?: HeroMetric;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
interface DayBucket {
  date: string;
  shortDate: string;
  posts: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  reach: number;
  impressions: number;
  views: number;
  saves: number;
  engagementRate: number;
}

function bucketByDay(posts: MetricoolPost[], period: number): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  const now = new Date();
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, {
      date: key,
      shortDate: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      posts: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagement: 0,
      reach: 0,
      impressions: 0,
      views: 0,
      saves: 0,
      engagementRate: 0,
    });
  }

  for (const p of posts) {
    const dateStr = (p.date || p.publishedAt || p.publishDate || '') as string;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue;
    b.posts += 1;
    b.likes += getPostMetric(p, 'likes');
    b.comments += getPostMetric(p, 'comments');
    b.shares += getPostMetric(p, 'shares');
    b.reach += getPostMetric(p, 'reach');
    b.impressions += getPostMetric(p, 'impressions');
    b.views += getPostMetric(p, 'views');
    b.saves += getPostMetric(p, 'saves');
  }
  // Engagement total + rate per day (após loop pra ter reach final)
  for (const b of buckets.values()) {
    b.engagement = b.likes + b.comments + b.shares;
    b.engagementRate = b.reach > 0 ? (b.engagement / b.reach) * 100 : 0;
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n);
}

function fmtFull(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('pt-BR').format(Math.round(n));
}

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

// Calcula valor agregado (total ou último) + delta vs período anterior
function summarizeSeries(
  series: Array<{ value: number }>,
  isPoint: boolean,
): { current: number; delta: number; deltaPct: number } {
  if (series.length === 0) return { current: 0, delta: 0, deltaPct: 0 };
  if (isPoint) {
    const current = series[series.length - 1]?.value ?? 0;
    const previous = series[0]?.value ?? 0;
    const delta = current - previous;
    const deltaPct = previous > 0 ? (delta / previous) * 100 : 0;
    return { current, delta, deltaPct };
  }
  // Soma metade recente vs metade anterior
  const half = Math.floor(series.length / 2);
  const first = series.slice(0, half).reduce((a, b) => a + (b.value || 0), 0);
  const second = series.slice(half).reduce((a, b) => a + (b.value || 0), 0);
  const total = first + second;
  const delta = second - first;
  const deltaPct = first > 0 ? (delta / first) * 100 : second > 0 ? 100 : 0;
  return { current: total, delta, deltaPct };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function MetricChartHero({
  posts,
  followersHistory,
  loading,
  period,
  lastUpdatedAt,
  defaultMetric = 'engagement',
}: Props) {
  const [selected, setSelected] = useState<HeroMetric>(defaultMetric);
  const buckets = useMemo(() => bucketByDay(posts, period), [posts, period]);

  const followersSeries = useMemo(() => {
    return followersHistory.map((p) => ({
      shortDate: new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      date: p.date,
      value: p.followers,
    }));
  }, [followersHistory]);

  const series = useMemo(() => {
    if (selected === 'followers') return followersSeries;
    return buckets.map((b) => ({
      shortDate: b.shortDate,
      date: b.date,
      value: b[selected as Exclude<HeroMetric, 'followers'>] as number,
    }));
  }, [selected, buckets, followersSeries]);

  const def = METRICS.find((m) => m.key === selected) ?? METRICS[0];
  const Icon = def.icon;
  const summary = useMemo(
    () => summarizeSeries(series, !!def.isPoint),
    [series, def.isPoint],
  );

  const hasData = series.some((s) => s.value > 0);
  const maxVal = Math.max(...series.map((s) => s.value), 1);
  const gradientId = `hero-gradient-${selected}`;

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-[320px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const trendDir = summary.delta > 0 ? 'up' : summary.delta < 0 ? 'down' : 'neutral';
  const TrendIcon = trendDir === 'up' ? ArrowUpRight : trendDir === 'down' ? ArrowDownRight : Minus;
  const trendColor =
    trendDir === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trendDir === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground';

  const formatTotal = (v: number) =>
    def.isPercent ? `${v.toFixed(2)}%` : fmtNumber(v);

  return (
    <Card className="border border-border/50 shadow-card overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-flex items-center justify-center rounded-md p-1.5"
                style={{ backgroundColor: `${def.color}1A` }}
              >
                <Icon className="h-4 w-4" style={{ color: def.color }} />
              </span>
              <span className="kai-eyebrow text-xs">Performance ao longo do tempo</span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-bold tabular-nums leading-none">
                {formatTotal(summary.current)}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  trendColor,
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {summary.deltaPct > 0 ? '+' : ''}
                {summary.deltaPct.toFixed(1)}%
              </span>
              <CardDescription className="text-xs">
                vs período anterior · {def.label.toLowerCase()}
              </CardDescription>
            </div>
          </div>

          <Select value={selected} onValueChange={(v) => setSelected(v as HeroMetric)}>
            <SelectTrigger className="w-full md:w-[200px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRICS.map((m) => {
                const MIcon = m.icon;
                return (
                  <SelectItem key={m.key} value={m.key} className="text-xs">
                    <span className="flex items-center gap-2">
                      <MIcon className="h-3.5 w-3.5" style={{ color: m.color }} />
                      {m.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-2 sm:px-4">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-[320px] text-sm text-muted-foreground">
            <Icon className="h-6 w-6 mb-2 opacity-40" style={{ color: def.color }} />
            Sem dados de {def.label.toLowerCase()} nesse período.
          </div>
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={def.color} stopOpacity={0.32} />
                    <stop offset="55%" stopColor={def.color} stopOpacity={0.1} />
                    <stop offset="100%" stopColor={def.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
                  vertical={false}
                />
                <XAxis
                  dataKey="shortDate"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  domain={[0, maxVal * 1.15]}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) =>
                    def.isPercent
                      ? `${Number(v).toFixed(0)}%`
                      : v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1000
                          ? `${(v / 1000).toFixed(0)}k`
                          : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
                  formatter={(value: number) => [
                    def.isPercent ? `${value.toFixed(2)}%` : fmtFull(value),
                    def.label,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={def.color}
                  strokeWidth={2.4}
                  fill={`url(#${gradientId})`}
                  dot={
                    series.length <= 30
                      ? {
                          r: 2.5,
                          fill: def.color,
                          stroke: 'hsl(var(--background))',
                          strokeWidth: 2,
                        }
                      : false
                  }
                  activeDot={{
                    r: 5,
                    stroke: def.color,
                    strokeWidth: 2,
                    fill: 'hsl(var(--background))',
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 px-2 pb-2 text-[10px] text-muted-foreground">
          <span>
            {lastUpdatedAt
              ? `Atualizado ${fmtRelative(lastUpdatedAt)}`
              : 'Atualização em tempo real'}{' '}
            · Fonte: Metricool
          </span>
          <span className="hidden sm:inline">
            Período: últimos {period}d
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default MetricChartHero;
