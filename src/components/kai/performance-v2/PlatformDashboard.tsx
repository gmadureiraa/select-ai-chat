// Dashboard genérico por plataforma — alimentado APENAS por Metricool API.
// Layout v4 (2026-05-09):
//   1. ⭐ MetricChartHero — UM chart grande com seletor de 9 métricas (substitui 4 charts pequenos)
//   2. KPI mini-row (6 cards compactos): Seguidores · Posts · Eng% · Alcance · Likes · Comments
//   3. Best Post Highlight
//   4. Growth Delta (período atual vs anterior)
//   5. Engagement Heatmap (com seletor próprio)
//   6. Posts grid + Leaderboard
//   7. ⏰ Best Times (DENTRO da rede, último bloco)
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, MessageCircle, Eye, TrendingUp, Users, FileText } from 'lucide-react';
import {
  useMetricoolPosts,
  useLinkedInPostsHybrid,
  useMetricoolBrandSummary,
  type MetricoolNetwork,
  aggregatePostsMetrics,
} from '@/hooks/useMetricoolPerformance';
import { KPICard } from './components/KPICard';
import { PostsGrid } from './components/PostsGrid';
import { PostsLeaderboard } from './components/PostsLeaderboard';
import { BestPostHighlight } from './components/BestPostHighlight';
import { EngagementHeatmap } from './components/EngagementHeatmap';
import { GrowthDelta } from './components/GrowthDelta';
import { MetricChartHero } from './components/MetricChartHero';
import { MetricoolBestTimesCard } from '@/components/metricool/MetricoolBestTimesCard';
import { useOpenPlanningFromPost } from '@/hooks/useOpenPlanningFromPost';
import { useHistoricalSnapshots } from '@/hooks/useHistoricalSnapshots';

interface Props {
  clientId: string;
  network: MetricoolNetwork;
  period: number; // dias
}

export function PlatformDashboard({ clientId, network, period }: Props) {
  // LinkedIn personal profiles não retornam posts pela Metricool API — usa
  // strategy hybrida (cache local + scrape Apify on-demand). Pra outras
  // redes (twitter, threads, tiktok, etc.) vai direto na Metricool.
  const metricoolQuery = useMetricoolPosts(clientId, network, period);
  const linkedinHybrid = useLinkedInPostsHybrid(
    network === 'linkedin' ? clientId : '',
    period,
  );
  const isLinkedIn = network === 'linkedin';
  const posts = (isLinkedIn ? linkedinHybrid.data : metricoolQuery.data) ?? [];
  const isLoadingPosts = isLinkedIn ? linkedinHybrid.isLoading : metricoolQuery.isLoading;

  const { data: summary, isLoading: isLoadingSummary, dataUpdatedAt } = useMetricoolBrandSummary(clientId, period);
  const { data: snapshotResp } = useHistoricalSnapshots(clientId, network, period);

  const platformSummary = summary?.platforms?.[network];
  const followersHistory = platformSummary?.followerStats?.history || [];
  const followersCurrent = platformSummary?.followerStats?.current || 0;
  const followersChange = platformSummary?.followerStats?.change7d || 0;

  const aggregates = useMemo(() => aggregatePostsMetrics(posts), [posts]);
  const isLoading = isLoadingPosts || isLoadingSummary;
  const openPlanning = useOpenPlanningFromPost();

  return (
    <div className="space-y-4">
      {/* 1. ⭐ Chart hero — 1 chart grande com seletor de 9 métricas */}
      <MetricChartHero
        posts={posts}
        followersHistory={followersHistory}
        historicalSnapshots={snapshotResp?.snapshots}
        loading={isLoading}
        period={period}
        lastUpdatedAt={dataUpdatedAt}
      />

      {/* 2. KPI mini-row — 6 cards compactos */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Seguidores"
          value={followersCurrent}
          icon={<Users className="h-4 w-4" />}
          trend={followersChange > 0 ? 'up' : followersChange < 0 ? 'down' : 'neutral'}
          trendValue={
            followersChange !== 0
              ? `${followersChange > 0 ? '+' : ''}${followersChange} (7d)`
              : undefined
          }
          loading={isLoading}
        />
        <KPICard
          label="Posts"
          value={aggregates.postsCount}
          subValue={`${period}d`}
          icon={<FileText className="h-4 w-4" />}
          loading={isLoading}
        />
        <KPICard
          label="Eng %"
          value={`${aggregates.avgEngagementRate.toFixed(2)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={isLoading}
        />
        <KPICard
          label="Alcance"
          value={aggregates.totalReach}
          subValue={
            aggregates.totalImpressions > 0
              ? `${aggregates.totalImpressions.toLocaleString('pt-BR')} imp.`
              : undefined
          }
          icon={<Eye className="h-4 w-4" />}
          loading={isLoading}
        />
        <KPICard
          label="Likes total"
          value={aggregates.totalLikes}
          icon={<Heart className="h-4 w-4" />}
          loading={isLoading}
        />
        <KPICard
          label="Comments total"
          value={aggregates.totalComments}
          icon={<MessageCircle className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      {/* 3. Best Post Highlight */}
      <BestPostHighlight posts={posts} loading={isLoadingPosts} network={network} clientId={clientId} />

      {/* 4. Growth Delta — período atual vs anterior */}
      <GrowthDelta clientId={clientId} network={network} period={period} />

      {/* 5. Engagement Heatmap — seletor de métrica próprio */}
      <EngagementHeatmap posts={posts} loading={isLoadingPosts} network={network} />

      {/* 6. Top 5 leaderboard + Posts grid lado-a-lado em desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <PostsLeaderboard
            posts={posts}
            network={network}
            loading={isLoading}
            clientId={clientId}
          />
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <span className="kai-eyebrow text-xs">Posts {network}</span>
                  <h3 className="text-sm font-semibold mt-1">{posts.length} no período</h3>
                </div>
              </div>
              <PostsGrid
                posts={posts}
                network={network}
                loading={isLoading}
                onClick={openPlanning}
                clientId={clientId}
                transcriptionSource="metricool"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 7. Best Times — fixo embaixo, único da rede atual */}
      <MetricoolBestTimesCard clientId={clientId} />
    </div>
  );
}

/* Re-exports usados pelos sub-imports do principal */
export type { MetricoolNetwork };
