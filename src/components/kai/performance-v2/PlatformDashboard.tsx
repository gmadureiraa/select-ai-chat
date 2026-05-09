// Dashboard genérico por plataforma — alimentado APENAS por Metricool API.
// Usado dentro do KaiPerformanceTab (v2) com tabs por plataforma.
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, MessageCircle, Eye, TrendingUp, Repeat2, Users } from 'lucide-react';
import {
  useMetricoolPosts,
  useMetricoolBrandSummary,
  type MetricoolNetwork,
  aggregatePostsMetrics,
} from '@/hooks/useMetricoolPerformance';
import { KPICard } from './components/KPICard';
import { FollowersSparkline } from './components/FollowersSparkline';
import { PostsGrid } from './components/PostsGrid';
import { PostsLeaderboard } from './components/PostsLeaderboard';
import { BestPostHighlight } from './components/BestPostHighlight';
import { EngagementHeatmap } from './components/EngagementHeatmap';
import { GrowthDelta } from './components/GrowthDelta';

interface Props {
  clientId: string;
  network: MetricoolNetwork;
  period: number; // dias
}

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
      {/* KPI cards row */}
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

      {/* Followers Sparkline */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="kai-eyebrow text-xs">Evolução de seguidores</span>
              <h3 className="text-sm font-semibold mt-1">Últimos {period} dias</h3>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-[80px] w-full" />
          ) : (
            <FollowersSparkline data={followersHistory} height={80} />
          )}
        </CardContent>
      </Card>

      {/* Best Post Highlight + Growth Delta */}
      <BestPostHighlight posts={posts} loading={isLoadingPosts} network={network} />
      <GrowthDelta clientId={clientId} network={network} period={period} />

      {/* Engagement Heatmap (real, baseado nos posts do cliente) */}
      <EngagementHeatmap posts={posts} loading={isLoadingPosts} metric="engagement" />

      {/* Top 5 leaderboard + Posts grid lado-a-lado em desktop */}
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
    </div>
  );
}

/* Re-exports usados pelos sub-imports do principal */
export type { MetricoolNetwork };
