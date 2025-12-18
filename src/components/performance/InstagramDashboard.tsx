import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, Heart, MessageCircle, Eye, Bookmark, Upload, Calendar, Share2, Target, ChevronDown, TrendingUp, Settings } from "lucide-react";
import { GoalsPanel } from "./GoalsPanel";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { PerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { usePerformanceGoals } from "@/hooks/usePerformanceGoals";
import { InstagramPostsTable } from "./InstagramPostsTable";
import { SmartCSVUpload } from "./SmartCSVUpload";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
import { AutoInsightsCard } from "./AutoInsightsCard";
import { StatCard } from "./StatCard";
import { GoalGauge } from "./GoalGauge";
import { MetricMiniCard } from "./MetricMiniCard";
import { BestPostCard } from "./BestPostCard";
import { HorizontalBarRank } from "./HorizontalBarRank";
import { ContentTypeDonut } from "./ContentTypeDonut";
import { TopContentTable } from "./TopContentTable";
import { PostingTimeHeatmap } from "./PostingTimeHeatmap";
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
  const [showUpload, setShowUpload] = useState(false);
  
  const { goals } = usePerformanceGoals(clientId);
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
    const followersGained = filteredMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0);
    const totalReachFromMetrics = filteredMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'reach'), 0);
    const totalImpressions = filteredPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);
    const totalInteractions = filteredMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'interactions'), 0);
    const totalLinkClicks = filteredMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'linkClicks'), 0);
    const totalProfileVisits = filteredMetrics.reduce((sum, m) => sum + getMetadataValue(m, 'profileVisits'), 0);

    const prevViews = previousPeriodMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    const prevFollowers = previousPeriodMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0);
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

  // Content type distribution for donut chart
  const contentTypeData = useMemo(() => {
    const typeMap: Record<string, { count: number; engagement: number }> = {};
    
    filteredPosts.forEach(post => {
      const type = post.post_type || 'image';
      if (!typeMap[type]) {
        typeMap[type] = { count: 0, engagement: 0 };
      }
      typeMap[type].count++;
      typeMap[type].engagement += post.engagement_rate || 0;
    });

    return Object.entries(typeMap).map(([type, data]) => ({
      type,
      count: data.count,
      avgEngagement: data.count > 0 ? data.engagement / data.count : 0,
    }));
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

  // Top posts for table
  const topContentItems = useMemo(() => {
    return [...filteredPosts]
      .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0))
      .slice(0, 5)
      .map(post => ({
        id: post.id,
        title: post.caption?.slice(0, 50) + (post.caption && post.caption.length > 50 ? '...' : '') || 'Post sem legenda',
        thumbnail: post.thumbnail_url,
        type: post.post_type || 'image',
        views: post.impressions || 0,
        likes: post.likes || 0,
        comments: post.comments || 0,
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

  const selectedPeriodLabel = periodOptions.find(p => p.value === period)?.label || "Período";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Instagram Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredPosts.length} posts • {filteredMetrics.length} dias de dados
          </p>
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
          <Collapsible open={showUpload} onOpenChange={setShowUpload}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="border-border/50">
                <Upload className="h-4 w-4 mr-2" />
                Importar
                <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showUpload ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>

      {/* CSV Upload */}
      <Collapsible open={showUpload} onOpenChange={setShowUpload}>
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

      {/* Chart + Goal + Content Type */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Chart */}
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

        {/* Content Type Donut */}
        <ContentTypeDonut 
          data={contentTypeData} 
          title="Performance por Tipo"
        />

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

      {/* Top Posts Rank + Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HorizontalBarRank 
          title="Top Posts por Alcance"
          items={topPostsData}
          maxItems={5}
          valueFormatter={(v) => v.toLocaleString('pt-BR')}
        />
        <PostingTimeHeatmap 
          data={heatmapData}
          title="Melhor Horário para Postar"
        />
      </div>

      {/* Top Content Table */}
      {topContentItems.length > 0 && (
        <TopContentTable 
          title="Top 5 Posts por Engajamento"
          items={topContentItems}
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

      {/* Insights and Best Post */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AutoInsightsCard posts={filteredPosts} metrics={filteredMetrics} />
        {bestPost && <BestPostCard post={bestPost} />}
      </div>

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
    </div>
  );
}
