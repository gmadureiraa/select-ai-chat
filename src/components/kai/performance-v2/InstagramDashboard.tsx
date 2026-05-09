// Instagram dashboard — overlay sobre PlatformDashboard com sub-tabs Posts/Reels/Stories.
// Layout v4 (2026-05-09): chart hero unificado + KPI mini-row 6 cards.
import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Image as ImageIcon, Film, Circle, Heart, MessageCircle, Eye, TrendingUp, Users, FileText } from 'lucide-react';
import {
  useMetricoolPosts,
  useMetricoolReels,
  useMetricoolStories,
  useMetricoolBrandSummary,
  aggregatePostsMetrics,
} from '@/hooks/useMetricoolPerformance';
import { KPICard } from './components/KPICard';
import { PostsGrid } from './components/PostsGrid';
import { PostsLeaderboard } from './components/PostsLeaderboard';
import { BestPostHighlight } from './components/BestPostHighlight';
import { EngagementHeatmap } from './components/EngagementHeatmap';
import { GrowthDelta } from './components/GrowthDelta';
import { FormatBreakdown } from './components/FormatBreakdown';
import { MetricChartHero } from './components/MetricChartHero';
import { MetricoolBestTimesCard } from '@/components/metricool/MetricoolBestTimesCard';
import { useOpenPlanningFromPost } from '@/hooks/useOpenPlanningFromPost';

interface Props {
  clientId: string;
  period: number;
}

export function InstagramDashboardV2({ clientId, period }: Props) {
  const [subTab, setSubTab] = useState<'posts' | 'reels' | 'stories'>('posts');

  const { data: posts = [], isLoading: isLoadingPosts } = useMetricoolPosts(clientId, 'instagram', period);
  const { data: reels = [], isLoading: isLoadingReels } = useMetricoolReels(clientId, 'instagram', period);
  // Stories duram 24h — período máximo significativo é 7d
  const storiesPeriod = Math.min(period, 7);
  const { data: stories = [], isLoading: isLoadingStories } = useMetricoolStories(clientId, 'instagram', storiesPeriod);
  const { data: summary, isLoading: isLoadingSummary, dataUpdatedAt } = useMetricoolBrandSummary(clientId, period);

  const igSummary = summary?.platforms?.instagram;
  const followersHistory = igSummary?.followerStats?.history || [];
  const followersCurrent = igSummary?.followerStats?.current || 0;
  const followersChange = igSummary?.followerStats?.change7d || 0;

  // Agregados por tipo
  const aggPosts = useMemo(() => aggregatePostsMetrics(posts), [posts]);
  const aggReels = useMemo(() => aggregatePostsMetrics(reels), [reels]);
  const aggStories = useMemo(() => aggregatePostsMetrics(stories), [stories]);

  // Total combinado pra KPI top
  const totalContent = posts.length + reels.length + stories.length;
  const totalLikes = aggPosts.totalLikes + aggReels.totalLikes + aggStories.totalLikes;
  const totalComments = aggPosts.totalComments + aggReels.totalComments + aggStories.totalComments;
  const totalEng = totalLikes + totalComments;
  const totalReach =
    aggPosts.totalReach + aggReels.totalReach + aggStories.totalReach;
  const totalImpressions =
    aggPosts.totalImpressions + aggReels.totalImpressions + aggStories.totalImpressions;
  // Denom real: reach quando existir, senão impressions (Stories sem reach IG, etc.)
  const engDenom = Math.max(totalReach, totalImpressions);
  const avgEng = engDenom > 0 ? (totalEng / engDenom) * 100 : 0;

  const isLoading = isLoadingPosts || isLoadingReels || isLoadingStories || isLoadingSummary;
  const openPlanning = useOpenPlanningFromPost();

  const activePosts = subTab === 'posts' ? posts : subTab === 'reels' ? reels : stories;
  const activeAgg = subTab === 'posts' ? aggPosts : subTab === 'reels' ? aggReels : aggStories;

  return (
    <div className="space-y-4">
      {/* 1. ⭐ Chart hero — combina posts + reels (stories normalmente sem reach IG) */}
      <MetricChartHero
        posts={[...posts, ...reels]}
        followersHistory={followersHistory}
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
          value={totalContent}
          subValue={`${posts.length}p · ${reels.length}r · ${stories.length}s`}
          icon={<FileText className="h-4 w-4" />}
          loading={isLoading}
        />
        <KPICard
          label="Eng %"
          value={`${avgEng.toFixed(2)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={isLoading}
        />
        <KPICard
          label="Alcance"
          value={totalReach}
          subValue={`${period}d`}
          icon={<Eye className="h-4 w-4" />}
          loading={isLoading}
        />
        <KPICard
          label="Likes total"
          value={totalLikes}
          icon={<Heart className="h-4 w-4" />}
          loading={isLoading}
        />
        <KPICard
          label="Comments total"
          value={totalComments}
          icon={<MessageCircle className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      {/* 3. Best post + 4. Growth delta */}
      <BestPostHighlight
        posts={[...posts, ...reels, ...stories]}
        loading={isLoading}
        network="instagram"
        clientId={clientId}
      />
      <GrowthDelta clientId={clientId} network="instagram" period={period} />

      {/* 5. Format Breakdown — IG-specific (Posts/Carousel/Reels/Stories) */}
      <FormatBreakdown posts={posts} reels={reels} stories={stories} loading={isLoading} />

      {/* 6. Engagement Heatmap — combina posts+reels, com seletor próprio */}
      <EngagementHeatmap posts={[...posts, ...reels]} loading={isLoading} network="instagram" />

      {/* 7. Sub-tabs: Posts | Reels | Stories */}
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as 'posts' | 'reels' | 'stories')}>
        <TabsList>
          <TabsTrigger value="posts" className="gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" /> Posts ({posts.length})
          </TabsTrigger>
          <TabsTrigger value="reels" className="gap-1.5">
            <Film className="h-3.5 w-3.5" /> Reels ({reels.length})
          </TabsTrigger>
          <TabsTrigger value="stories" className="gap-1.5">
            <Circle className="h-3.5 w-3.5" /> Stories ({stories.length})
            {period > 7 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1 py-0 h-4 ml-1 leading-none"
                title="Stories duram 24h — período máximo significativo é 7d"
              >
                Últimos 7d
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={subTab} className="mt-4">
          {/* Mini-stats da sub-aba ativa */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-bold tabular-nums">{activePosts.length}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">Likes</div>
              <div className="text-lg font-bold tabular-nums">{activeAgg.totalLikes.toLocaleString('pt-BR')}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">Comments</div>
              <div className="text-lg font-bold tabular-nums">{activeAgg.totalComments.toLocaleString('pt-BR')}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">Eng%</div>
              <div className="text-lg font-bold tabular-nums">{activeAgg.avgEngagementRate.toFixed(2)}%</div>
            </div>
          </div>

          {/* Leaderboard + Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <PostsLeaderboard posts={activePosts} network="instagram" loading={isLoading} />
            </div>
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="pt-6">
                  <PostsGrid
                    posts={activePosts}
                    network="instagram"
                    loading={isLoading}
                    onClick={openPlanning}
                    clientId={clientId}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 8. Best Times — fixo embaixo da Performance do Instagram */}
      <MetricoolBestTimesCard clientId={clientId} />
    </div>
  );
}
