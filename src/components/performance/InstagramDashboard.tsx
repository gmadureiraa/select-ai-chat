import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, Heart, MessageCircle, TrendingUp, TrendingDown, Eye, Bookmark, Upload, Calendar, Share2, Target, Minus, Sparkles } from "lucide-react";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { PerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { InstagramPostsTable } from "./InstagramPostsTable";
import { SmartCSVUpload } from "./SmartCSVUpload";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
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
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
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
    const totalLikes = filteredPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = filteredPosts.reduce((sum, p) => sum + (p.comments || 0), 0);
    const totalSaves = filteredPosts.reduce((sum, p) => sum + (p.saves || 0), 0);
    const totalShares = filteredPosts.reduce((sum, p) => sum + (p.shares || 0), 0);
    const totalReachFromPosts = filteredPosts.reduce((sum, p) => sum + (p.reach || 0), 0);
    const avgEngagement = filteredPosts.length > 0
      ? filteredPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / filteredPosts.length
      : 0;

    const totalViews = filteredMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    const followersGained = filteredMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0);
    const totalReachFromMetrics = filteredMetrics.reduce((sum, m) => sum + getReachFromMetric(m), 0);
    const totalInteractions = filteredMetrics.reduce((sum, m) => sum + (m.likes || 0), 0);
    const totalImpressions = filteredPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);

    const prevViews = previousPeriodMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    const prevFollowers = previousPeriodMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0);
    const prevReach = previousPeriodMetrics.reduce((sum, m) => sum + getReachFromMetric(m), 0);
    const prevInteractions = previousPeriodMetrics.reduce((sum, m) => sum + (m.likes || 0), 0);

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
    if (change > 0) return <TrendingUp className="h-3 w-3" />;
    if (change < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
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
    const width = 48;
    const height = 16;
    
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="opacity-60">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          points={points}
        />
      </svg>
    );
  };

  // KPI Card Component
  const KPICard = ({ 
    icon: Icon, 
    label, 
    value, 
    change, 
    sparkline, 
    sparklineColor,
    highlight 
  }: { 
    icon: React.ElementType;
    label: string;
    value: string | number;
    change?: number;
    sparkline?: number[];
    sparklineColor?: string;
    highlight?: boolean;
  }) => (
    <Card className={highlight ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium">{label}</span>
          </div>
          {sparkline && sparklineColor && (
            <Sparkline data={sparkline} color={sparklineColor} />
          )}
        </div>
        <p className={`text-2xl font-bold mt-2 ${highlight ? "text-primary" : ""}`}>
          {typeof value === "number" ? formatNumber(value) : value}
        </p>
        {change !== undefined && period !== "all" && (
          <div className={`flex items-center gap-1 text-xs mt-1 ${getTrendColor(change)}`}>
            {getTrendIcon(change)}
            <span>{change > 0 ? "+" : ""}{change.toFixed(0)}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px] h-9">
              <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
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
          <span className="text-xs text-muted-foreground">
            {filteredPosts.length} posts • {filteredMetrics.length} dias de dados
          </span>
        </div>
        <Collapsible open={showUpload} onOpenChange={setShowUpload}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Upload className="h-3.5 w-3.5 mr-2" />
              Importar
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* CSV Upload */}
      <Collapsible open={showUpload} onOpenChange={setShowUpload}>
        <CollapsibleContent>
          <SmartCSVUpload clientId={clientId} platform="instagram" />
        </CollapsibleContent>
      </Collapsible>

      {/* Hero KPIs - 4 main metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          label="Novos Seguidores"
          value={`+${formatNumber(kpis.followersGained)}`}
          change={kpis.followersChange}
          sparkline={sparklineData.followers}
          sparklineColor="hsl(var(--chart-2))"
          highlight
        />
        <KPICard
          icon={Eye}
          label="Visualizações"
          value={kpis.totalViews}
          change={kpis.viewsChange}
          sparkline={sparklineData.views}
          sparklineColor="hsl(var(--primary))"
        />
        <KPICard
          icon={Target}
          label="Alcance"
          value={kpis.totalReach}
          change={kpis.reachChange}
          sparkline={sparklineData.reach}
          sparklineColor="hsl(var(--chart-3))"
        />
        <KPICard
          icon={TrendingUp}
          label="Engajamento Médio"
          value={`${kpis.avgEngagement.toFixed(2)}%`}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Heart className="h-4 w-4 text-red-500" />
            <div>
              <p className="text-xs text-muted-foreground">Curtidas</p>
              <p className="text-lg font-semibold">{formatNumber(kpis.totalLikes)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <MessageCircle className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Comentários</p>
              <p className="text-lg font-semibold">{formatNumber(kpis.totalComments)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Share2 className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Compartilhamentos</p>
              <p className="text-lg font-semibold">{formatNumber(kpis.totalShares)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Bookmark className="h-4 w-4 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Salvos</p>
              <p className="text-lg font-semibold">{formatNumber(kpis.totalSaves)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && availableMetrics.length > 0 && (
        <EnhancedAreaChart
          data={chartData}
          metrics={availableMetrics}
          selectedMetric={selectedMetric}
          onMetricChange={setSelectedMetric}
          title="Evolução das Métricas"
        />
      )}

      {/* Insights and Best Post */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AutoInsightsCard posts={filteredPosts} metrics={filteredMetrics} />
        
        {/* Best Post Card */}
        {bestPost && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Melhor Post do Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {bestPost.thumbnail_url ? (
                  <img 
                    src={bestPost.thumbnail_url} 
                    alt="" 
                    className="w-20 h-20 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Eye className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-2 mb-3">
                    {bestPost.caption || "Sem legenda"}
                  </p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5 text-red-500" />
                      {formatNumber(bestPost.likes || 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                      {formatNumber(bestPost.comments || 0)}
                    </span>
                    <span className="flex items-center gap-1 text-primary font-medium">
                      {bestPost.engagement_rate?.toFixed(1)}% eng.
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Posts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <InstagramPostsTable posts={filteredPosts} isLoading={isLoadingPosts} />
        </CardContent>
      </Card>
    </div>
  );
}
