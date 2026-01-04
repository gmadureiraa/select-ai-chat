import { useState, useMemo } from "react";
import { 
  Download, 
  Sparkles, 
  Calendar,
  Filter,
  BarChart3,
  LineChart,
  PieChart,
  Clock,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricsSpreadsheet } from "./MetricsSpreadsheet";
import { ExportButton } from "./ExportButton";
import { PostingTimeHeatmap } from "./PostingTimeHeatmap";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useYouTubeVideos } from "@/hooks/useYouTubeMetrics";
import { useInstagramPosts } from "@/hooks/useInstagramPosts";
import { usePerformanceGoals } from "@/hooks/usePerformanceGoals";
import { Client } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart,
  Area,
  LineChart as RechartsLineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";

interface FullAnalysisDashboardProps {
  clientId: string;
  client: Client;
  platform?: string;
}

const PERIODS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(145, 80%, 45%)",
  "hsl(200, 80%, 50%)",
  "hsl(40, 95%, 50%)",
  "hsl(280, 80%, 60%)",
];

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString("pt-BR");
};

export function FullAnalysisDashboard({ clientId, client, platform = "instagram" }: FullAnalysisDashboardProps) {
  const [period, setPeriod] = useState("30");
  const [chartTab, setChartTab] = useState("reach");
  const [insights, setInsights] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const periodDays = parseInt(period);
  const startDate = subDays(new Date(), periodDays);
  const endDate = new Date();
  const previousStartDate = subDays(startDate, periodDays);

  // Data fetching
  const { data: instagramMetrics, isLoading: isLoadingInstagram } = usePerformanceMetrics(clientId, "instagram", 365);
  const { data: instagramPosts, isLoading: isLoadingPosts } = useInstagramPosts(clientId, 500);
  const { data: youtubeVideos, isLoading: isLoadingVideos } = useYouTubeVideos(clientId, 200);
  const { data: newsletterMetrics, isLoading: isLoadingNewsletter } = usePerformanceMetrics(clientId, "newsletter", 365);
  const { goals } = usePerformanceGoals(clientId);

  const isLoading = isLoadingInstagram || isLoadingPosts || isLoadingVideos || isLoadingNewsletter;

  // Filter data by period
  const filteredData = useMemo(() => {
    if (platform === "instagram") {
      return {
        posts: (instagramPosts || []).filter(p => 
          p.posted_at && new Date(p.posted_at) >= startDate
        ),
        previousPosts: (instagramPosts || []).filter(p => 
          p.posted_at && 
          new Date(p.posted_at) >= previousStartDate && 
          new Date(p.posted_at) < startDate
        ),
      };
    }
    if (platform === "youtube") {
      return {
        videos: (youtubeVideos || []).filter(v => 
          v.published_at && new Date(v.published_at) >= startDate
        ),
        previousVideos: (youtubeVideos || []).filter(v => 
          v.published_at && 
          new Date(v.published_at) >= previousStartDate && 
          new Date(v.published_at) < startDate
        ),
      };
    }
    if (platform === "newsletter") {
      return {
        metrics: (newsletterMetrics || []).filter(m => 
          new Date(m.metric_date) >= startDate
        ),
        previousMetrics: (newsletterMetrics || []).filter(m => 
          new Date(m.metric_date) >= previousStartDate && 
          new Date(m.metric_date) < startDate
        ),
      };
    }
    return {};
  }, [platform, instagramPosts, youtubeVideos, newsletterMetrics, startDate, previousStartDate]);

  // Chart data
  const chartData = useMemo(() => {
    if (platform === "instagram" && filteredData.posts) {
      return filteredData.posts
        .map(p => ({
          date: format(new Date(p.posted_at!), "dd/MM", { locale: ptBR }),
          reach: p.reach || 0,
          engagement: p.engagement_rate || 0,
          impressions: p.impressions || 0,
          likes: p.likes || 0,
          comments: p.comments || 0,
          saves: p.saves || 0,
        }))
        .reverse();
    }
    if (platform === "youtube" && filteredData.videos) {
      return filteredData.videos
        .map(v => ({
          date: format(new Date(v.published_at!), "dd/MM", { locale: ptBR }),
          views: v.total_views || 0,
          watchHours: v.watch_hours || 0,
          ctr: v.click_rate || 0,
          subscribers: v.subscribers_gained || 0,
        }))
        .reverse();
    }
    if (platform === "newsletter" && filteredData.metrics) {
      return filteredData.metrics
        .map(m => ({
          date: format(new Date(m.metric_date), "dd/MM", { locale: ptBR }),
          openRate: m.open_rate || 0,
          clickRate: m.click_rate || 0,
          subscribers: m.subscribers || 0,
        }))
        .reverse();
    }
    return [];
  }, [platform, filteredData]);

  // Content type distribution
  const contentTypeData = useMemo(() => {
    if (platform === "instagram" && filteredData.posts) {
      const typeCount: Record<string, number> = {};
      filteredData.posts.forEach(p => {
        const type = p.post_type || "image";
        typeCount[type] = (typeCount[type] || 0) + 1;
      });
      return Object.entries(typeCount).map(([name, value]) => ({ name, value }));
    }
    return [];
  }, [platform, filteredData.posts]);

  // Generate comprehensive insights
  const generateInsights = async () => {
    setIsGenerating(true);
    try {
      const currentData = platform === "instagram" ? filteredData.posts : 
                         platform === "youtube" ? filteredData.videos : 
                         filteredData.metrics;
      const previousData = platform === "instagram" ? filteredData.previousPosts :
                          platform === "youtube" ? filteredData.previousVideos :
                          filteredData.previousMetrics;

      if (!currentData || currentData.length === 0) {
        toast({
          title: "Dados insuficientes",
          description: "Não há dados suficientes para gerar insights.",
          variant: "destructive",
        });
        return;
      }

      const platformGoals = goals.filter(g => g.platform === platform);

      // Build context for the enhanced AI prompt
      let context: any = {};
      
      if (platform === "instagram") {
        const posts = currentData as typeof filteredData.posts;
        const prevPosts = previousData as typeof filteredData.previousPosts;
        
        const totalLikes = posts?.reduce((sum, p) => sum + (p.likes || 0), 0) || 0;
        const totalComments = posts?.reduce((sum, p) => sum + (p.comments || 0), 0) || 0;
        const totalSaves = posts?.reduce((sum, p) => sum + (p.saves || 0), 0) || 0;
        const totalShares = posts?.reduce((sum, p) => sum + (p.shares || 0), 0) || 0;
        const totalReach = posts?.reduce((sum, p) => sum + (p.reach || 0), 0) || 0;
        const avgEngagement = posts && posts.length > 0
          ? posts.filter(p => p.engagement_rate).reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / 
            posts.filter(p => p.engagement_rate).length
          : 0;

        const prevTotalLikes = prevPosts?.reduce((sum, p) => sum + (p.likes || 0), 0) || 0;
        const prevTotalReach = prevPosts?.reduce((sum, p) => sum + (p.reach || 0), 0) || 0;
        const prevAvgEngagement = prevPosts && prevPosts.length > 0
          ? prevPosts.filter(p => p.engagement_rate).reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / 
            prevPosts.filter(p => p.engagement_rate).length
          : 0;

        context = {
          instagram: {
            totalPosts: posts?.length || 0,
            totalLikes,
            totalComments,
            totalSaves,
            totalShares,
            totalReach,
            avgEngagement,
            previousPeriod: {
              totalPosts: prevPosts?.length || 0,
              totalLikes: prevTotalLikes,
              totalReach: prevTotalReach,
              avgEngagement: prevAvgEngagement,
            },
            topPosts: posts?.slice(0, 5).map(p => ({
              caption: p.caption?.slice(0, 100),
              likes: p.likes,
              saves: p.saves,
              shares: p.shares,
              engagement: p.engagement_rate,
              type: p.post_type,
            })),
            goals: platformGoals.map(g => ({
              metric: g.metric_name,
              target: g.target_value,
              current: g.current_value,
              status: g.status,
            })),
          },
        };
      } else if (platform === "youtube") {
        const videos = currentData as typeof filteredData.videos;
        const prevVideos = previousData as typeof filteredData.previousVideos;
        
        const totalViews = videos?.reduce((sum, v) => sum + (v.total_views || 0), 0) || 0;
        const totalWatchHours = videos?.reduce((sum, v) => sum + (v.watch_hours || 0), 0) || 0;
        const totalSubs = videos?.reduce((sum, v) => sum + (v.subscribers_gained || 0), 0) || 0;

        const prevTotalViews = prevVideos?.reduce((sum, v) => sum + (v.total_views || 0), 0) || 0;

        context = {
          youtube: {
            totalVideos: videos?.length || 0,
            totalViews,
            watchHours: totalWatchHours,
            subscribers: totalSubs,
            previousPeriod: {
              totalViews: prevTotalViews,
            },
            topVideos: videos?.slice(0, 5).map(v => ({
              title: v.title?.slice(0, 80),
              views: v.total_views,
              ctr: v.click_rate,
            })),
            goals: platformGoals.map(g => ({
              metric: g.metric_name,
              target: g.target_value,
              current: g.current_value,
              status: g.status,
            })),
          },
        };
      }

      const { data, error } = await supabase.functions.invoke('generate-performance-insights', {
        body: { 
          clientId, 
          clientName: client.name,
          context,
          periodLabel: `Últimos ${period} dias`,
          platform,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }
      });

      if (error) throw error;

      if (data?.insights) {
        setInsights(data.insights);
      }
    } catch (error: any) {
      console.error("Error generating insights:", error);
      toast({
        title: "Erro ao gerar insights",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Prepare spreadsheet data
  const spreadsheetData = useMemo(() => {
    if (platform === "instagram" && filteredData.posts) {
      return filteredData.posts.map(p => ({
        id: p.id,
        date: p.posted_at ? format(new Date(p.posted_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-",
        type: p.post_type || "image",
        caption: p.caption?.slice(0, 80) || "-",
        reach: p.reach || 0,
        impressions: p.impressions || 0,
        engagement: p.engagement_rate || 0,
        likes: p.likes || 0,
        comments: p.comments || 0,
        saves: p.saves || 0,
        shares: p.shares || 0,
      }));
    }
    if (platform === "youtube" && filteredData.videos) {
      return filteredData.videos.map(v => ({
        id: v.id,
        date: v.published_at ? format(new Date(v.published_at), "dd/MM/yyyy", { locale: ptBR }) : "-",
        title: v.title || "-",
        views: v.total_views || 0,
        watchHours: v.watch_hours || 0,
        ctr: v.click_rate || 0,
        subscribers: v.subscribers_gained || 0,
        duration: v.duration_seconds ? Math.round(v.duration_seconds / 60) : 0,
      }));
    }
    if (platform === "newsletter" && filteredData.metrics) {
      return filteredData.metrics.map(m => ({
        id: m.id,
        date: format(new Date(m.metric_date), "dd/MM/yyyy", { locale: ptBR }),
        subscribers: m.subscribers || 0,
        openRate: m.open_rate || 0,
        clickRate: m.click_rate || 0,
        views: m.views || 0,
      }));
    }
    return [];
  }, [platform, filteredData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <Card className="border-border/30">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-3">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[180px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={generateInsights}
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Gerar Insights
              </Button>
              <ExportButton 
                data={spreadsheetData} 
                filename={`${client.name}-${platform}-${period}dias`}
                platform={platform}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Spreadsheet */}
      <MetricsSpreadsheet 
        data={spreadsheetData}
        platform={platform}
      />

      {/* Chart Tabs */}
      <Card className="border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Gráficos Detalhados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={chartTab} onValueChange={setChartTab}>
            <TabsList className="mb-4">
              {platform === "instagram" && (
                <>
                  <TabsTrigger value="reach" className="gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Alcance
                  </TabsTrigger>
                  <TabsTrigger value="engagement" className="gap-1.5">
                    <LineChart className="h-3.5 w-3.5" />
                    Engajamento
                  </TabsTrigger>
                  <TabsTrigger value="contentType" className="gap-1.5">
                    <PieChart className="h-3.5 w-3.5" />
                    Tipos
                  </TabsTrigger>
                  <TabsTrigger value="timing" className="gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Horários
                  </TabsTrigger>
                </>
              )}
              {platform === "youtube" && (
                <>
                  <TabsTrigger value="views" className="gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Views
                  </TabsTrigger>
                  <TabsTrigger value="watchTime" className="gap-1.5">
                    <LineChart className="h-3.5 w-3.5" />
                    Watch Time
                  </TabsTrigger>
                  <TabsTrigger value="ctr" className="gap-1.5">
                    <LineChart className="h-3.5 w-3.5" />
                    CTR
                  </TabsTrigger>
                </>
              )}
              {platform === "newsletter" && (
                <>
                  <TabsTrigger value="openRate" className="gap-1.5">
                    <LineChart className="h-3.5 w-3.5" />
                    Abertura
                  </TabsTrigger>
                  <TabsTrigger value="clickRate" className="gap-1.5">
                    <LineChart className="h-3.5 w-3.5" />
                    Cliques
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            {/* Instagram Charts */}
            {platform === "instagram" && (
              <>
                <TabsContent value="reach">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                        <Tooltip formatter={(value: number) => formatNumber(value)} />
                        <Area type="monotone" dataKey="reach" stroke={CHART_COLORS[0]} fill="url(#reachGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                <TabsContent value="engagement">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="engagement" name="Engajamento %" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="likes" name="Curtidas" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="comments" name="Comentários" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                <TabsContent value="contentType">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={contentTypeData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {contentTypeData.map((_, index) => (
                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                <TabsContent value="timing">
                  <PostingTimeHeatmap 
                    data={(filteredData.posts || [])
                      .filter(p => p.posted_at)
                      .map(p => {
                        const date = new Date(p.posted_at!);
                        return {
                          day: date.getDay(),
                          hour: date.getHours(),
                          value: p.engagement_rate || 0,
                        };
                      })} 
                  />
                </TabsContent>
              </>
            )}

            {/* YouTube Charts */}
            {platform === "youtube" && (
              <>
                <TabsContent value="views">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                        <Tooltip formatter={(value: number) => formatNumber(value)} />
                        <Bar dataKey="views" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                <TabsContent value="watchTime">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="watchGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                        <Tooltip formatter={(value: number) => `${formatNumber(value)} horas`} />
                        <Area type="monotone" dataKey="watchHours" stroke={CHART_COLORS[1]} fill="url(#watchGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                <TabsContent value="ctr">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                        <Line type="monotone" dataKey="ctr" name="CTR %" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
              </>
            )}

            {/* Newsletter Charts */}
            {platform === "newsletter" && (
              <>
                <TabsContent value="openRate">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                        <Line type="monotone" dataKey="openRate" name="Taxa de Abertura" stroke={CHART_COLORS[0]} strokeWidth={2} />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                <TabsContent value="clickRate">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                        <Line type="monotone" dataKey="clickRate" name="Taxa de Cliques" stroke={CHART_COLORS[1]} strokeWidth={2} />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* Generated Insights */}
      {insights && (
        <Card className="border-border/30 border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-sm font-medium">
                  Análise Completa - {PERIODS.find(p => p.value === period)?.label}
                </CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={generateInsights}
                disabled={isGenerating}
                className="h-7"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isGenerating ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="text-sm text-foreground/90 mb-3">{children}</p>,
                  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                  ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 text-sm">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 text-sm">{children}</ol>,
                  li: ({ children }) => <li className="text-foreground/90">{children}</li>,
                  h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                  table: ({ children }) => (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border border-border rounded">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th className="px-3 py-2 bg-muted text-left font-medium">{children}</th>,
                  td: ({ children }) => <td className="px-3 py-2 border-t border-border">{children}</td>,
                }}
              >
                {insights}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
