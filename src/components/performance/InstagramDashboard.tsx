import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, Heart, MessageCircle, TrendingUp, TrendingDown, Eye, Bookmark, Upload, Calendar, Share2, Target, Minus } from "lucide-react";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { PerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { InstagramPostsTable } from "./InstagramPostsTable";
import { SmartCSVUpload } from "./SmartCSVUpload";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
import { PeriodComparisonCard } from "./PeriodComparisonCard";
import { AutoInsightsCard } from "./AutoInsightsCard";
import { format, subDays, isAfter, parseISO, startOfDay } from "date-fns";
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
  { key: "views", label: "Visualizações", dataKey: "views", color: "hsl(var(--primary))" },
  { key: "subscribers", label: "Seguidores", dataKey: "subscribers", color: "hsl(var(--chart-2))" },
  { key: "reach", label: "Alcance", dataKey: "reach", color: "hsl(var(--chart-3))" },
  { key: "interactions", label: "Interações", dataKey: "interactions", color: "hsl(var(--chart-4))" },
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

  // Helper to extract reach from metadata safely
  const getReachFromMetric = (m: PerformanceMetrics): number => {
    if (!m.metadata) return 0;
    const meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
    return meta?.reach || 0;
  };

  // Calculate KPIs from filtered data with trends
  const kpis = useMemo(() => {
    // Sum posts metrics
    const totalLikes = filteredPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = filteredPosts.reduce((sum, p) => sum + (p.comments || 0), 0);
    const totalSaves = filteredPosts.reduce((sum, p) => sum + (p.saves || 0), 0);
    const totalShares = filteredPosts.reduce((sum, p) => sum + (p.shares || 0), 0);
    const totalReachFromPosts = filteredPosts.reduce((sum, p) => sum + (p.reach || 0), 0);
    const avgEngagement = filteredPosts.length > 0
      ? filteredPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / filteredPosts.length
      : 0;

    // Calculate from daily metrics
    const totalViews = filteredMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    const followersGained = filteredMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0);
    const totalReachFromMetrics = filteredMetrics.reduce((sum, m) => sum + getReachFromMetric(m), 0);
    const totalInteractions = filteredMetrics.reduce((sum, m) => sum + (m.likes || 0), 0);
    const totalImpressions = filteredPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);

    // Previous period totals for comparison
    const prevViews = previousPeriodMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    const prevFollowers = previousPeriodMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0);
    const prevReach = previousPeriodMetrics.reduce((sum, m) => sum + getReachFromMetric(m), 0);
    const prevInteractions = previousPeriodMetrics.reduce((sum, m) => sum + (m.likes || 0), 0);

    // Calculate percentage changes
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
      totalInteractions,
      interactionsChange: calcChange(totalInteractions, prevInteractions),
      avgEngagement: Math.round(avgEngagement * 100) / 100,
    };
  }, [filteredPosts, filteredMetrics, previousPeriodMetrics]);

  // Sparkline data for KPIs (last 7 data points)
  const sparklineData = useMemo(() => {
    const last7 = filteredMetrics.slice(0, 7).reverse();
    return {
      views: last7.map(m => m.views || 0),
      followers: last7.map(m => m.subscribers || 0),
      reach: last7.map(m => getReachFromMetric(m)),
      interactions: last7.map(m => m.likes || 0),
    };
  }, [filteredMetrics]);

  // Prepare chart data
  const { chartData, availableMetrics } = useMemo(() => {
    if (!filteredMetrics.length) {
      return { chartData: [], availableMetrics: [] };
    }

    // Check which metrics have data
    const hasViews = filteredMetrics.some(m => (m.views || 0) > 0);
    const hasSubscribers = filteredMetrics.some(m => (m.subscribers || 0) > 0);
    const hasReach = filteredMetrics.some(m => getReachFromMetric(m) > 0);
    const hasInteractions = filteredMetrics.some(m => (m.likes || 0) > 0);

    const available = metricOptions.filter(opt => {
      if (opt.key === "views") return hasViews;
      if (opt.key === "subscribers") return hasSubscribers;
      if (opt.key === "reach") return hasReach;
      if (opt.key === "interactions") return hasInteractions;
      return false;
    });

    // Build chart data with all metrics
    const data = filteredMetrics
      .slice()
      .reverse()
      .map(m => ({
        date: format(parseISO(m.metric_date), "dd/MM", { locale: ptBR }),
        fullDate: m.metric_date,
        views: m.views || 0,
        subscribers: m.subscribers || 0,
        reach: getReachFromMetric(m),
        interactions: m.likes || 0,
      }));

    return { chartData: data, availableMetrics: available };
  }, [filteredMetrics]);

  // Get best performing post
  const bestPost = useMemo(() => {
    if (filteredPosts.length === 0) return null;
    return filteredPosts.reduce((best, post) => 
      (post.engagement_rate || 0) > (best.engagement_rate || 0) ? post : best
    , filteredPosts[0]);
  }, [filteredPosts]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return "text-green-500";
    if (change < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  // Simple sparkline component
  const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
    if (data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const width = 60;
    const height = 20;
    
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="opacity-70">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
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
        </div>
        <Collapsible open={showUpload} onOpenChange={setShowUpload}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              {showUpload ? "Ocultar" : "Importar CSV"}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* CSV Upload (Collapsible) */}
      <Collapsible open={showUpload} onOpenChange={setShowUpload}>
        <CollapsibleContent>
          <SmartCSVUpload clientId={clientId} platform="instagram" />
        </CollapsibleContent>
      </Collapsible>

      {/* KPI Cards Grid - Enhanced with sparklines and trends */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs">Novos Seguidores</span>
              </div>
              <Sparkline data={sparklineData.followers} color="hsl(var(--chart-2))" />
            </div>
            <p className="text-xl font-bold text-green-500">+{formatNumber(kpis.followersGained)}</p>
            {period !== "all" && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${getTrendColor(kpis.followersChange)}`}>
                {getTrendIcon(kpis.followersChange)}
                <span>{Math.abs(kpis.followersChange).toFixed(0)}% vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Eye className="h-3.5 w-3.5" />
                <span className="text-xs">Visualizações</span>
              </div>
              <Sparkline data={sparklineData.views} color="hsl(var(--primary))" />
            </div>
            <p className="text-xl font-bold">{formatNumber(kpis.totalViews)}</p>
            {period !== "all" && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${getTrendColor(kpis.viewsChange)}`}>
                {getTrendIcon(kpis.viewsChange)}
                <span>{Math.abs(kpis.viewsChange).toFixed(0)}% vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Target className="h-3.5 w-3.5" />
                <span className="text-xs">Alcance</span>
              </div>
              <Sparkline data={sparklineData.reach} color="hsl(var(--chart-3))" />
            </div>
            <p className="text-xl font-bold">{formatNumber(kpis.totalReach)}</p>
            {period !== "all" && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${getTrendColor(kpis.reachChange)}`}>
                {getTrendIcon(kpis.reachChange)}
                <span>{Math.abs(kpis.reachChange).toFixed(0)}% vs anterior</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Heart className="h-3.5 w-3.5" />
              <span className="text-xs">Curtidas</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(kpis.totalLikes)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="text-xs">Comentários</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(kpis.totalComments)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Share2 className="h-3.5 w-3.5" />
              <span className="text-xs">Compartilhamentos</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(kpis.totalShares)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Bookmark className="h-3.5 w-3.5" />
              <span className="text-xs">Salvos</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(kpis.totalSaves)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-xs">Engajamento</span>
            </div>
            <p className="text-xl font-bold">{kpis.avgEngagement.toFixed(2)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section - Fixed to show only selected metric */}
      {chartData.length > 0 && availableMetrics.length > 0 && (
        <EnhancedAreaChart
          data={chartData}
          metrics={availableMetrics}
          selectedMetric={selectedMetric}
          onMetricChange={setSelectedMetric}
          title="Evolução das Métricas"
        />
      )}

      {/* Insights and Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PeriodComparisonCard
          currentPeriod={period}
          currentMetrics={{
            views: kpis.totalViews,
            followers: kpis.followersGained,
            reach: kpis.totalReach,
            interactions: kpis.totalInteractions,
          }}
          previousMetrics={{
            views: previousPeriodMetrics.reduce((sum, m) => sum + (m.views || 0), 0),
            followers: previousPeriodMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0),
            reach: previousPeriodMetrics.reduce((sum, m) => sum + getReachFromMetric(m), 0),
            interactions: previousPeriodMetrics.reduce((sum, m) => sum + (m.likes || 0), 0),
          }}
        />
        <AutoInsightsCard posts={filteredPosts} metrics={filteredMetrics} />
      </div>

      {/* Best Post Highlight */}
      {bestPost && (
        <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              🏆 Melhor Post do Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {bestPost.thumbnail_url && (
                <img 
                  src={bestPost.thumbnail_url} 
                  alt="" 
                  className="w-16 h-16 rounded-lg object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-2 mb-2">
                  {bestPost.caption || "Sem legenda"}
                </p>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {formatNumber(bestPost.likes || 0)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {formatNumber(bestPost.comments || 0)}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> {(bestPost.engagement_rate || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posts Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Todos os Posts ({filteredPosts.length})
          </CardTitle>
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
