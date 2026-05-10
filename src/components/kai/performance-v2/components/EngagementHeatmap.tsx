// EngagementHeatmap — heatmap dia × hora dos POSTS publicados (não best times genérico).
// Mostra QUANDO o cliente postou e qual foi o engagement, ajudando a identificar
// horários ideais com base no histórico real do cliente (não na média da plataforma).
import { useMemo, useState } from 'react';
import type { MetricoolPost } from '@/hooks/useMetricoolPerformance';
import { Card, CardContent } from '@/components/ui/card';
import { getPostMetric } from '@/hooks/useMetricoolPerformance';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getNetworkBranding } from '@/lib/network-branding';

type HeatmapMetric =
  | 'engagement'
  | 'reach'
  | 'impressions'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'views'
  | 'saves';

const HEATMAP_METRICS: Array<{ key: HeatmapMetric; label: string }> = [
  { key: 'engagement', label: 'Engajamento %' },
  { key: 'likes', label: 'Curtidas' },
  { key: 'comments', label: 'Comentários' },
  { key: 'shares', label: 'Compartilhamentos' },
  { key: 'reach', label: 'Alcance' },
  { key: 'impressions', label: 'Impressões' },
  { key: 'views', label: 'Visualizações' },
  { key: 'saves', label: 'Salvamentos' },
];

interface Props {
  posts: MetricoolPost[];
  loading?: boolean;
  /** Métrica inicial. Default: engagement. Selector interno permite trocar. */
  metric?: HeatmapMetric;
  /** Rede pra tintar a escala de calor com a cor da plataforma. */
  network?: string;
}

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function EngagementHeatmap({ posts, loading, metric: initialMetric = 'engagement', network }: Props) {
  const [metric, setMetric] = useState<HeatmapMetric>(initialMetric);
  const branding = network ? getNetworkBranding(network) : null;
  if (loading) return <Skeleton className="h-[160px] w-full" />;

  // Constrói grid 7x24 com soma da métrica por slot — memoizado pra
  // não rebuildar 168 cells × 50+ posts a cada render externo (refetch).
  const { grid, counts, max } = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const c: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let m = 0;
    for (const p of posts) {
      const dateStr = (p.date || p.publishedAt || p.publishDate) as string | undefined;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) continue;
      const day = d.getDay();
      const hour = d.getHours();
      const value = getPostMetric(p, metric);
      g[day][hour] += value;
      c[day][hour] += 1;
      if (g[day][hour] > m) m = g[day][hour];
    }
    return { grid: g, counts: c, max: m };
  }, [posts, metric]);

  // Quando network informado: gera escala em cima da cor da rede via opacity.
  // Sem network: mantém escala emerald clássica.
  const intensityFor = (v: number, count: number): number => {
    if (count === 0) return 0;
    return Math.min(1, v / (max || 1));
  };

  const colorClassFor = (v: number, count: number): string => {
    if (count === 0) return 'bg-muted/20';
    if (branding) return ''; // será aplicado via inline style abaixo
    const intensity = Math.min(1, v / (max || 1));
    if (intensity > 0.75) return 'bg-emerald-500';
    if (intensity > 0.5) return 'bg-emerald-400';
    if (intensity > 0.25) return 'bg-emerald-300';
    if (intensity > 0.05) return 'bg-emerald-200';
    return 'bg-emerald-100';
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: metric === 'engagement' ? 2 : 0 }).format(v);

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground text-center">
          Sem posts no período pra calcular padrão de engajamento.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
          <div>
            <span className="kai-eyebrow text-xs">Padrão real do seu calendário</span>
            <h3 className="text-sm font-semibold mt-1">Quando você publica vs performance</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              {posts.length} posts · max {fmt(max)}{metric === 'engagement' ? '%' : ''}
            </span>
            <Select value={metric} onValueChange={(v) => setMetric(v as HeatmapMetric)}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEATMAP_METRICS.map((m) => (
                  <SelectItem key={m.key} value={m.key} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1 overflow-x-auto">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-8 min-w-[28rem]">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="w-4 text-center">
                {h % 4 === 0 ? h : ''}
              </div>
            ))}
          </div>
          {grid.map((row, day) => (
            <div key={day} className="flex items-center gap-1 min-w-[28rem]">
              <div className="w-7 text-xs text-muted-foreground">{DAYS_PT[day]}</div>
              {row.map((value, hour) => {
                const c = counts[day][hour];
                const intensity = intensityFor(value, c);
                const useBranding = !!branding && c > 0;
                return (
                  <div
                    key={hour}
                    className={
                      'w-4 h-4 rounded transition cursor-help ' +
                      colorClassFor(value, c) +
                      (c > 0 ? ' hover:ring-2 hover:ring-foreground/30' : '')
                    }
                    style={
                      useBranding
                        ? {
                            backgroundColor: branding!.primaryHex,
                            // opacity floor 0.15 pra valor mínimo renderizar visível
                            opacity: Math.max(0.15, intensity),
                          }
                        : undefined
                    }
                    title={
                      c > 0
                        ? `${DAYS_PT[day]} ${hour}h — ${c} post${c > 1 ? 's' : ''}, ${fmt(value)}${metric === 'engagement' ? '%' : ''} ${metric}`
                        : ''
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>menor</span>
          <div className="flex gap-px">
            {branding ? (
              [0.15, 0.35, 0.55, 0.75, 1].map((op) => (
                <div
                  key={op}
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: branding.primaryHex, opacity: op }}
                />
              ))
            ) : (
              <>
                <div className="w-3 h-3 bg-emerald-100 rounded" />
                <div className="w-3 h-3 bg-emerald-200 rounded" />
                <div className="w-3 h-3 bg-emerald-300 rounded" />
                <div className="w-3 h-3 bg-emerald-400 rounded" />
                <div className="w-3 h-3 bg-emerald-500 rounded" />
              </>
            )}
          </div>
          <span>maior {metric === 'engagement' ? '(eng %)' : ''}</span>
        </div>
      </CardContent>
    </Card>
  );
}
