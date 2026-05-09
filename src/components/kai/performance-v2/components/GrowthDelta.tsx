// GrowthDelta — calcula crescimento % vs período anterior usando UMA query
// (period × 2) e particionando local, evitando dupla chamada e respeitando
// o window-cap da Metricool API.
//
// Usa snapshots históricos quando disponíveis (períodos > 30d) pra fugir do
// limite ~30-90d da Metricool API que tornava previousPosts artificialmente 0.
import { useMemo } from 'react';
import { useMetricoolPosts, type MetricoolNetwork, aggregatePostsMetrics } from '@/hooks/useMetricoolPerformance';
import { useHistoricalSnapshots } from '@/hooks/useHistoricalSnapshots';
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
  // UMA query estendida — particiona em current vs previous local
  const { data: extendedPosts = [], isLoading: lp } = useMetricoolPosts(clientId, network, period * 2);

  // Snapshots cobrem 2× period — quando disponíveis, sobrescrevem o cálculo
  // baseado em posts (que sofre window-cap da Metricool em períodos longos).
  const { data: snapshotResp } = useHistoricalSnapshots(clientId, network, period * 2);

  const cutoffTs = Date.now() - period * 86400_000;
  const { cur, prev } = useMemo(() => {
    // Path A: snapshots locais (preferido pra range > 30d)
    const snaps = snapshotResp?.snapshots || [];
    if (snaps.length > 0 && period >= 7) {
      const cutoffDate = new Date(cutoffTs);
      const cutoffKey = cutoffDate.toISOString().slice(0, 10);
      let cP = { likes: 0, comments: 0, shares: 0, reach: 0, imp: 0, count: 0 };
      let pP = { likes: 0, comments: 0, shares: 0, reach: 0, imp: 0, count: 0 };
      for (const s of snaps) {
        const target = s.date >= cutoffKey ? cP : pP;
        target.likes += s.total_likes;
        target.comments += s.total_comments;
        target.shares += s.total_shares;
        target.reach += s.total_reach;
        target.imp += s.total_impressions;
        target.count += s.posts_count;
      }
      const denomC = Math.max(cP.reach, cP.imp);
      const denomP = Math.max(pP.reach, pP.imp);
      return {
        cur: {
          postsCount: cP.count,
          totalLikes: cP.likes,
          totalComments: cP.comments,
          totalReach: cP.reach,
          avgEngagementRate: denomC > 0 ? ((cP.likes + cP.comments + cP.shares) / denomC) * 100 : 0,
        },
        prev: {
          postsCount: pP.count,
          totalLikes: pP.likes,
          totalComments: pP.comments,
          totalReach: pP.reach,
          avgEngagementRate: denomP > 0 ? ((pP.likes + pP.comments + pP.shares) / denomP) * 100 : 0,
        },
      };
    }
    // Path B: posts da Metricool API (window <= 30d normalmente OK)
    const currentPosts = extendedPosts.filter((p) => {
      const d = new Date((p.date || p.publishedAt || p.publishDate || '') as string);
      return !Number.isNaN(d.getTime()) && d.getTime() >= cutoffTs;
    });
    const previousPosts = extendedPosts.filter((p) => {
      const d = new Date((p.date || p.publishedAt || p.publishDate || '') as string);
      return !Number.isNaN(d.getTime()) && d.getTime() < cutoffTs;
    });
    return {
      cur: aggregatePostsMetrics(currentPosts),
      prev: aggregatePostsMetrics(previousPosts),
    };
  }, [extendedPosts, snapshotResp, cutoffTs, period]);

  const items: DeltaItem[] = [
    { label: 'Posts', current: cur.postsCount, previous: prev.postsCount },
    { label: 'Engajamento', current: cur.totalLikes + cur.totalComments, previous: prev.totalLikes + prev.totalComments },
    { label: 'Alcance', current: cur.totalReach, previous: prev.totalReach },
    { label: 'Eng %', current: cur.avgEngagementRate, previous: prev.avgEngagementRate, format: 'percent' },
  ];

  const isLoading = lp;

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
