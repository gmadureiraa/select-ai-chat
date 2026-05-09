// Instagram dashboard — overlay sobre PlatformDashboard com sub-tabs Posts/Reels/Stories.
import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Image as ImageIcon, Film, Circle, Heart, Eye, TrendingUp, Users } from 'lucide-react';
import {
  useMetricoolPosts,
  useMetricoolReels,
  useMetricoolStories,
  useMetricoolBrandSummary,
  aggregatePostsMetrics,
} from '@/hooks/useMetricoolPerformance';
import { KPICard } from './components/KPICard';
import { FollowersSparkline } from './components/FollowersSparkline';
import { PostsGrid } from './components/PostsGrid';
import { PostsLeaderboard } from './components/PostsLeaderboard';

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
  const { data: summary, isLoading: isLoadingSummary } = useMetricoolBrandSummary(clientId, period);

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
  const totalEng = aggPosts.totalLikes + aggPosts.totalComments
                 + aggReels.totalLikes + aggReels.totalComments
                 + aggStories.totalLikes + aggStories.totalComments;
  const totalReach = aggPosts.totalReach + aggReels.totalReach + aggStories.totalReach;
  const avgEng = totalReach > 0 ? (totalEng / totalReach) * 100 : 0;

  const isLoading = isLoadingPosts || isLoadingReels || isLoadingStories || isLoadingSummary;

  const activePosts = subTab === 'posts' ? posts : subTab === 'reels' ? reels : stories;
  const activeAgg = subTab === 'posts' ? aggPosts : subTab === 'reels' ? aggReels : aggStories;

  return (
    <div className="space-y-4">
      {/* KPI cards top — total agregado IG */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Seguidores"
          value={followersCurrent}
          icon={<Users className="h-4 w-4" />}
          trend={followersChange > 0 ? 'up' : followersChange < 0 ? 'down' : 'neutral'}
          trendValue={followersChange !== 0 ? `${followersChange > 0 ? '+' : ''}${followersChange} (7d)` : undefined}
          loading={isLoading}
        />
        <KPICard
          label="Conteúdo total"
          value={totalContent}
          subValue={`${posts.length} posts · ${reels.length} reels · ${stories.length} stories`}
          icon={<Eye className="h-4 w-4" />}
          loading={isLoading}
        />
        <KPICard
          label="Engajamento médio"
          value={`${avgEng.toFixed(2)}%`}
          subValue={`${totalEng.toLocaleString('pt-BR')} interações`}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={isLoading}
        />
        <KPICard
          label="Alcance total"
          value={totalReach}
          subValue={`últimos ${period}d`}
          icon={<Heart className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      {/* Followers timeline */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="kai-eyebrow text-xs">Evolução @ogmadureira</span>
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

      {/* Sub-tabs: Posts | Reels | Stories */}
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
                  <PostsGrid posts={activePosts} network="instagram" loading={isLoading} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
