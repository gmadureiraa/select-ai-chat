// FormatBreakdown — distribuição de tipos de conteúdo (Posts/Reels/Stories/Carousel)
// e qual formato performa melhor (eng médio por tipo).
// Específico pra Instagram (que tem múltiplos tipos); pode generalizar pra FB (post/reel/story).
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Image as ImageIcon, Film, Circle, Layers } from 'lucide-react';
import { type MetricoolPost, getPostMetric } from '@/hooks/useMetricoolPerformance';

interface Props {
  posts: MetricoolPost[];
  reels: MetricoolPost[];
  stories: MetricoolPost[];
  loading?: boolean;
}

interface FormatStat {
  type: 'post' | 'carousel' | 'reel' | 'story';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  totalEng: number;
  totalReach: number;
  avgEng: number;
  color: string; // tailwind class
}

export function FormatBreakdown({ posts, reels, stories, loading }: Props) {
  const formats = useMemo<FormatStat[]>(() => {
    const carousels = posts.filter((p) => {
      const t = String(p.type || '').toUpperCase();
      return t.includes('CAROUSEL') || t.includes('ALBUM');
    });
    const singlePosts = posts.filter((p) => {
      const t = String(p.type || '').toUpperCase();
      return !(t.includes('CAROUSEL') || t.includes('ALBUM'));
    });

    function compute(arr: MetricoolPost[]): { totalEng: number; totalReach: number; avgEng: number } {
      let likes = 0, comments = 0, shares = 0, reach = 0;
      for (const p of arr) {
        likes += getPostMetric(p, 'likes');
        comments += getPostMetric(p, 'comments');
        shares += getPostMetric(p, 'shares');
        reach += getPostMetric(p, 'reach');
      }
      const eng = likes + comments + shares;
      return {
        totalEng: eng,
        totalReach: reach,
        avgEng: reach > 0 ? (eng / reach) * 100 : 0,
      };
    }

    return [
      {
        type: 'post',
        label: 'Posts',
        icon: ImageIcon,
        count: singlePosts.length,
        ...compute(singlePosts),
        color: 'bg-sky-500',
      },
      {
        type: 'carousel',
        label: 'Carrosséis',
        icon: Layers,
        count: carousels.length,
        ...compute(carousels),
        color: 'bg-violet-500',
      },
      {
        type: 'reel',
        label: 'Reels',
        icon: Film,
        count: reels.length,
        ...compute(reels),
        color: 'bg-pink-500',
      },
      {
        type: 'story',
        label: 'Stories',
        icon: Circle,
        count: stories.length,
        ...compute(stories),
        color: 'bg-amber-500',
      },
    ];
  }, [posts, reels, stories]);

  const totalCount = formats.reduce((acc, f) => acc + f.count, 0);

  if (loading) return <Skeleton className="h-[200px] w-full" />;
  if (totalCount === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground text-center">
          Sem conteúdo no período pra analisar formato.
        </CardContent>
      </Card>
    );
  }

  // Best format = maior avgEng com pelo menos 1 post
  const winner = [...formats]
    .filter((f) => f.count > 0)
    .sort((a, b) => b.avgEng - a.avgEng)[0];

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="kai-eyebrow text-xs">Mix de formato</span>
            <h3 className="text-sm font-semibold mt-1">{totalCount} peças no período</h3>
          </div>
          {winner && (
            <div className="text-xs text-emerald-600 font-medium">
              🏆 {winner.label} performa melhor: {winner.avgEng.toFixed(2)}% eng
            </div>
          )}
        </div>

        {/* Stacked bar de distribuição */}
        <div className="space-y-1">
          <div className="flex h-3 rounded-full overflow-hidden">
            {formats.map((f) => {
              if (f.count === 0) return null;
              const pct = (f.count / totalCount) * 100;
              return (
                <div
                  key={f.type}
                  className={f.color}
                  style={{ width: `${pct}%` }}
                  title={`${f.label}: ${f.count} (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {formats.map((f) => (
              <div key={f.type} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${f.color}`} />
                <span>
                  {f.label}: {f.count} ({totalCount > 0 ? ((f.count / totalCount) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabela compacta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {formats.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.type} className="rounded-md border p-2 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {f.label}
                </div>
                <div className="text-lg font-bold tabular-nums">{f.count}</div>
                <div className="text-[10px] text-muted-foreground">
                  Eng: <span className="text-foreground font-medium tabular-nums">{f.avgEng.toFixed(2)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
