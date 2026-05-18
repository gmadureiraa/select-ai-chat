// FollowersChart — wrapper em volta do AreaLineChart pra renderizar histórico
// de followers de uma plataforma.
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaLineChart, type ChartPoint } from '@/components/kai/charts/svg-primitives';
import { formatNumber } from './_format';
import type { LateFollowerStats } from '@/hooks/useLatePerformance';

interface Props {
  stats: LateFollowerStats | undefined;
  color: string;
  loading?: boolean;
  title?: string;
}

export function FollowersChart({ stats, color, loading, title = 'Seguidores' }: Props) {
  const chartData: ChartPoint[] = useMemo(() => {
    if (!stats?.history) return [];
    return stats.history.map((p) => {
      const d = new Date(p.date);
      return {
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        value: p.followers,
      };
    });
  }, [stats]);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {stats && (
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold tabular-nums">
              {formatNumber(stats.current)}
            </span>
            {stats.change30d !== 0 && (
              <span
                className={
                  stats.change30d > 0
                    ? 'text-xs font-medium text-emerald-500 tabular-nums'
                    : 'text-xs font-medium text-destructive tabular-nums'
                }
              >
                {stats.change30d > 0 ? '+' : ''}
                {formatNumber(stats.change30d)} (30d)
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="w-full h-[180px]" aria-label="Carregando gráfico de seguidores" />
        ) : chartData.length < 2 ? (
          <div className="h-[180px] flex flex-col items-center justify-center gap-1 text-center">
            <span className="text-sm text-muted-foreground">Sem histórico suficiente</span>
            <span className="text-xs text-muted-foreground/70">
              O Late precisa de pelo menos 2 dias de dados pra plotar a curva.
            </span>
          </div>
        ) : (
          <AreaLineChart
            data={chartData}
            color={color}
            height={180}
            metricLabel="Seguidores"
            formatY={formatNumber}
            formatTooltip={formatNumber}
            ariaLabel={`Evolução de seguidores ao longo de ${chartData.length} dias. Atual: ${formatNumber(stats?.current ?? 0)}.`}
          />
        )}
      </CardContent>
    </Card>
  );
}
