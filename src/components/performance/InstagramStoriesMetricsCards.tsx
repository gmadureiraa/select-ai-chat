import { useMemo } from "react";
import { Eye, Heart, MessageCircle, MousePointer, Share2, Target } from "lucide-react";
import { MetricMiniCard } from "./MetricMiniCard";
import { InstagramStory } from "@/hooks/useInstagramStories";

interface InstagramStoriesMetricsCardsProps {
  stories: InstagramStory[];
  previousStories: InstagramStory[];
  hasPreviousData: boolean;
}

export function InstagramStoriesMetricsCards({
  stories,
  previousStories,
  hasPreviousData,
}: InstagramStoriesMetricsCardsProps) {
  const metrics = useMemo(() => {
    // Current period metrics
    const totalViews = stories.reduce((sum, s) => sum + (s.views || 0), 0);
    const totalReach = stories.reduce((sum, s) => sum + (s.reach || 0), 0);
    const totalLikes = stories.reduce((sum, s) => sum + (s.likes || 0), 0);
    const totalReplies = stories.reduce((sum, s) => sum + (s.replies || 0), 0);
    const totalShares = stories.reduce((sum, s) => sum + (s.shares || 0), 0);
    const totalInteractions = stories.reduce((sum, s) => sum + (s.interactions || s.likes || 0) + (s.replies || 0) + (s.shares || 0), 0);
    
    // Get link clicks from metadata
    const totalLinkClicks = stories.reduce((sum, s) => {
      const meta = s.metadata as Record<string, unknown> | null;
      return sum + (Number(meta?.link_clicks) || 0);
    }, 0);
    
    // Get profile visits from metadata
    const totalProfileVisits = stories.reduce((sum, s) => {
      const meta = s.metadata as Record<string, unknown> | null;
      return sum + (Number(meta?.profile_visits) || 0);
    }, 0);
    
    // Average views per story
    const avgViews = stories.length > 0 ? Math.round(totalViews / stories.length) : 0;

    // Previous period metrics
    const prevTotalViews = previousStories.reduce((sum, s) => sum + (s.views || 0), 0);
    const prevTotalReach = previousStories.reduce((sum, s) => sum + (s.reach || 0), 0);
    const prevTotalReplies = previousStories.reduce((sum, s) => sum + (s.replies || 0), 0);
    const prevTotalInteractions = previousStories.reduce((sum, s) => sum + (s.interactions || s.likes || 0) + (s.replies || 0) + (s.shares || 0), 0);
    const prevTotalLinkClicks = previousStories.reduce((sum, s) => {
      const meta = s.metadata as Record<string, unknown> | null;
      return sum + (Number(meta?.link_clicks) || 0);
    }, 0);
    const prevAvgViews = previousStories.length > 0 ? Math.round(prevTotalViews / previousStories.length) : 0;

    // Calculate changes
    const calcChange = (current: number, previous: number): number | undefined => {
      if (!hasPreviousData || previous === 0) return undefined;
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      avgViews,
      avgViewsChange: calcChange(avgViews, prevAvgViews),
      totalViews,
      totalViewsChange: calcChange(totalViews, prevTotalViews),
      totalReach,
      totalReachChange: calcChange(totalReach, prevTotalReach),
      totalInteractions,
      totalInteractionsChange: calcChange(totalInteractions, prevTotalInteractions),
      totalReplies,
      totalRepliesChange: calcChange(totalReplies, prevTotalReplies),
      totalLinkClicks,
      totalLinkClicksChange: calcChange(totalLinkClicks, prevTotalLinkClicks),
      totalProfileVisits,
      totalShares,
      storyCount: stories.length,
    };
  }, [stories, previousStories, hasPreviousData]);

  if (stories.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Métricas de Stories</h3>
        <span className="text-sm text-muted-foreground">
          {metrics.storyCount} stories no período
        </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricMiniCard
          icon={Eye}
          label="Média de Views"
          value={metrics.avgViews}
          change={metrics.avgViewsChange}
          color="violet"
        />
        <MetricMiniCard
          icon={Target}
          label="Alcance Total"
          value={metrics.totalReach}
          change={metrics.totalReachChange}
          color="blue"
        />
        <MetricMiniCard
          icon={Heart}
          label="Interações"
          value={metrics.totalInteractions}
          change={metrics.totalInteractionsChange}
          color="rose"
        />
        <MetricMiniCard
          icon={MessageCircle}
          label="Respostas"
          value={metrics.totalReplies}
          change={metrics.totalRepliesChange}
          color="emerald"
        />
        <MetricMiniCard
          icon={MousePointer}
          label="Cliques no Link"
          value={metrics.totalLinkClicks}
          change={metrics.totalLinkClicksChange}
          color="amber"
        />
      </div>
    </div>
  );
}
