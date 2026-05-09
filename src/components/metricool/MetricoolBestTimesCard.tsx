// MetricoolBestTimesCard — heatmap (dia × hora) de melhores horários pra postar.
import { useQuery } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiInvoke';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Clock } from 'lucide-react';
import { useState } from 'react';

interface Props {
  clientId: string;
}

const PLATFORMS = ['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube'] as const;
type P = typeof PLATFORMS[number];

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function useBestTimes(clientId: string, platform: P) {
  return useQuery({
    queryKey: ['metricool-best-times', clientId, platform],
    queryFn: async () => {
      const { data, error } = await apiInvoke('metricool-best-times', { body: { clientId, platform } });
      if (error) throw error;
      return (data as any)?.bestTimes || [];
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 60,
  });
}

export function MetricoolBestTimesCard({ clientId }: Props) {
  const [platform, setPlatform] = useState<P>('instagram');
  const { data, isLoading } = useBestTimes(clientId, platform);

  // Constrói heatmap 7×24
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let maxScore = 0;
  for (const t of data || []) {
    if (typeof t.day === 'number' && typeof t.hour === 'number' && typeof t.score === 'number') {
      grid[t.day][t.hour] = t.score;
      if (t.score > maxScore) maxScore = t.score;
    }
  }

  const colorFor = (score: number) => {
    if (score === 0) return 'bg-muted/30';
    const intensity = Math.min(1, score / (maxScore || 1));
    if (intensity > 0.75) return 'bg-emerald-500';
    if (intensity > 0.5) return 'bg-emerald-400';
    if (intensity > 0.25) return 'bg-emerald-300';
    return 'bg-emerald-200';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" /> Melhores horários (Metricool)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={platform} onValueChange={(v) => setPlatform(v as P)}>
          <TabsList className="grid grid-cols-6 w-full">
            {PLATFORMS.map((p) => (
              <TabsTrigger key={p} value={p} className="text-xs capitalize">
                {p}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={platform} className="mt-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : data && data.length > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-8">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="w-4 text-center">
                      {h % 4 === 0 ? h : ''}
                    </div>
                  ))}
                </div>
                {grid.map((row, day) => (
                  <div key={day} className="flex items-center gap-1">
                    <div className="w-7 text-xs text-muted-foreground">{DAYS_PT[day]}</div>
                    {row.map((score, hour) => (
                      <div
                        key={hour}
                        className={`w-4 h-4 rounded ${colorFor(score)} hover:ring-2 hover:ring-foreground/20 transition`}
                        title={`${DAYS_PT[day]} ${hour}h — score ${score.toFixed(1)}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center p-4">
                Sem dados ainda. Metricool precisa de pelo menos 30 dias de histórico de posts.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
