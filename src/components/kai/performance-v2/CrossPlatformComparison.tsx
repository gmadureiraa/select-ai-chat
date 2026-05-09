// CrossPlatformComparison — view comparativa de TODAS as plataformas conectadas
// lado a lado. Ranqueia plataformas por engagement, alcance, posts.
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  Heart,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import {
  useMetricoolPosts,
  useMetricoolBrandSummary,
  type MetricoolNetwork,
  aggregatePostsMetrics,
} from '@/hooks/useMetricoolPerformance';
import {
  CORE_NETWORKS,
  getNetworkBranding,
  type NetworkBranding,
} from '@/lib/network-branding';

interface Props {
  clientId: string;
  period: number;
  /** IDs de canais arquivados pelo cliente (ex: client.social_media.archived_channels). */
  archivedChannels?: string[];
}

// Single source of truth — branding mora em network-branding.ts
const PLATFORMS: Array<{
  id: MetricoolNetwork;
  label: string;
  icon: LucideIcon;
  branding: NetworkBranding;
}> = CORE_NETWORKS.map((id) => {
  const b = getNetworkBranding(id);
  return { id: id as MetricoolNetwork, label: b.label, icon: b.icon, branding: b };
});

function fmt(n: number, decimals = 0): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals }).format(n);
}

interface PlatformRow {
  id: MetricoolNetwork;
  label: string;
  icon: LucideIcon;
  branding: NetworkBranding;
  posts: number;
  engagement: number;
  reach: number;
  followers: number;
  followersChange: number;
  loading: boolean;
}

function ComparisonRow({ row, maxPosts, maxReach, maxEng }: {
  row: PlatformRow;
  maxPosts: number;
  maxReach: number;
  maxEng: number;
  sortMetric: 'posts' | 'reach' | 'engagement';
}) {
  const Icon = row.icon;
  const branding = row.branding;
  const barWidth = (val: number, max: number) => (max > 0 ? (val / max) * 100 : 0);

  return (
    <div
      className="grid grid-cols-12 items-center gap-3 p-3 rounded-md border hover:bg-muted/30 transition"
      style={{ borderLeftColor: branding.primaryHex, borderLeftWidth: 3 }}
    >
      <div className="col-span-3 flex items-center gap-2 min-w-0">
        <div
          className={`h-8 w-8 rounded-md flex items-center justify-center ${branding.bgGradient} ${branding.iconOnBgClass}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{row.label}</div>
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {fmt(row.followers)} seguidores
            {row.followersChange !== 0 && (
              <span className={row.followersChange > 0 ? ' text-emerald-600' : ' text-red-500'}>
                {' '}({row.followersChange > 0 ? '+' : ''}{row.followersChange})
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="col-span-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Posts</div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold tabular-nums w-10">{fmt(row.posts)}</div>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${barWidth(row.posts, maxPosts)}%`,
                backgroundColor: branding.primaryHex,
              }}
            />
          </div>
        </div>
      </div>

      <div className="col-span-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Alcance</div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold tabular-nums w-12">{fmt(row.reach)}</div>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${barWidth(row.reach, maxReach)}%`,
                backgroundColor: branding.primaryHex,
              }}
            />
          </div>
        </div>
      </div>

      <div className="col-span-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Eng %</div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold tabular-nums w-12">{row.engagement.toFixed(2)}%</div>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${barWidth(row.engagement, maxEng)}%`,
                backgroundColor: branding.primaryHex,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CrossPlatformComparison({ clientId, period, archivedChannels = [] }: Props) {
  const { data: summary } = useMetricoolBrandSummary(clientId, period);

  // Filtra plataformas arquivadas pelo cliente. Mantém uma lista estável dentro
  // do componente pra useMemo deps continuarem corretos.
  const visiblePlatforms = useMemo(
    () => PLATFORMS.filter((p) => !archivedChannels.includes(p.id)),
    [archivedChannels],
  );

  // Hooks paralelos por plataforma
  const igQ = useMetricoolPosts(clientId, 'instagram', period);
  const twQ = useMetricoolPosts(clientId, 'twitter', period);
  const thQ = useMetricoolPosts(clientId, 'threads', period);
  const liQ = useMetricoolPosts(clientId, 'linkedin', period);
  const ttQ = useMetricoolPosts(clientId, 'tiktok', period);
  const ytQ = useMetricoolPosts(clientId, 'youtube', period);
  const fbQ = useMetricoolPosts(clientId, 'facebook', period);

  const queries: Record<MetricoolNetwork, ReturnType<typeof useMetricoolPosts>> = {
    instagram: igQ,
    twitter: twQ,
    threads: thQ,
    linkedin: liQ,
    tiktok: ttQ,
    youtube: ytQ,
    facebook: fbQ,
    pinterest: igQ, // placeholder (não usado — não está em PLATFORMS)
    bluesky: igQ,
  };

  const rows: PlatformRow[] = useMemo(() => {
    return visiblePlatforms.map((p) => {
      const q = queries[p.id];
      const posts = q.data || [];
      const agg = aggregatePostsMetrics(posts);
      const ps = summary?.platforms?.[p.id];
      return {
        id: p.id,
        label: p.label,
        icon: p.icon,
        branding: p.branding,
        posts: posts.length,
        engagement: agg.avgEngagementRate,
        reach: agg.totalReach,
        followers: ps?.followerStats?.current ?? 0,
        followersChange: ps?.followerStats?.change7d ?? 0,
        loading: q.isLoading,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePlatforms, igQ.data, twQ.data, thQ.data, liQ.data, ttQ.data, ytQ.data, fbQ.data, summary, igQ.isLoading, twQ.isLoading, thQ.isLoading, liQ.isLoading, ttQ.isLoading, ytQ.isLoading, fbQ.isLoading]);

  const isLoading = rows.some((r) => r.loading);
  const activePlatforms = rows.filter((r) => r.posts > 0 || r.followers > 0);
  const sorted = (metric: 'posts' | 'reach' | 'engagement') =>
    [...activePlatforms].sort((a, b) => (b as any)[metric] - (a as any)[metric]);

  const maxPosts = Math.max(...activePlatforms.map((r) => r.posts), 1);
  const maxReach = Math.max(...activePlatforms.map((r) => r.reach), 1);
  const maxEng = Math.max(...activePlatforms.map((r) => r.engagement), 1);

  if (isLoading && activePlatforms.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (activePlatforms.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground text-center">
          Nenhuma plataforma com dados no período. Conecte canais ou aumente o range.
        </CardContent>
      </Card>
    );
  }

  // Top 3 highlights — guarda contra valores zerados (vencedor com 0 reach é bug)
  // Floor de "min 3 posts" no winner de eng% pra evitar outliers (1 post 100%).
  const winners = {
    posts: sorted('posts').find((r) => r.posts > 0) ?? null,
    reach: sorted('reach').find((r) => r.reach > 0) ?? null,
    engagement: sorted('engagement').find((r) => r.engagement > 0 && r.posts >= 3) ?? null,
  };

  return (
    <div className="space-y-4">
      {/* Highlights — só renderiza se há winner real */}
      {(winners.posts || winners.reach || winners.engagement) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {winners.posts && (
            <Card className="bg-sky-500/5 border-sky-500/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="h-4 w-4 text-sky-500" />
                  <span className="text-xs uppercase tracking-wider text-sky-700 dark:text-sky-400 font-semibold">Mais ativa</span>
                </div>
                <div className="text-base font-bold">{winners.posts.label}</div>
                <div className="text-xs text-muted-foreground">{fmt(winners.posts.posts)} posts no período</div>
              </CardContent>
            </Card>
          )}
          {winners.reach && (
            <Card className="bg-emerald-500/5 border-emerald-500/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold">Maior alcance</span>
                </div>
                <div className="text-base font-bold">{winners.reach.label}</div>
                <div className="text-xs text-muted-foreground">{fmt(winners.reach.reach)} pessoas alcançadas</div>
              </CardContent>
            </Card>
          )}
          {winners.engagement && (
            <Card className="bg-amber-500/5 border-amber-500/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  <span className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">Maior eng %</span>
                </div>
                <div className="text-base font-bold">{winners.engagement.label}</div>
                <div className="text-xs text-muted-foreground">{winners.engagement.engagement.toFixed(2)}% de engajamento</div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Comparativo ordenável */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="kai-eyebrow text-xs">Comparativo cross-platform</span>
              <h3 className="text-sm font-semibold mt-1">{activePlatforms.length} plataformas ativas</h3>
            </div>
          </div>
          <Tabs defaultValue="reach">
            <TabsList>
              <TabsTrigger value="reach">Por alcance</TabsTrigger>
              <TabsTrigger value="engagement">Por eng %</TabsTrigger>
              <TabsTrigger value="posts">Por volume</TabsTrigger>
            </TabsList>
            {(['reach', 'engagement', 'posts'] as const).map((sortMetric) => (
              <TabsContent key={sortMetric} value={sortMetric} className="mt-3 space-y-2">
                {sorted(sortMetric).map((row) => (
                  <ComparisonRow
                    key={row.id}
                    row={row}
                    maxPosts={maxPosts}
                    maxReach={maxReach}
                    maxEng={maxEng}
                    sortMetric={sortMetric}
                  />
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
