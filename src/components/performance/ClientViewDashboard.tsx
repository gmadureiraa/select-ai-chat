import { useMemo, useState } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Eye, 
  Heart, 
  Target,
  Sparkles,
  Mail,
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EnhancedKPICard } from "./EnhancedKPICard";
import { GoalGauge } from "./GoalGauge";
import { TopContentTable } from "./TopContentTable";
import { AIInsightsCard } from "./AIInsightsCard";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useYouTubeVideos } from "@/hooks/useYouTubeMetrics";
import { useInstagramPosts } from "@/hooks/useInstagramPosts";
import { usePerformanceGoals } from "@/hooks/usePerformanceGoals";
import { Client } from "@/hooks/useClients";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface ClientViewDashboardProps {
  clientId: string;
  client: Client;
  platform?: string;
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString("pt-BR");
};

const formatPercent = (num: number) => `${num.toFixed(1)}%`;

export function ClientViewDashboard({ clientId, client, platform = "instagram" }: ClientViewDashboardProps) {
  const [selectedContentMetric, setSelectedContentMetric] = useState<"engagement" | "saves" | "shares" | "likes" | "comments" | "reach">("engagement");
  
  // Data fetching
  const { data: instagramMetrics, isLoading: isLoadingInstagram } = usePerformanceMetrics(clientId, "instagram", 60);
  const { data: instagramPosts, isLoading: isLoadingPosts } = useInstagramPosts(clientId, 100);
  const { data: youtubeVideos, isLoading: isLoadingVideos } = useYouTubeVideos(clientId, 100);
  const { data: newsletterMetrics, isLoading: isLoadingNewsletter } = usePerformanceMetrics(clientId, "newsletter", 60);
  const { goals, isLoading: isLoadingGoals } = usePerformanceGoals(clientId);

  const isLoading = isLoadingInstagram || isLoadingPosts || isLoadingVideos || isLoadingNewsletter || isLoadingGoals;

  // Calculate KPIs based on platform
  const kpis = useMemo(() => {
    const now = new Date();
    const last30Days = subDays(now, 30);
    const previous30Days = subDays(now, 60);

    if (platform === "instagram") {
      const recentPosts = (instagramPosts || []).filter(p => 
        p.posted_at && new Date(p.posted_at) >= last30Days
      );
      const previousPosts = (instagramPosts || []).filter(p => 
        p.posted_at && new Date(p.posted_at) >= previous30Days && new Date(p.posted_at) < last30Days
      );

      const currentEngagement = recentPosts.length > 0
        ? recentPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / recentPosts.length
        : 0;
      const previousEngagement = previousPosts.length > 0
        ? previousPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / previousPosts.length
        : 0;
      const engagementChange = previousEngagement > 0 
        ? ((currentEngagement - previousEngagement) / previousEngagement) * 100
        : 0;

      const currentReach = recentPosts.reduce((sum, p) => sum + (p.reach || 0), 0);
      const previousReach = previousPosts.reduce((sum, p) => sum + (p.reach || 0), 0);
      const reachChange = previousReach > 0 ? ((currentReach - previousReach) / previousReach) * 100 : 0;

      const currentLikes = recentPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
      const previousLikes = previousPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
      const likesChange = previousLikes > 0 ? ((currentLikes - previousLikes) / previousLikes) * 100 : 0;

      const latestMetric = instagramMetrics?.[0];
      const previousMetric = instagramMetrics?.[1];
      const followers = latestMetric?.subscribers || 0;
      const followersChange = previousMetric?.subscribers 
        ? ((followers - previousMetric.subscribers) / previousMetric.subscribers) * 100
        : 0;

      // Sparkline data
      const sparklineData = (instagramPosts || [])
        .slice(0, 14)
        .map(p => p.engagement_rate || 0)
        .reverse();

      return [
        { 
          title: "Seguidores", 
          value: formatNumber(followers), 
          change: followersChange,
          icon: Users,
          color: "primary" as const,
          sparklineData: instagramMetrics?.slice(0, 14).map(m => m.subscribers || 0).reverse() || [],
        },
        { 
          title: "Engajamento", 
          value: formatPercent(currentEngagement), 
          change: engagementChange,
          icon: Heart,
          color: "pink" as const,
          sparklineData,
        },
        { 
          title: "Alcance", 
          value: formatNumber(currentReach), 
          change: reachChange,
          icon: Eye,
          color: "blue" as const,
          sparklineData: recentPosts.slice(0, 14).map(p => p.reach || 0).reverse(),
        },
        { 
          title: "Curtidas", 
          value: formatNumber(currentLikes), 
          change: likesChange,
          icon: Heart,
          color: "orange" as const,
          sparklineData: recentPosts.slice(0, 14).map(p => p.likes || 0).reverse(),
        },
      ];
    }

    if (platform === "youtube") {
      const recentVideos = (youtubeVideos || []).filter(v => 
        v.published_at && new Date(v.published_at) >= last30Days
      );
      const previousVideos = (youtubeVideos || []).filter(v => 
        v.published_at && new Date(v.published_at) >= previous30Days && new Date(v.published_at) < last30Days
      );

      const currentViews = recentVideos.reduce((sum, v) => sum + (v.total_views || 0), 0);
      const previousViews = previousVideos.reduce((sum, v) => sum + (v.total_views || 0), 0);
      const viewsChange = previousViews > 0 ? ((currentViews - previousViews) / previousViews) * 100 : 0;

      const currentWatchHours = recentVideos.reduce((sum, v) => sum + (v.watch_hours || 0), 0);
      const previousWatchHours = previousVideos.reduce((sum, v) => sum + (v.watch_hours || 0), 0);
      const watchChange = previousWatchHours > 0 ? ((currentWatchHours - previousWatchHours) / previousWatchHours) * 100 : 0;

      const currentSubs = recentVideos.reduce((sum, v) => sum + (v.subscribers_gained || 0), 0);
      const previousSubs = previousVideos.reduce((sum, v) => sum + (v.subscribers_gained || 0), 0);
      const subsChange = previousSubs > 0 ? ((currentSubs - previousSubs) / previousSubs) * 100 : 0;

      const avgCTR = recentVideos.length > 0
        ? recentVideos.reduce((sum, v) => sum + (v.click_rate || 0), 0) / recentVideos.length
        : 0;

      return [
        { 
          title: "Visualizações", 
          value: formatNumber(currentViews), 
          change: viewsChange,
          icon: Eye,
          color: "primary" as const,
          sparklineData: recentVideos.slice(0, 14).map(v => v.total_views || 0).reverse(),
        },
        { 
          title: "Horas Assistidas", 
          value: formatNumber(currentWatchHours), 
          change: watchChange,
          icon: BarChart3,
          color: "green" as const,
          sparklineData: recentVideos.slice(0, 14).map(v => v.watch_hours || 0).reverse(),
        },
        { 
          title: "Inscritos Ganhos", 
          value: formatNumber(currentSubs), 
          change: subsChange,
          icon: Users,
          color: "blue" as const,
          sparklineData: recentVideos.slice(0, 14).map(v => v.subscribers_gained || 0).reverse(),
        },
        { 
          title: "CTR Médio", 
          value: formatPercent(avgCTR), 
          change: 0,
          icon: Target,
          color: "orange" as const,
          sparklineData: recentVideos.slice(0, 14).map(v => v.click_rate || 0).reverse(),
        },
      ];
    }

    if (platform === "newsletter") {
      const sortedMetrics = [...(newsletterMetrics || [])].sort((a, b) => 
        new Date(b.metric_date).getTime() - new Date(a.metric_date).getTime()
      );
      const latestMetric = sortedMetrics[0];
      const previousMetric = sortedMetrics[1];

      const subscribers = latestMetric?.subscribers || 0;
      const subsChange = previousMetric?.subscribers 
        ? ((subscribers - previousMetric.subscribers) / previousMetric.subscribers) * 100
        : 0;

      const openRate = latestMetric?.open_rate || 0;
      const openChange = previousMetric?.open_rate 
        ? ((openRate - previousMetric.open_rate) / previousMetric.open_rate) * 100
        : 0;

      const clickRate = latestMetric?.click_rate || 0;
      const clickChange = previousMetric?.click_rate 
        ? ((clickRate - previousMetric.click_rate) / previousMetric.click_rate) * 100
        : 0;

      return [
        { 
          title: "Inscritos", 
          value: formatNumber(subscribers), 
          change: subsChange,
          icon: Users,
          color: "primary" as const,
          sparklineData: sortedMetrics.slice(0, 14).map(m => m.subscribers || 0).reverse(),
        },
        { 
          title: "Taxa de Abertura", 
          value: formatPercent(openRate), 
          change: openChange,
          icon: Mail,
          color: "green" as const,
          sparklineData: sortedMetrics.slice(0, 14).map(m => m.open_rate || 0).reverse(),
        },
        { 
          title: "Taxa de Cliques", 
          value: formatPercent(clickRate), 
          change: clickChange,
          icon: Target,
          color: "blue" as const,
          sparklineData: sortedMetrics.slice(0, 14).map(m => m.click_rate || 0).reverse(),
        },
        { 
          title: "Engajamento", 
          value: formatPercent(latestMetric?.engagement_rate || 0), 
          change: 0,
          icon: Heart,
          color: "orange" as const,
          sparklineData: sortedMetrics.slice(0, 14).map(m => m.engagement_rate || 0).reverse(),
        },
      ];
    }

    return [];
  }, [platform, instagramPosts, instagramMetrics, youtubeVideos, newsletterMetrics]);

  // Goals for current platform
  const platformGoals = useMemo(() => {
    return goals.filter(g => g.platform === platform);
  }, [goals, platform]);

  // Chart data for main trend
  const chartData = useMemo(() => {
    if (platform === "instagram") {
      return (instagramPosts || [])
        .filter(p => p.posted_at)
        .slice(0, 30)
        .map(p => ({
          date: format(new Date(p.posted_at!), "dd/MM", { locale: ptBR }),
          value: p.engagement_rate || 0,
        }))
        .reverse();
    }

    if (platform === "youtube") {
      return (youtubeVideos || [])
        .filter(v => v.published_at)
        .slice(0, 30)
        .map(v => ({
          date: format(new Date(v.published_at!), "dd/MM", { locale: ptBR }),
          value: v.total_views || 0,
        }))
        .reverse();
    }

    if (platform === "newsletter") {
      return (newsletterMetrics || [])
        .slice(0, 30)
        .map(m => ({
          date: format(new Date(m.metric_date), "dd/MM", { locale: ptBR }),
          value: m.open_rate || 0,
        }))
        .reverse();
    }

    return [];
  }, [platform, instagramPosts, youtubeVideos, newsletterMetrics]);

  // Top content items
  const topContentItems = useMemo(() => {
    if (platform === "instagram") {
      return (instagramPosts || []).slice(0, 10).map(p => ({
        id: p.id,
        title: p.caption?.slice(0, 60) || "Sem legenda",
        thumbnail: p.thumbnail_url || undefined,
        type: p.post_type || "post",
        likes: p.likes || 0,
        comments: p.comments || 0,
        saves: p.saves || 0,
        shares: p.shares || 0,
        reach: p.reach || 0,
        engagement: p.engagement_rate || 0,
        link: p.permalink || undefined,
      }));
    }

    if (platform === "youtube") {
      return (youtubeVideos || []).slice(0, 10).map(v => ({
        id: v.id,
        title: v.title || "Sem título",
        thumbnail: v.thumbnail_url || undefined,
        type: "video",
        views: v.total_views || 0,
        likes: 0,
        comments: 0,
        saves: 0,
        shares: 0,
        reach: v.total_views || 0,
        engagement: v.click_rate || 0,
      }));
    }

    return [];
  }, [platform, instagramPosts, youtubeVideos]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <EnhancedKPICard
            key={index}
            title={kpi.title}
            value={kpi.value}
            change={kpi.change}
            icon={kpi.icon}
            color={kpi.color}
            sparklineData={kpi.sparklineData}
          />
        ))}
      </div>

      {/* Goals Section */}
      {platformGoals.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Metas e Objetivos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {platformGoals.slice(0, 4).map((goal) => (
              <GoalGauge
                key={goal.id}
                label={goal.metric_name}
                currentValue={goal.current_value || 0}
                targetValue={goal.target_value}
                color={
                  (goal.current_value || 0) / goal.target_value >= 0.8 ? "emerald" :
                  (goal.current_value || 0) / goal.target_value >= 0.5 ? "amber" : "primary"
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Trend Chart */}
      {chartData.length > 0 && (
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tendência - Últimos 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [formatNumber(value), platform === "instagram" ? "Engajamento" : "Valor"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout: Top Content + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Content */}
        {topContentItems.length > 0 && (
          <TopContentTable
            title="Top 5 Conteúdos"
            items={topContentItems}
            maxItems={5}
            selectedMetric={selectedContentMetric}
            onMetricChange={setSelectedContentMetric}
          />
        )}

        {/* AI Insights */}
        <AIInsightsCard
          clientId={clientId}
          clientName={client.name}
          posts={platform === "instagram" ? (instagramPosts || []) : []}
          metrics={platform === "newsletter" ? (newsletterMetrics || []) : (instagramMetrics || [])}
          platform={platform}
          startDate={subDays(new Date(), 30)}
          endDate={new Date()}
        />
      </div>
    </div>
  );
}
