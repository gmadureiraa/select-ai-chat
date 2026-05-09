// GrowthDelta — calcula crescimento % vs período anterior usando 2 queries
// (período atual + período anterior do mesmo tamanho).
import { useMetricoolPosts, type MetricoolNetwork, aggregatePostsMetrics } from '@/hooks/useMetricoolPerformance';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  clientId: string;
  network: MetricoolNetwork;
  period: number;
}

interface DeltaItem {
  label: string;
  current: number;
  previous: number;
  format?: 'number' | 'percent';
}

function pct(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function formatValue(v: number, fmt: 'number' | 'percent'): string {
  if (fmt === 'percent') return `${v.toFixed(2)}%`;
  return new Intl.NumberFormat('pt-BR').format(Math.round(v));
}

export function GrowthDelta({ clientId, network, period }: Props) {
  // Período atual
  const { data: currentPosts = [], isLoading: lc } = useMetricoolPosts(clientId, network, period);

  // Período anterior — query manual com from/to ajustados
  // Hook reaproveitado mas com period × 2 (vai pegar últimos 2× period)
  const { data: extendedPosts = [], isLoading: lp } = useMetricoolPosts(clientId, network, period * 2);

  // previousPosts = extendedPosts MENOS currentPosts (filtrar por data)
  const cutoff = Date.now() - period * 86400_000;
  const previousPosts = extendedPosts.filter((p) => {
    const d = new Date((p.date || p.publishedAt || p.publishDate || '') as string);
    return !Number.isNaN(d.getTime()) && d.getTime() < cutoff;
  });

  const cur = aggregatePostsMetrics(currentPosts);
  const prev = aggregatePostsMetrics(previousPosts);

  const items: DeltaItem[] = [
    { label: 'Posts', current: cur.postsCount, previous: prev.postsCount },
    { label: 'Engajamento', current: cur.totalLikes + cur.totalComments, previous: prev.totalLikes + prev.totalComments },
    { label: 'Alcance', current: cur.totalReach, previous: prev.totalReach },
    { label: 'Eng %', current: cur.avgEngagementRate, previous: prev.avgEngagementRate, format: 'percent' },
  ];

  const isLoading = lc || lp;

  if (isLoading) return <Skeleton className="h-[140px] w-full" />;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-3">
          <span className="kai-eyebrow text-xs">Comparativo vs período anterior</span>
          <h3 className="text-sm font-semibold mt-1">
            Últimos {period}d vs {period}d antes
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {items.map((it) => {
            const fmt = it.format ?? 'number';
            const delta = pct(it.current, it.previous);
            const trend = delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'neutral';
            const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
            const colorClass =
              trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';
            return (
              <div key={it.label} className="rounded-md border p-3 space-y-1">
                <div className="text-xs text-muted-foreground">{it.label}</div>
                <div className="text-xl font-bold tabular-nums">{formatValue(it.current, fmt)}</div>
                <div className={'flex items-center gap-1 text-xs ' + colorClass}>
                  <TrendIcon className="h-3 w-3" />
                  <span className="font-medium tabular-nums">
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">
                    (era {formatValue(it.previous, fmt)})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
