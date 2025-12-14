import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, Heart, MessageCircle, TrendingUp, Eye, Bookmark, Upload, Calendar, Share2, Target } from "lucide-react";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { PerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { InstagramPostsTable } from "./InstagramPostsTable";
import { SmartCSVUpload } from "./SmartCSVUpload";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
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

const baseMetricOptions = [
  { value: "views", label: "Visualizações", icon: Eye },
  { value: "subscribers", label: "Seguidores", icon: Users },
  { value: "reach", label: "Alcance", icon: Target },
  { value: "interactions", label: "Interações", icon: Heart },
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

  // Calculate KPIs from filtered data
  const kpis = useMemo(() => {
    // Sum posts metrics
    const totalLikes = filteredPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = filteredPosts.reduce((sum, p) => sum + (p.comments || 0), 0);
    const totalSaves = filteredPosts.reduce((sum, p) => sum + (p.saves || 0), 0);
    const totalShares = filteredPosts.reduce((sum, p) => sum + (p.shares || 0), 0);
    const totalReach = filteredPosts.reduce((sum, p) => sum + (p.reach || 0), 0);
    const avgEngagement = filteredPosts.length > 0
      ? filteredPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / filteredPosts.length
      : 0;

    // Calculate views and followers gained from daily metrics
    const totalViews = filteredMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    
    // Followers gained = sum of daily subscriber gains (not total count)
    const followersGained = filteredMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0);

    // Calculate from posts if available (more accurate for impressions)
    const totalImpressions = filteredPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);

    return {
      followersGained,
      totalPosts: filteredPosts.length,
      totalLikes,
      totalComments,
      totalSaves,
      totalShares,
      totalReach,
      totalViews: totalViews || totalImpressions,
      avgEngagement: Math.round(avgEngagement * 100) / 100,
    };
  }, [filteredPosts, filteredMetrics]);

  // Prepare chart data only for metrics that actually exist in daily CSVs
  const { chartData, chartMetrics } = useMemo(() => {
    if (!filteredMetrics.length) {
      return { chartData: [], chartMetrics: [] as { key: string; label: string; icon: any; }[] };
    }

    const hasViews = filteredMetrics.some(m => (m.views || 0) > 0);
    const hasSubscribers = filteredMetrics.some(m => (m.subscribers || 0) > 0);
    const hasReach = filteredMetrics.some(m => (m.metadata as any)?.reach > 0);
    const hasInteractions = filteredMetrics.some(m => (m.likes || 0) > 0);

    const metrics = baseMetricOptions.filter(opt => {
      if (opt.value === "views") return hasViews;
      if (opt.value === "subscribers") return hasSubscribers;
      if (opt.value === "reach") return hasReach;
      if (opt.value === "interactions") return hasInteractions;
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
        reach: (m.metadata as any)?.reach || 0,
        interactions: m.likes || 0,
      }));

    return { chartData: data, chartMetrics: metrics };
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

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Users className="h-3.5 w-3.5" />
              <span className="text-xs">Novos Seguidores</span>
            </div>
            <p className="text-xl font-bold text-green-500">+{formatNumber(kpis.followersGained)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Eye className="h-3.5 w-3.5" />
              <span className="text-xs">Visualizações</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(kpis.totalViews)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Target className="h-3.5 w-3.5" />
              <span className="text-xs">Alcance</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(kpis.totalReach)}</p>
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

      {/* Chart Section */}
      {chartData.length > 0 && chartMetrics.length > 0 && (
        <EnhancedAreaChart
          data={chartData}
          metrics={chartMetrics.map(opt => ({
            key: opt.value,
            label: opt.label,
            dataKey: opt.value,
            color:
              opt.value === "views"
                ? "hsl(var(--primary))"
                : opt.value === "subscribers"
                  ? "hsl(var(--chart-2))"
                  : opt.value === "reach"
                    ? "hsl(var(--chart-3))"
                    : "hsl(var(--chart-4))",
          }))}
          selectedMetric={selectedMetric}
          onMetricChange={setSelectedMetric}
          title="Evolução das Métricas"
        />
      )}

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
