import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, Heart, MessageCircle, Eye, Bookmark, Upload, Calendar, Share2, Target, TrendingUp, Settings, FileText } from "lucide-react";
import { GoalsPanel } from "./GoalsPanel";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { PerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { usePerformanceGoals } from "@/hooks/usePerformanceGoals";
import { InstagramPostsTable } from "./InstagramPostsTable";
import { SmartCSVUpload } from "./SmartCSVUpload";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
import { AIInsightsCard } from "./AIInsightsCard";
import { StatCard } from "./StatCard";
import { GoalGauge } from "./GoalGauge";
import { MetricMiniCard } from "./MetricMiniCard";
import { PerformanceReportGenerator } from "./PerformanceReportGenerator";

import { TopContentTable } from "./TopContentTable";
import { ImportHistoryPanel } from "./ImportHistoryPanel";
import { DataCompletenessWarning } from "./DataCompletenessWarning";
import { BestPostsByMetric } from "./BestPostsByMetric";
import { InstagramStoriesSection } from "./InstagramStoriesSection";
import { InstagramStoriesCSVUpload } from "./InstagramStoriesCSVUpload";
import { useInstagramStories } from "@/hooks/useInstagramStories";
import { format, subDays, isAfter, parseISO, startOfDay, getDay, getHours } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InstagramDashboardProps {
  clientId: string;
  posts: InstagramPost[];
  metrics: PerformanceMetrics[];
  isLoadingPosts?: boolean;
  isLoadingMetrics?: boolean;
}

const periodOptions = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo período" },
];

const metricOptions = [
  { key: "views", label: "Visualizações", dataKey: "views", color: "hsl(270, 70%, 55%)" },
  { key: "reach", label: "Alcance", dataKey: "reach", color: "hsl(290, 70%, 55%)" },
  { key: "interactions", label: "Interações", dataKey: "interactions", color: "hsl(45, 80%, 50%)" },
  { key: "linkClicks", label: "Clique no Link", dataKey: "linkClicks", color: "hsl(200, 80%, 55%)" },
  { key: "subscribers", label: "Seguidores", dataKey: "subscribers", color: "hsl(145, 80%, 45%)" },
  { key: "profileVisits", label: "Visitas", dataKey: "profileVisits", color: "hsl(350, 80%, 55%)" },
];

export function InstagramDashboard({ 
  clientId, 
  posts, 
  metrics, 
  isLoadingPosts, 
  isLoadingMetrics 
}: InstagramDashboardProps) {
  const [period, setPeriod] = useState("30");
  const [selectedMetric, setSelectedMetric] = useState("views");
  const [showUploadPosts, setShowUploadPosts] = useState(false);
  const [topPostsMetric, setTopPostsMetric] = useState("engagement");
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  
  const { goals } = usePerformanceGoals(clientId);
  const { data: stories = [], isLoading: isLoadingStories, refetch: refetchStories } = useInstagramStories(clientId);
  const instagramGoal = goals.find(g => g.platform === 'instagram' && g.metric_name === 'followers');

  // Filter data by period
  const cutoffDate = useMemo(() => {
    if (period === "all") return null;
    return startOfDay(subDays(new Date(), parseInt(period)));
  }, [period]);

  // Previous period cutoff for comparison
  const previousPeriodCutoff = useMemo(() => {
    if (period === "all") return null;
    const days = parseInt(period);
    return startOfDay(subDays(new Date(), days * 2));
  }, [period]);

  const filteredPosts = useMemo(() => {
    if (!cutoffDate) return posts;
    return posts.filter(post => 
      post.posted_at && isAfter(parseISO(post.posted_at), cutoffDate)
    );
  }, [posts, cutoffDate]);

  const filteredMetrics = useMemo(() => {
    if (!cutoffDate) return metrics;
    return metrics.filter(m => 
      m.metric_date && isAfter(parseISO(m.metric_date), cutoffDate)
    );
  }, [metrics, cutoffDate]);

  // Previous period metrics for comparison
  const previousPeriodMetrics = useMemo(() => {
    if (!previousPeriodCutoff || !cutoffDate) return [];
    return metrics.filter(m => {
      const date = parseISO(m.metric_date);
      return isAfter(date, previousPeriodCutoff) && !isAfter(date, cutoffDate);
    });
  }, [metrics, previousPeriodCutoff, cutoffDate]);

  // Previous period posts for comparison
  const previousPeriodPosts = useMemo(() => {
    if (!previousPeriodCutoff || !cutoffDate) return [];
    return posts.filter(post => {
      if (!post.posted_at) return false;
      const date = parseISO(post.posted_at);
      return isAfter(date, previousPeriodCutoff) && !isAfter(date, cutoffDate);
    });
  }, [posts, previousPeriodCutoff, cutoffDate]);

  // Helper to extract metrics from metadata safely
  const getMetadataValue = (m: PerformanceMetrics, key: string): number => {
    if (!m.metadata) return 0;
    const meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
    return meta?.[key] || 0;
  };

  // Calculate KPIs from filtered data with trends
  const kpis = useMemo(() => {
    const totalLikes = filteredPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = filteredPosts.reduce((sum, p) => sum + (p.comments || 0), 0);
    const totalSaves = filteredPosts.reduce((sum, p) => sum + (p.saves || 0), 0);
    const totalShares = filteredPosts.reduce((sum, p) => sum + (p.shares || 0), 0);
    const totalReachFromPosts = filteredPosts.reduce((sum, p) => sum + (p.reach || 0), 0);
    
    // Calculate average engagement: if posts have engagement_rate use it, otherwise calculate
    let avgEngagement = 0;
    if (filteredPosts.length > 0) {
      const postsWithEngagement = filteredPosts.filter(p => p.engagement_rate && p.engagement_rate > 0);
      if (postsWithEngagement.length > 0) {
        avgEngagement = postsWithEngagement.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / postsWithEngagement.length;
      } else {
        // Calculate engagement from interactions / reach
        const totalInteractions = totalLikes + totalComments + totalSaves + totalShares;
        const totalReach = totalReachFromPosts || filteredPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);
        if (totalReach > 0) {
          avgEngagement = (totalInteractions / totalReach) * 100;
        }
      }
    }

    const totalViews = filteredMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    
    // Calculate followers GAINED (difference between first and last day of period)
    // The subscribers field contains TOTAL followers, not daily delta
    const sortedByDate = [...filteredMetrics]
      .filter(m => m.subscribers && m.subscribers > 0)
      .sort((a, b) => new Date(a.metric_date).getTime() - new Date(b.metric_date).getTime());

    let followersGained = 0;
    if (sortedByDate.length >= 2) {
      const firstDay = sortedByDate[0].subscribers || 0;
      const lastDay = sortedByDate[sortedByDate.length - 1].subscribers || 0;
      followersGained = lastDay - firstDay;
    } else if (sortedByDate.length === 1) {
      // Only one data point, can't calculate difference
      followersGained = 0;
    }
    const totalReachFromMetrics = filteredMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'reach'), 0);
    const totalImpressions = filteredPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);
    const totalInteractions = filteredMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'interactions'), 0);
    const totalLinkClicks = filteredMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'linkClicks'), 0);
    const totalProfileVisits = filteredMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'profileVisits'), 0);

    const prevViews = previousPeriodMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    
    // Calculate previous period followers gained the same way
    const sortedPrevious = [...previousPeriodMetrics]
      .filter(m => m.subscribers && m.subscribers > 0)
      .sort((a, b) => new Date(a.metric_date).getTime() - new Date(b.metric_date).getTime());

    let prevFollowers = 0;
    if (sortedPrevious.length >= 2) {
      const firstDay = sortedPrevious[0].subscribers || 0;
      const lastDay = sortedPrevious[sortedPrevious.length - 1].subscribers || 0;
      prevFollowers = lastDay - firstDay;
    }
    const prevReach = previousPeriodMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'reach'), 0);
    const prevInteractions = previousPeriodMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'interactions'), 0);
    const prevLinkClicks = previousPeriodMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'linkClicks'), 0);
    const prevProfileVisits = previousPeriodMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'profileVisits'), 0);

    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      followersGained,
      followersChange: calcChange(followersGained, prevFollowers),
      totalPosts: filteredPosts.length,
      totalLikes,
      totalComments,
      totalSaves,
      totalShares,
      totalReach: totalReachFromMetrics || totalReachFromPosts,
      reachChange: calcChange(totalReachFromMetrics, prevReach),
      totalViews: totalViews || totalImpressions,
      viewsChange: calcChange(totalViews, prevViews),
      totalInteractions: totalInteractions,
      interactionsChange: calcChange(totalInteractions, prevInteractions),
      totalLinkClicks: totalLinkClicks,
      linkClicksChange: calcChange(totalLinkClicks, prevLinkClicks),
      totalProfileVisits: totalProfileVisits,
      profileVisitsChange: calcChange(totalProfileVisits, prevProfileVisits),
      avgEngagement: Math.round(avgEngagement * 100) / 100,
    };
  }, [filteredPosts, filteredMetrics, previousPeriodMetrics]);

  // Sparkline data for KPIs (last 14 data points)
  const sparklineData = useMemo(() => {
    const recent = filteredMetrics.slice(0, 14).reverse();
    return {
      views: recent.map(m => m.views || 0),
      followers: recent.map(m => m.subscribers || 0),
      reach: recent.map(m => getMetadataValue(m, 'reach')),
      interactions: recent.map(m => getMetadataValue(m, 'interactions')),
      linkClicks: recent.map(m => getMetadataValue(m, 'linkClicks')),
      profileVisits: recent.map(m => getMetadataValue(m, 'profileVisits')),
    };
  }, [filteredMetrics]);

  // Post-based sparklines
  const postSparklines = useMemo(() => {
    const recentPosts = filteredPosts.slice(0, 14).reverse();
    return {
      shares: recentPosts.map(p => p.shares || 0),
      saves: recentPosts.map(p => p.saves || 0),
      engagement: recentPosts.map(p => p.engagement_rate || 0),
    };
  }, [filteredPosts]);

  // Prepare chart data
  const { chartData, availableMetrics } = useMemo(() => {
    const metricsMap: Record<string, { 
      views: number; 
      reach: number;
      interactions: number;
      linkClicks: number;
      subscribers: number; 
      profileVisits: number;
    }> = {};
    
    filteredMetrics.forEach(m => {
      const meta = m.metadata ? (typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata) : {};
      metricsMap[m.metric_date] = {
        views: m.views || 0,
        reach: meta?.reach || 0,
        interactions: meta?.interactions || 0,
        linkClicks: meta?.linkClicks || 0,
        subscribers: m.subscribers || 0,
        profileVisits: meta?.profileVisits || 0,
      };
    });

    const allDates = Object.keys(metricsMap).sort();

    if (allDates.length === 0) {
      return { chartData: [], availableMetrics: [] };
    }

    const data = allDates.map(dateKey => {
      const metricData = metricsMap[dateKey];
      
      return {
        date: format(parseISO(dateKey), "dd/MM", { locale: ptBR }),
        fullDate: dateKey,
        views: metricData.views,
        reach: metricData.reach,
        interactions: metricData.interactions,
        linkClicks: metricData.linkClicks,
        subscribers: metricData.subscribers,
        profileVisits: metricData.profileVisits,
      };
    });

    const hasViews = data.some(d => d.views > 0);
    const hasReach = data.some(d => d.reach > 0);
    const hasInteractions = data.some(d => d.interactions > 0);
    const hasLinkClicks = data.some(d => d.linkClicks > 0);
    const hasSubscribers = data.some(d => d.subscribers > 0);
    const hasProfileVisits = data.some(d => d.profileVisits > 0);

    const available = metricOptions.filter(opt => {
      if (opt.key === "views") return hasViews;
      if (opt.key === "reach") return hasReach;
      if (opt.key === "interactions") return hasInteractions;
      if (opt.key === "linkClicks") return hasLinkClicks;
      if (opt.key === "subscribers") return hasSubscribers;
      if (opt.key === "profileVisits") return hasProfileVisits;
      return false;
    });

    return { chartData: data, availableMetrics: available.length > 0 ? available : metricOptions };
  }, [filteredMetrics]);

  // Get best performing post
  const bestPost = useMemo(() => {
    if (filteredPosts.length === 0) return null;
    return filteredPosts.reduce((best, post) => 
      (post.engagement_rate || 0) > (best.engagement_rate || 0) ? post : best
    , filteredPosts[0]);
  }, [filteredPosts]);


  // Top posts for ranking
  const topPostsData = useMemo(() => {
    return [...filteredPosts]
      .sort((a, b) => (b.reach || 0) - (a.reach || 0))
      .slice(0, 5)
      .map(post => ({
        label: post.caption?.slice(0, 40) + (post.caption && post.caption.length > 40 ? '...' : '') || 'Post sem legenda',
        value: post.reach || 0,
      }));
  }, [filteredPosts]);

  // Top posts for table - now includes all metrics for sorting
  const topContentItems = useMemo(() => {
    return filteredPosts.map(post => ({
      id: post.id,
      title: post.caption?.slice(0, 50) + (post.caption && post.caption.length > 50 ? '...' : '') || 'Post sem legenda',
      thumbnail: post.thumbnail_url,
      type: post.post_type || 'image',
      views: post.impressions || 0,
      likes: post.likes || 0,
      comments: post.comments || 0,
      saves: post.saves || 0,
      shares: post.shares || 0,
      reach: post.reach || 0,
      engagement: post.engagement_rate || 0,
      trend: (post.engagement_rate || 0) - kpis.avgEngagement,
      link: post.permalink,
    }));
  }, [filteredPosts, kpis.avgEngagement]);

  // Posting time heatmap data
  const heatmapData = useMemo(() => {
    const data: { day: number; hour: number; value: number; count: number }[] = [];
    
    // Initialize all slots
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        data.push({ day, hour, value: 0, count: 0 });
      }
    }
    
    // Aggregate engagement by posting time
    filteredPosts.forEach(post => {
      if (!post.posted_at) return;
      const date = parseISO(post.posted_at);
      const day = getDay(date);
      const hour = getHours(date);
      
      const slot = data.find(d => d.day === day && d.hour === hour);
      if (slot) {
        slot.value += post.engagement_rate || 0;
        slot.count++;
      }
    });
    
    // Average the values
    data.forEach(slot => {
      if (slot.count > 0) {
        slot.value = slot.value / slot.count;
      }
    });
    
    return data;
  }, [filteredPosts]);

  // Data completeness stats
  const dataCompleteness = useMemo(() => ({
    total: posts.length,
    withThumbnails: posts.filter(p => p.thumbnail_url).length,
    withLikes: posts.filter(p => p.likes !== null && p.likes !== undefined).length,
    withReach: posts.filter(p => p.reach !== null && p.reach !== undefined && p.reach > 0).length,
    withEngagement: posts.filter(p => p.engagement_rate !== null && p.engagement_rate !== undefined).length,
  }), [posts]);

  const selectedPeriodLabel = periodOptions.find(p => p.value === period)?.label || "Período";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Instagram Analytics</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredPosts.length} posts • {filteredMetrics.length} dias de dados
            </p>
          </div>
          <DataCompletenessWarning platform="instagram" data={dataCompleteness} />
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px] bg-card border-border/50">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            className="border-border/50"
            onClick={() => setShowReportGenerator(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Relatório IA
          </Button>
          <Button 
            variant="outline" 
            className="border-border/50"
            onClick={() => setShowUploadPosts(!showUploadPosts)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
        </div>
      </div>

      {/* Report Generator Modal */}
      <PerformanceReportGenerator
        clientId={clientId}
        platform="Instagram"
        period={selectedPeriodLabel}
        kpis={kpis}
        posts={filteredPosts}
        metrics={filteredMetrics}
        open={showReportGenerator}
        onOpenChange={setShowReportGenerator}
      />

      {/* CSV Upload - Smart (detecta automaticamente Posts ou Stories) */}
      <Collapsible open={showUploadPosts} onOpenChange={setShowUploadPosts}>
        <CollapsibleContent className="pt-2">
          <SmartCSVUpload clientId={clientId} platform="instagram" />
        </CollapsibleContent>
      </Collapsible>

      {/* Primary KPIs - 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={Eye}
          label="Visualizações"
          value={kpis.totalViews}
          change={period !== "all" ? kpis.viewsChange : undefined}
          sparklineData={sparklineData.views}
          color="violet"
          highlight
        />
        <StatCard
          icon={Target}
          label="Alcance"
          value={kpis.totalReach}
          change={period !== "all" ? kpis.reachChange : undefined}
          sparklineData={sparklineData.reach}
          color="blue"
        />
        <StatCard
          icon={Heart}
          label="Interações"
          value={kpis.totalInteractions}
          change={period !== "all" ? kpis.interactionsChange : undefined}
          sparklineData={sparklineData.interactions}
          color="rose"
        />
        <StatCard
          icon={Share2}
          label="Cliques no Link"
          value={kpis.totalLinkClicks}
          change={period !== "all" ? kpis.linkClicksChange : undefined}
          sparklineData={sparklineData.linkClicks}
          color="emerald"
        />
        <StatCard
          icon={Users}
          label="Novos Seguidores"
          value={kpis.followersGained}
          change={period !== "all" ? kpis.followersChange : undefined}
          sparklineData={sparklineData.followers}
          color="amber"
        />
        <StatCard
          icon={MessageCircle}
          label="Visitas ao Perfil"
          value={kpis.totalProfileVisits}
          change={period !== "all" ? kpis.profileVisitsChange : undefined}
          sparklineData={sparklineData.profileVisits}
          color="secondary"
        />
      </div>

      {/* Chart + Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart - expanded */}
        <div className="lg:col-span-2">
          {chartData.length > 0 && availableMetrics.length > 0 && (
            <EnhancedAreaChart
              data={chartData}
              metrics={availableMetrics}
              selectedMetric={selectedMetric}
              onMetricChange={setSelectedMetric}
              title="Evolução das Métricas"
              dateRange={selectedPeriodLabel}
            />
          )}
        </div>

        {/* Goals Panel */}
        <GoalsPanel
          clientId={clientId}
          platform="instagram"
          currentMetrics={{
            followers: kpis.followersGained,
            views: kpis.totalViews,
            engagement: kpis.avgEngagement,
          }}
        />
      </div>

      {/* Best Posts by Metric - New Section like Instagram Native */}
      <BestPostsByMetric 
        posts={filteredPosts}
        previousPeriodPosts={previousPeriodPosts}
        periodLabel={selectedPeriodLabel}
      />

      {/* Top Content Table with metric selector */}
      {topContentItems.length > 0 && (
        <TopContentTable 
          title="Top 5 Posts"
          items={topContentItems}
          selectedMetric={topPostsMetric as any}
          onMetricChange={(m) => setTopPostsMetric(m)}
        />
      )}

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricMiniCard
          icon={Share2}
          label="Compartilhamentos"
          value={kpis.totalShares}
          sparklineData={postSparklines.shares}
          color="emerald"
        />
        <MetricMiniCard
          icon={Bookmark}
          label="Salvos"
          value={kpis.totalSaves}
          sparklineData={postSparklines.saves}
          color="amber"
        />
        <MetricMiniCard
          icon={TrendingUp}
          label="Engajamento Médio"
          value={`${kpis.avgEngagement.toFixed(2)}%`}
          sparklineData={postSparklines.engagement}
          color="violet"
        />
      </div>

      {/* AI Insights - Full Width */}
      <AIInsightsCard 
        clientId={clientId}
        clientName={undefined}
        posts={filteredPosts} 
        metrics={filteredMetrics}
        periodLabel={selectedPeriodLabel}
        platform="instagram"
        startDate={cutoffDate || undefined}
        endDate={new Date()}
      />

      {/* Posts Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Posts Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <InstagramPostsTable 
            posts={filteredPosts} 
            isLoading={isLoadingPosts} 
          />
        </CardContent>
      </Card>

      {/* Stories Section */}
      <InstagramStoriesSection 
        stories={stories}
        isLoading={isLoadingStories}
        period={period}
        clientId={clientId}
        onRefresh={() => refetchStories?.()}
      />

      {/* Import History */}
      <ImportHistoryPanel clientId={clientId} platform="instagram" />
    </div>
  );
}
