// Dashboard genérico por plataforma — alimentado APENAS por Metricool API.
// Layout v3 (2026-05-09):
//   1. KPIs row (4 cards)
//   2. ⭐ TimeSeriesCharts — 4 line charts (followers, eng, likes, comments)
//   3. Best Post Highlight
//   4. Growth Delta (período atual vs anterior)
//   5. Engagement Heatmap
//   6. Posts grid + Leaderboard
//   7. ⏰ Best Times (DENTRO da rede, último bloco)
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, Eye, TrendingUp, Users } from 'lucide-react';
import {
  useMetricoolPosts,
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
import { TimeSeriesCharts } from './components/TimeSeriesCharts';
import { MetricoolBestTimesCard } from '@/components/metricool/MetricoolBestTimesCard';

interface Props {
  clientId: string;
  network: MetricoolNetwork;
  period: number; // dias
}

// Mapeia nossa network pra label do MetricoolBestTimesCard (que aceita platform string).
const NETWORK_TO_PLATFORM: Record<MetricoolNetwork, string> = {
  instagram: 'instagram',
  twitter: 'twitter',
  threads: 'threads',
  linkedin: 'linkedin',
  tiktok: 'tiktok',
  youtube: 'youtube',
  facebook: 'facebook',
  pinterest: 'pinterest',
  bluesky: 'bluesky',
};

export function PlatformDashboard({ clientId, network, period }: Props) {
  const { data: posts = [], isLoading: isLoadingPosts } = useMetricoolPosts(clientId, network, period);
  const { data: summary, isLoading: isLoadingSummary } = useMetricoolBrandSummary(clientId, period);

  const platformSummary = summary?.platforms?.[network];
  const followersHistory = platformSummary?.followerStats?.history || [];
  const followersCurrent = platformSummary?.followerStats?.current || 0;
  const followersChange = platformSummary?.followerStats?.change7d || 0;

  const aggregates = useMemo(() => aggregatePostsMetrics(posts), [posts]);
  const isLoading = isLoadingPosts || isLoadingSummary;

  return (
    <div className="space-y-4">
      {/* 1. KPI cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Seguidores"
          value={followersCurrent}
          subValue={followersHistory.length > 1 ? `${followersHistory.length} pontos` : undefined}
          icon={<Users className="h-4 w-4" />}
          trend={followersChange > 0 ? 'up' : followersChange < 0 ? 'down' : 'neutral'}
          trendValue={followersChange !== 0 ? `${followersChange > 0 ? '+' : ''}${followersChange} (7d)` : undefined}
          loading={isLoading}
        />
        <KPICard
          label="Posts no período"
          value={aggregates.postsCount}
          subValue={`últimos ${period}d`}
          icon={<Eye className="h-4 w-4" />}
          loading={isLoading}
        />
        <KPICard
          label="Engajamento médio"
          value={`${aggregates.avgEngagementRate.toFixed(2)}%`}
          subValue={`${aggregates.totalLikes + aggregates.totalComments} interações`}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={isLoading}
        />
        <KPICard
          label="Alcance total"
          value={aggregates.totalReach}
          subValue={aggregates.totalImpressions > 0 ? `${aggregates.totalImpressions} impressões` : undefined}
          icon={<Heart className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      {/* 2. Charts ao longo do tempo (4 line charts) */}
      <TimeSeriesCharts
        posts={posts}
        followersHistory={followersHistory}
        loading={isLoading}
        period={period}
      />

      {/* 3. Best Post Highlight */}
      <BestPostHighlight posts={posts} loading={isLoadingPosts} network={network} />

      {/* 4. Growth Delta — período atual vs anterior */}
      <GrowthDelta clientId={clientId} network={network} period={period} />

      {/* 5. Engagement Heatmap (real, baseado nos posts do cliente) */}
      <EngagementHeatmap posts={posts} loading={isLoadingPosts} metric="engagement" />

      {/* 6. Top 5 leaderboard + Posts grid lado-a-lado em desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <PostsLeaderboard posts={posts} network={network} loading={isLoading} />
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
              <PostsGrid posts={posts} network={network} loading={isLoading} />
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
