// CrossPlatformComparison — view comparativa de TODAS as plataformas conectadas
// lado a lado. Ranqueia plataformas por engagement, alcance, posts.
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sparkline } from './components/charts/svg-primitives';
import {
  TrendingUp,
  Heart,
  Eye,
  AlertTriangle,
  Flame,
  Info,
  type LucideIcon,
} from 'lucide-react';
import {
  useMetricoolPosts,
  useMetricoolBrandSummary,
  type MetricoolNetwork,
  aggregatePostsMetrics,
} from '@/hooks/useMetricoolPerformance';
import { useHistoricalSnapshots } from '@/hooks/useHistoricalSnapshots';
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
  /**
   * Quando true, o `reach` mostrado é fallback de impressions/views porque
   * a Metricool API não retornou `reach` real (típico de Twitter/Threads/LinkedIn).
   * Usado pra exibir tooltip explicando a métrica.
   */
  reachIsFallback: boolean;
  followers: number;
  followersChange: number;
  /** % de crescimento de followers no período (vs primeiro snapshot disponível). */
  growthPct: number;
  /** Série de followers nos últimos N dias pra sparkline inline. */
  followersSeries: Array<{ value: number }>;
  loading: boolean;
  /** Marcação visual: rede com maior crescimento % do período. */
  isHotLeader: boolean;
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
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate flex items-center gap-1">
            {row.label}
            {row.isHotLeader && (
              <TooltipProvider delayDuration={150}>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 text-[9px] font-bold"
                      aria-label="Maior crescimento da semana"
                    >
                      <Flame className="h-2.5 w-2.5" />
                      HOT
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Maior crescimento de seguidores no período ({row.growthPct >= 0 ? '+' : ''}
                    {row.growthPct.toFixed(2)}%)
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {fmt(row.followers)} seguidores
            {row.followersChange !== 0 && (
              <span className={row.followersChange > 0 ? ' text-emerald-600' : ' text-red-500'}>
                {' '}({row.followersChange > 0 ? '+' : ''}{row.followersChange})
              </span>
            )}
          </div>
          {/* Mini sparkline 30d de followers (snapshots locais) */}
          {row.followersSeries.length >= 2 && (
            <div
              className="h-5 mt-0.5 max-w-[140px]"
              role="img"
              aria-label={`Tendência de seguidores nos últimos 30 dias: ${row.followersChange > 0 ? "+" : ""}${row.followersChange}`}
            >
              <Sparkline
                data={row.followersSeries}
                color={branding.primaryHex}
                strokeWidth={1.4}
              />
            </div>
          )}
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
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          Alcance
          {row.reachIsFallback && (
            <TooltipProvider delayDuration={150}>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="h-2.5 w-2.5 text-muted-foreground/70 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[220px]">
                  {row.label} não retorna alcance — usando impressões como
                  proxy. Eng% recalculado sobre impressões.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          )}
        </div>
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

  // Hooks paralelos por plataforma (posts)
  const igQ = useMetricoolPosts(clientId, 'instagram', period);
  const twQ = useMetricoolPosts(clientId, 'twitter', period);
  const thQ = useMetricoolPosts(clientId, 'threads', period);
  const liQ = useMetricoolPosts(clientId, 'linkedin', period);
  const ttQ = useMetricoolPosts(clientId, 'tiktok', period);
  const ytQ = useMetricoolPosts(clientId, 'youtube', period);
  const fbQ = useMetricoolPosts(clientId, 'facebook', period);

  // Snapshots históricos (followers) por plataforma — pra sparkline + growth%.
  // Período usado pra sparkline = max(period, 30) pra evitar linha plana
  // quando user seleciona "7d" (3-4 pontos não dão visual).
  const snapPeriod = Math.max(period, 30);
  const igSnap = useHistoricalSnapshots(clientId, 'instagram', snapPeriod);
  const twSnap = useHistoricalSnapshots(clientId, 'twitter', snapPeriod);
  const thSnap = useHistoricalSnapshots(clientId, 'threads', snapPeriod);
  const liSnap = useHistoricalSnapshots(clientId, 'linkedin', snapPeriod);
  const ttSnap = useHistoricalSnapshots(clientId, 'tiktok', snapPeriod);
  const ytSnap = useHistoricalSnapshots(clientId, 'youtube', snapPeriod);
  const fbSnap = useHistoricalSnapshots(clientId, 'facebook', snapPeriod);

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

  const snapsByNet: Record<MetricoolNetwork, ReturnType<typeof useHistoricalSnapshots>> = {
    instagram: igSnap,
    twitter: twSnap,
    threads: thSnap,
    linkedin: liSnap,
    tiktok: ttSnap,
    youtube: ytSnap,
    facebook: fbSnap,
    pinterest: igSnap,
    bluesky: igSnap,
  };

  const rows: PlatformRow[] = useMemo(() => {
    return visiblePlatforms.map((p) => {
      const q = queries[p.id];
      const posts = q.data || [];
      const agg = aggregatePostsMetrics(posts);
      const ps = summary?.platforms?.[p.id];
      const snaps = snapsByNet[p.id]?.data?.snapshots || [];

      // Reach fallback: redes sem reach real (Twitter/Threads/LinkedIn)
      // recebem impressions como denom. Se totalReach=0 mas há impressions,
      // usamos impressions como proxy de "alcance" pra UI ficar útil.
      const reachIsFallback = agg.totalReach === 0 && agg.totalImpressions > 0;
      const displayReach = reachIsFallback ? agg.totalImpressions : agg.totalReach;

      // Series pra sparkline (followers > 0 only, ordenado ASC por data)
      const followersSeries = snaps
        .filter((s) => s.followers != null && s.followers > 0)
        .map((s) => ({ value: s.followers as number }));

      // Growth % = baseline (1º não-zero) → último
      let growthPct = 0;
      if (followersSeries.length >= 2) {
        const baseline = followersSeries[0].value;
        const latest = followersSeries[followersSeries.length - 1].value;
        growthPct = baseline > 0 ? ((latest - baseline) / baseline) * 100 : 0;
      }

      return {
        id: p.id,
        label: p.label,
        icon: p.icon,
        branding: p.branding,
        posts: posts.length,
        engagement: agg.avgEngagementRate,
        reach: displayReach,
        reachIsFallback,
        followers: ps?.followerStats?.current ?? 0,
        followersChange: ps?.followerStats?.change7d ?? 0,
        growthPct,
        followersSeries,
        loading: q.isLoading,
        isHotLeader: false, // resolvido no segundo pass abaixo
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visiblePlatforms,
    igQ.data, twQ.data, thQ.data, liQ.data, ttQ.data, ytQ.data, fbQ.data,
    summary,
    igQ.isLoading, twQ.isLoading, thQ.isLoading, liQ.isLoading, ttQ.isLoading, ytQ.isLoading, fbQ.isLoading,
    igSnap.data, twSnap.data, thSnap.data, liSnap.data, ttSnap.data, ytSnap.data, fbSnap.data,
  ]);

  // Marca a rede com maior growth% (entre as que têm > 0 — só conta crescimento positivo).
  // Empate: pega a primeira da lista visível (estável visualmente).
  const hotLeaderId = useMemo(() => {
    const positives = rows.filter((r) => r.growthPct > 0);
    if (positives.length === 0) return null;
    return positives.reduce((a, b) => (b.growthPct > a.growthPct ? b : a)).id;
  }, [rows]);

  const decoratedRows = useMemo(
    () => rows.map((r) => ({ ...r, isHotLeader: r.id === hotLeaderId })),
    [rows, hotLeaderId],
  );

  const isLoading = decoratedRows.some((r) => r.loading);
  const activePlatforms = decoratedRows.filter((r) => r.posts > 0 || r.followers > 0);
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

  // "Pior" plataforma — menor eng % com pelo menos 3 posts. Útil pra entender
  // o que NÃO está funcionando.
  const eligibleForWorst = activePlatforms.filter((r) => r.posts >= 3);
  const worstEng =
    eligibleForWorst.length >= 2
      ? [...eligibleForWorst].sort((a, b) => a.engagement - b.engagement)[0]
      : null;

  return (
    <div className="space-y-4">
      {/* Highlights — só renderiza se há winner real */}
      {(winners.posts || winners.reach || winners.engagement || worstEng) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
          {worstEng && (
            <Card className="bg-rose-500/5 border-rose-500/30">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  <span className="text-xs uppercase tracking-wider text-rose-700 dark:text-rose-400 font-semibold">Precisa atenção</span>
                </div>
                <div className="text-base font-bold">{worstEng.label}</div>
                <div className="text-xs text-muted-foreground">
                  {worstEng.engagement.toFixed(2)}% eng · {fmt(worstEng.posts)} posts
                </div>
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
