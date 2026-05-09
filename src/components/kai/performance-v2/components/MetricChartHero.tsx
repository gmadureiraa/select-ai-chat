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
import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
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
import { Toggle } from '@/components/ui/toggle';
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
  Download,
  GitCompareArrows,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type MetricoolPost, getPostMetric } from '@/hooks/useMetricoolPerformance';
import type { SnapshotData } from '@/hooks/useHistoricalSnapshots';
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

export interface MetricChartHeroProps {
  posts: MetricoolPost[];
  followersHistory: FollowersPoint[];
  loading?: boolean;
  period: number;
  /** Timestamp da última atualização do summary (Date.now() ou ISO). */
  lastUpdatedAt?: number;
  /** Métrica inicial. Default: engagement. */
  defaultMetric?: HeroMetric;
  /**
   * Snapshots históricos diários do nosso DB (`metricool_daily_snapshots`).
   * Quando presente:
   *   - `followers` chart: usa snapshots (não `followersHistory` da Metricool API)
   *   - outras métricas: snapshots como base + fallback bucketByDay(posts) p/ dias
   *     que ainda não foram capturados pelo cron.
   */
  historicalSnapshots?: SnapshotData[];
}

// Alias interno mantido pra evitar churn no resto do arquivo
type Props = MetricChartHeroProps;

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

/**
 * YYYY-MM-DD na timezone informada (default BRT). Resolve o bug de posts
 * publicados sex 23h BRT (sáb 02h UTC) caindo no dia errado.
 */
function localDateKey(d: Date, tz = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
}

/** Granularidade do bucket usado no chart. */
export type Granularity = 'day' | 'week' | 'month';

/**
 * Bucketiza posts em janelas (day/week/month) cobrindo o período retroativo.
 * - `day`: chave YYYY-MM-DD (locale BRT)
 * - `week`: chave ISO YYYY-Www (semana segunda→domingo)
 * - `month`: chave YYYY-MM
 *
 * `endDate` (default: hoje) permite gerar o "período anterior" só deslocando
 * o cursor `period` dias atrás — usado pra overlay de comparação.
 */
function bucketByDay(
  posts: MetricoolPost[],
  period: number,
  granularity: Granularity = 'day',
  endDate?: Date,
): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  const now = endDate ?? new Date();

  const keyForDate = (d: Date): { key: string; shortDate: string } => {
    if (granularity === 'day') {
      return {
        key: localDateKey(d),
        shortDate: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      };
    }
    if (granularity === 'week') {
      // ISO week (segunda como início) — usa UTC pra evitar drift TZ
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
      const key = `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      // Label: "semana de DD/MM" usando segunda da semana
      const monday = new Date(d);
      const offset = (d.getDay() + 6) % 7; // dist até segunda
      monday.setDate(d.getDate() - offset);
      return {
        key,
        shortDate: monday.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      };
    }
    // month
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      shortDate: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
    };
  };

  // Inicializa buckets vazios pra cada slot do período.
  // `step` em dias: 1 pra day, 7 pra week, ~30 pra month (resampling grosseiro).
  if (granularity === 'day') {
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400_000);
      const { key, shortDate } = keyForDate(d);
      buckets.set(key, {
        date: key,
        shortDate,
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
  } else if (granularity === 'week') {
    // Cobre `period` dias retroativos em incrementos de 7d
    for (let i = period - 1; i >= 0; i -= 7) {
      const d = new Date(now.getTime() - i * 86400_000);
      const { key, shortDate } = keyForDate(d);
      if (!buckets.has(key)) {
        buckets.set(key, {
          date: key,
          shortDate,
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
    }
  } else {
    // month
    for (let i = period - 1; i >= 0; i -= 28) {
      const d = new Date(now.getTime() - i * 86400_000);
      const { key, shortDate } = keyForDate(d);
      if (!buckets.has(key)) {
        buckets.set(key, {
          date: key,
          shortDate,
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
    }
  }

  for (const p of posts) {
    const dateStr = (p.date || p.publishedAt || p.publishDate || '') as string;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) continue;
    const { key } = keyForDate(d);
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
  // Engagement total + rate per bucket (após loop pra ter reach final).
  // Fallback impressions quando reach=0 (Twitter/Threads/LinkedIn) — alinhado a
  // `aggregatePostsMetrics` em useMetricoolPerformance.ts pra eng% não cair a 0
  // em redes sem reach.
  for (const b of buckets.values()) {
    b.engagement = b.likes + b.comments + b.shares;
    const denom = Math.max(b.reach, b.impressions);
    b.engagementRate = denom > 0 ? (b.engagement / denom) * 100 : 0;
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

// Calcula valor agregado (total ou último) + delta vs período anterior.
// Para non-point usa partição simétrica (descarta ponto central de séries
// ímpares pra não comparar 3d vs 4d).
function summarizeSeries(
  series: Array<{ value: number }>,
  isPoint: boolean,
): { current: number; delta: number; deltaPct: number } {
  if (series.length === 0) return { current: 0, delta: 0, deltaPct: 0 };
  if (isPoint) {
    // Para series isPoint (followers): pega o primeiro valor NÃO-ZERO como baseline
    // pra não jogar deltaPct = 0 quando snapshots começam só no meio da janela.
    const current = series[series.length - 1]?.value ?? 0;
    const baseline = series.find((s) => s.value > 0)?.value ?? 0;
    const delta = current - baseline;
    const deltaPct = baseline > 0 ? (delta / baseline) * 100 : 0;
    return { current, delta, deltaPct };
  }
  // Partição simétrica: se length ímpar, descarta o ponto central
  const len = series.length;
  const half = Math.floor(len / 2);
  const offset = len % 2 === 1 ? 1 : 0; // pula ponto central
  const first = series.slice(0, half).reduce((a, b) => a + (b.value || 0), 0);
  const second = series.slice(half + offset).reduce((a, b) => a + (b.value || 0), 0);
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
  historicalSnapshots,
}: Props) {
  const [selected, setSelected] = useState<HeroMetric>(defaultMetric);
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [compareEnabled, setCompareEnabled] = useState(false);

  // Auto-fallback: granularidade `month` em períodos curtos (<= 30d) gera
  // 1-2 pontos só, fica visualmente quebrado. Força `day` em <= 14d e
  // bloqueia `month` em < 60d.
  useEffect(() => {
    if (period <= 14 && granularity !== 'day') setGranularity('day');
    else if (period < 60 && granularity === 'month') setGranularity('week');
  }, [period, granularity]);

  // Período atual (último `period` dias)
  const buckets = useMemo(
    () => bucketByDay(posts, period, granularity),
    [posts, period, granularity],
  );

  // Período anterior — mesmo comprimento `period` mas terminando `period` dias atrás.
  // Usado pra overlay tracejado de comparação.
  const previousBuckets = useMemo(() => {
    if (!compareEnabled) return [] as DayBucket[];
    const prevEnd = new Date(Date.now() - period * 86400_000);
    return bucketByDay(posts, period, granularity, prevEnd);
  }, [compareEnabled, posts, period, granularity]);

  // Tick a cada 60s pra `Atualizado X min atrás` recompor sem stale render.
  // Sem isso a string fica congelada até a próxima invalidate.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!lastUpdatedAt) return;
    const t = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [lastUpdatedAt]);

  // Snapshots históricos do nosso DB — quando presente, sobrescrevem
  // `followersHistory` da API Metricool (que só tem 30-90d) e dão base sólida
  // pra qualquer métrica diária.
  const snapshotsByDay = useMemo(() => {
    if (!historicalSnapshots || historicalSnapshots.length === 0) return null;
    const map = new Map<string, SnapshotData>();
    for (const s of historicalSnapshots) map.set(s.date, s);
    return map;
  }, [historicalSnapshots]);

  const followersSeries = useMemo(() => {
    // Prefere snapshots locais (history acumulada) em vez de followersHistory
    // (Metricool API só dá ~1 ponto/dia e janela curta).
    if (historicalSnapshots && historicalSnapshots.length > 0) {
      return historicalSnapshots
        .filter((s) => s.followers != null && s.followers > 0)
        .map((s) => ({
          shortDate: new Date(`${s.date}T12:00:00`).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
          }),
          date: s.date,
          value: s.followers as number,
        }));
    }
    return followersHistory.map((p) => ({
      shortDate: new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      date: p.date,
      value: p.followers,
    }));
  }, [followersHistory, historicalSnapshots]);

  // Helper: extrai valor da métrica selecionada de um DayBucket,
  // dando prioridade a `snapshotsByDay` (granularity 'day' apenas).
  const valueFromBucket = (b: DayBucket): number => {
    const snap = granularity === 'day' ? snapshotsByDay?.get(b.date) : undefined;
    if (snap) {
      switch (selected) {
        case 'engagement':
          return snap.total_likes + snap.total_comments + snap.total_shares;
        case 'likes':
          return snap.total_likes;
        case 'comments':
          return snap.total_comments;
        case 'reach':
          return snap.total_reach;
        case 'impressions':
          return snap.total_impressions;
        case 'views':
          return snap.total_views;
        case 'saves':
          return snap.total_saves;
        case 'engagementRate':
          return snap.avg_engagement_rate;
        default:
          return b[selected as Exclude<HeroMetric, 'followers'>] as number;
      }
    }
    return b[selected as Exclude<HeroMetric, 'followers'>] as number;
  };

  const series = useMemo(() => {
    if (selected === 'followers') {
      // Followers não suporta comparação por enquanto (snapshots-only série)
      return followersSeries.map((p) => ({ ...p, previousValue: null }));
    }
    return buckets.map((b, idx) => {
      const value = valueFromBucket(b);
      // Pega bucket anterior pelo MESMO índice da série atual (1:1 align).
      // Isso é seguro porque `bucketByDay` produz exatamente o mesmo length
      // pra mesmos `period`+`granularity`.
      const prevBucket = compareEnabled ? previousBuckets[idx] : undefined;
      const previousValue = prevBucket ? valueFromBucket(prevBucket) : null;
      return { shortDate: b.shortDate, date: b.date, value, previousValue };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, buckets, followersSeries, snapshotsByDay, compareEnabled, previousBuckets, granularity]);

  const def = METRICS.find((m) => m.key === selected) ?? METRICS[0];
  const Icon = def.icon;
  const summary = useMemo(
    () => summarizeSeries(series, !!def.isPoint),
    [series, def.isPoint],
  );

  const hasData = series.some((s) => s.value > 0);
  const maxVal = Math.max(
    ...series.map((s) => s.value),
    ...series.map((s) => (typeof s.previousValue === 'number' ? s.previousValue : 0)),
    1,
  );
  const gradientId = `hero-gradient-${selected}`;
  const compareDisabled = selected === 'followers';

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

          <div className="flex flex-wrap items-center gap-2">
            {/* Granularity selector — dia/semana/mês.
                Esconde 'mês' em períodos < 60d (não rende ponto suficiente). */}
            <div className="flex rounded-md border bg-muted/30 overflow-hidden h-9">
              {(['day', 'week', 'month'] as const).map((g) => {
                const disabled =
                  (g === 'month' && period < 60) || (g === 'week' && period <= 14);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => !disabled && setGranularity(g)}
                    disabled={disabled}
                    className={cn(
                      'px-2.5 text-[11px] font-medium transition',
                      granularity === g
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-muted-foreground',
                      disabled && 'opacity-40 cursor-not-allowed',
                    )}
                    title={
                      disabled
                        ? `Granularidade ${g === 'month' ? 'mensal' : 'semanal'} requer período maior`
                        : undefined
                    }
                  >
                    {g === 'day' ? 'Dia' : g === 'week' ? 'Semana' : 'Mês'}
                  </button>
                );
              })}
            </div>

            {/* Toggle comparar com período anterior (overlay tracejado).
                Followers ainda não suporta — usa snapshot acumulado. */}
            <Toggle
              size="sm"
              variant="outline"
              pressed={compareEnabled}
              onPressedChange={setCompareEnabled}
              disabled={compareDisabled}
              className="h-9 gap-1.5 text-[11px]"
              title={
                compareDisabled
                  ? 'Comparação não disponível pra seguidores'
                  : 'Comparar com período anterior'
              }
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Comparar</span>
            </Toggle>

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
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-2.5 hidden sm:inline-flex"
              onClick={() => {
                if (series.length === 0) return;
                const header = compareEnabled
                  ? `data,${def.key},${def.key}_anterior\n`
                  : `data,${def.key}\n`;
                const body = series
                  .map((s) => {
                    const v = def.isPercent ? s.value.toFixed(3) : Math.round(s.value);
                    if (!compareEnabled) return `${s.date},${v}`;
                    const pv =
                      typeof s.previousValue === 'number'
                        ? def.isPercent
                          ? s.previousValue.toFixed(3)
                          : Math.round(s.previousValue)
                        : '';
                    return `${s.date},${v},${pv}`;
                  })
                  .join('\n');
                const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `kai-performance-${def.key}-${period}d.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              title="Exportar série como CSV"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
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
              <ComposedChart data={series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
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
                  formatter={(value: number, name: string) => [
                    def.isPercent ? `${value.toFixed(2)}%` : fmtFull(value),
                    name === 'previousValue' ? `${def.label} (anterior)` : def.label,
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
                {compareEnabled && !compareDisabled && (
                  <Line
                    type="monotone"
                    dataKey="previousValue"
                    stroke={def.color}
                    strokeWidth={1.6}
                    strokeOpacity={0.55}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 3.5, stroke: def.color, strokeWidth: 1.5, fill: 'hsl(var(--background))' }}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
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
