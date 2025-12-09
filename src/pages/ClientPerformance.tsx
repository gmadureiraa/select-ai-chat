import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Eye, Instagram, Youtube, Newspaper, RefreshCw, TrendingUp, TrendingDown, Users, CalendarIcon, Megaphone, Twitter, MousePointer, Heart, MessageCircle, Repeat2, UserPlus, AlertCircle, Clock, Play, Archive, ArchiveRestore, Link2, Video, BarChart3 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo, useEffect } from "react";
import { usePerformanceMetrics, useFetchBeehiivMetrics, useScrapeMetrics, useFetchInstagramMetrics } from "@/hooks/usePerformanceMetrics";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useYouTubeVideos, useFetchYouTubeMetrics } from "@/hooks/useYouTubeMetrics";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { GoalsPanel } from "@/components/performance/GoalsPanel";
import { ChannelCard } from "@/components/performance/ChannelCard";
import { YouTubeConnectionCard } from "@/components/performance/YouTubeConnectionCard";
import { TwitterConnectionCard } from "@/components/performance/TwitterConnectionCard";
import { CSVUploadCard } from "@/components/performance/CSVUploadCard";
import { useChannelDataStatus } from "@/hooks/useChannelDataStatus";
import { useYouTubeConnection, useFetchYouTubeAnalytics, useStartYouTubeOAuth } from "@/hooks/useYouTubeOAuth";
import { EnhancedKPICard } from "@/components/performance/EnhancedKPICard";
import { EnhancedAreaChart } from "@/components/performance/EnhancedAreaChart";
import { PerformanceTable, ProgressBar, ContentTypeIcon } from "@/components/performance/PerformanceTable";
import { InsightsCard } from "@/components/performance/InsightsCard";
import { StatsGrid } from "@/components/performance/StatsGrid";
import { MixedBarLineChart } from "@/components/performance/MixedBarLineChart";
import { DonutChart } from "@/components/performance/DonutChart";
import { AudienceSentimentGauge } from "@/components/performance/AudienceSentimentGauge";
import { useYouTubeSentiment, useAnalyzeYouTubeSentiment } from "@/hooks/useYouTubeSentiment";
import { useImportInstagramCSV } from "@/hooks/useImportInstagramCSV";
import { useImportNewsletterCSV } from "@/hooks/useImportNewsletterCSV";
import { useImportTwitterCSV } from "@/hooks/useImportTwitterCSV";

export default function ClientPerformance() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedChannel = searchParams.get("channel");
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState("30");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [chartMetric, setChartMetric] = useState<string>("followers");
  const [showArchived, setShowArchived] = useState(false);

  // Set default chart metric based on selected channel
  useEffect(() => {
    if (selectedChannel === "twitter") {
      setChartMetric("impressions");
    } else if (selectedChannel === "instagram") {
      setChartMetric("followers");
    } else if (selectedChannel === "youtube") {
      setChartMetric("views");
    } else if (selectedChannel === "tiktok") {
      setChartMetric("views");
    }
  }, [selectedChannel]);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Get archived channels from client tags
  const archivedChannels = useMemo(() => {
    const tags = client?.tags as any;
    return tags?.archived_channels || [];
  }, [client?.tags]);

  // Toggle archive mutation
  const toggleArchive = useMutation({
    mutationFn: async ({ channel, archive }: { channel: string; archive: boolean }) => {
      const currentTags = (client?.tags || {}) as any;
      const currentArchived = currentTags.archived_channels || [];
      
      const newArchived = archive
        ? [...currentArchived, channel]
        : currentArchived.filter((c: string) => c !== channel);
      
      const { error } = await supabase
        .from("clients")
        .update({ 
          tags: { 
            ...currentTags, 
            archived_channels: newArchived 
          } 
        })
        .eq("id", clientId);
      
      if (error) throw error;
    },
    onSuccess: (_, { archive }) => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      toast({
        title: archive ? "Canal arquivado" : "Canal restaurado",
        description: archive 
          ? "O canal foi movido para arquivados." 
          : "O canal foi restaurado para a lista principal.",
      });
    },
  });

  const { data: metrics, isLoading: metricsLoading } = usePerformanceMetrics(
    clientId || "", 
    selectedChannel || "",
    365
  );

  // YouTube videos query
  const { data: youtubeVideos, isLoading: youtubeVideosLoading } = useYouTubeVideos(
    clientId || "",
    100
  );

  const fetchBeehiiv = useFetchBeehiivMetrics();
  const scrapeMetrics = useScrapeMetrics();
  const fetchInstagram = useFetchInstagramMetrics();
  const fetchYouTube = useFetchYouTubeMetrics();

  // CSV Import hooks
  const importInstagramCSV = useImportInstagramCSV(clientId || "");
  const importNewsletterCSV = useImportNewsletterCSV(clientId || "");
  const importTwitterCSV = useImportTwitterCSV(clientId || "");

  const handleRefreshMetrics = async () => {
    if (!clientId || !selectedChannel) return;

    try {
      if (selectedChannel === "newsletter") {
        await fetchBeehiiv.mutateAsync(clientId);
        toast({
          title: "Métricas atualizadas",
          description: "Dados da newsletter foram sincronizados com sucesso.",
        });
      } else if (selectedChannel === "instagram") {
        const socialMedia = client?.social_media as any;
        const instagramUrl = socialMedia?.instagram || "";
        const username = instagramUrl.split("/").filter(Boolean).pop() || "";
        
        if (!username) {
          toast({
            title: "Erro",
            description: "Configure o Instagram do cliente primeiro.",
            variant: "destructive",
          });
          return;
        }
        
        await fetchInstagram.mutateAsync({ clientId, username });
        toast({
          title: "Métricas atualizadas",
          description: "Dados do Instagram foram coletados com sucesso.",
        });
      } else if (selectedChannel === "youtube") {
        const socialMedia = client?.social_media as any;
        let channelId = socialMedia?.youtube_channel_id || "";
        
        if (!channelId) {
          const youtubeUrl = socialMedia?.youtube || "";
          if (youtubeUrl.includes("/channel/")) {
            channelId = youtubeUrl.split("/channel/")[1]?.split(/[/?]/)[0] || "";
          }
        }
        
        if (!channelId) {
          toast({
            title: "Erro",
            description: "Configure o Channel ID do YouTube nas configurações do cliente.",
            variant: "destructive",
          });
          return;
        }
        
        await fetchYouTube.mutateAsync({ clientId, channelId });
        toast({
          title: "Métricas atualizadas",
          description: "Dados do YouTube foram coletados com sucesso.",
        });
      } else if (selectedChannel === "tiktok") {
        toast({
          title: "Em desenvolvimento",
          description: "A integração com TikTok está em desenvolvimento.",
        });
      } else {
        toast({
          title: "Canal não suportado",
          description: "Este canal ainda não tem integração automática.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar as métricas. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const isRefreshing = fetchBeehiiv.isPending || scrapeMetrics.isPending || fetchInstagram.isPending || fetchYouTube.isPending;

  // Calculate period-based metrics for KPIs
  const periodMetrics = useMemo(() => {
    if (!metrics || metrics.length === 0) return null;
    
    let filteredMetrics = metrics;
    
    if (dateRange === "custom" && customDateRange?.from) {
      const startDate = customDateRange.from;
      const endDate = customDateRange.to || new Date();
      filteredMetrics = metrics.filter(m => {
        const metricDate = new Date(m.metric_date);
        return isWithinInterval(metricDate, { start: startDate, end: endDate });
      });
    } else {
      filteredMetrics = metrics.slice(0, parseInt(dateRange));
    }
    
    if (filteredMetrics.length === 0) return null;
    
    const totalViews = filteredMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    const totalReach = filteredMetrics.reduce((sum, m) => {
      const metadata = m.metadata as any;
      return sum + (metadata?.reach || 0);
    }, 0);
    const totalFollowerGain = filteredMetrics.reduce((sum, m) => {
      const metadata = m.metadata as any;
      return sum + (metadata?.followers_gained || metadata?.daily_gain || 0);
    }, 0);
    const currentFollowers = metrics[0]?.subscribers || 0;
    
    // Calculate previous period for comparison
    const previousMetrics = metrics.slice(parseInt(dateRange), parseInt(dateRange) * 2);
    const previousViews = previousMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    const previousFollowerGain = previousMetrics.reduce((sum, m) => {
      const metadata = m.metadata as any;
      return sum + (metadata?.followers_gained || metadata?.daily_gain || 0);
    }, 0);
    
    return {
      totalViews,
      totalReach,
      totalFollowerGain,
      currentFollowers,
      daysInPeriod: filteredMetrics.length,
      viewsChange: previousViews > 0 ? ((totalViews - previousViews) / previousViews) * 100 : 0,
      followersChange: previousFollowerGain > 0 ? ((totalFollowerGain - previousFollowerGain) / previousFollowerGain) * 100 : 0,
      previousViews,
      previousFollowerGain,
    };
  }, [metrics, dateRange, customDateRange]);

  // Sparkline data for KPIs (last 7 days)
  const sparklineData = useMemo(() => {
    if (!metrics || metrics.length < 7) return { views: [], followers: [], reach: [] };
    
    const last7 = metrics.slice(0, 7).reverse();
    return {
      views: last7.map(m => m.views || 0),
      followers: last7.map(m => m.subscribers || 0),
      reach: last7.map(m => (m.metadata as any)?.reach || 0),
      impressions: last7.map(m => (m.metadata as any)?.impressions || 0),
      engagements: last7.map(m => (m.metadata as any)?.engagements || 0),
    };
  }, [metrics]);

  // Chart metrics config
  const instagramChartMetrics = [
    { key: "views", label: "Views", dataKey: "views", color: "hsl(var(--primary))" },
    { key: "reach", label: "Alcance", dataKey: "reach", color: "hsl(var(--secondary))" },
    { key: "followers", label: "Seguidores", dataKey: "subscribers", color: "hsl(var(--primary))" },
    { key: "dailyGain", label: "Ganho Diário", dataKey: "followers_gained", color: "hsl(var(--secondary))" },
  ];

  const twitterChartMetrics = [
    { key: "impressions", label: "Impressões", dataKey: "impressions", color: "hsl(var(--primary))" },
    { key: "engagements", label: "Engajamentos", dataKey: "engagements", color: "hsl(var(--secondary))" },
    { key: "likes", label: "Curtidas", dataKey: "likes", color: "hsl(var(--secondary))" },
    { key: "followers", label: "Seguidores", dataKey: "subscribers", color: "hsl(var(--primary))" },
  ];

  const youtubeChartMetrics = [
    { key: "views", label: "Views", dataKey: "views", color: "hsl(var(--primary))" },
    { key: "watchHours", label: "Horas", dataKey: "watch_hours", color: "hsl(var(--secondary))" },
  ];

  // YouTube sentiment hook
  const { data: youtubeSentiment } = useYouTubeSentiment(clientId || "");
  const analyzeSentiment = useAnalyzeYouTubeSentiment();

  const chartData = useMemo(() => {
    if (!metrics) return [];
    
    let filteredMetrics = metrics;
    
    if (dateRange === "custom" && customDateRange?.from) {
      const startDate = customDateRange.from;
      const endDate = customDateRange.to || new Date();
      filteredMetrics = metrics.filter(m => {
        const metricDate = new Date(m.metric_date);
        return isWithinInterval(metricDate, { start: startDate, end: endDate });
      });
    } else {
      filteredMetrics = metrics.slice(0, parseInt(dateRange));
    }
    
    // Sort chronologically (oldest first for chart display)
    const sortedMetrics = [...filteredMetrics].sort((a, b) => 
      new Date(a.metric_date).getTime() - new Date(b.metric_date).getTime()
    );
    
    return sortedMetrics.map((m) => {
      const metadata = m.metadata as any;
      return {
        ...m,
        // Use subscribers directly if available (most reliable)
        subscribers: m.subscribers || 0,
        followers_gained: metadata?.followers_gained || metadata?.daily_gain || metadata?.new_follows || 0,
        reach: metadata?.reach || 0,
        impressions: metadata?.impressions || 0,
        engagements: metadata?.engagements || 0,
        likes: metadata?.likes || 0,
        watch_hours: metadata?.watch_hours || 0,
        date: new Date(m.metric_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      };
    });
  }, [metrics, dateRange, customDateRange]);

  // Donut chart data for content distribution
  const contentDistribution = useMemo(() => {
    if (selectedChannel === "instagram" && metrics?.[0]?.metadata) {
      const posts = (metrics[0].metadata as any)?.recent_posts || [];
      const distribution: Record<string, number> = {};
      posts.forEach((p: any) => {
        const type = p.type === "Video" ? "Reels" : p.type || "Post";
        distribution[type] = (distribution[type] || 0) + 1;
      });
      return Object.entries(distribution).map(([name, value], i) => ({
        name,
        value,
        color: i === 0 ? "hsl(var(--primary))" : i === 1 ? "hsl(var(--secondary))" : "hsl(var(--accent))",
      }));
    }
    if (selectedChannel === "youtube" && youtubeVideos) {
      // Group by month for YouTube
      return [
        { name: "Vídeos", value: youtubeVideos.length, color: "hsl(var(--primary))" },
      ];
    }
    return [];
  }, [selectedChannel, metrics, youtubeVideos]);

  // Generate insights
  const insights = useMemo(() => {
    if (!periodMetrics) return [];
    
    const result: { type: "success" | "warning" | "info" | "highlight"; title: string; value?: string | number; change?: number; description?: string }[] = [];
    
    if (periodMetrics.viewsChange > 20) {
      result.push({
        type: "success",
        title: "Crescimento de visualizações",
        change: periodMetrics.viewsChange,
        description: "Performance acima da média do período anterior",
      });
    } else if (periodMetrics.viewsChange < -20) {
      result.push({
        type: "warning",
        title: "Queda em visualizações",
        change: periodMetrics.viewsChange,
        description: "Considere ajustar a estratégia de conteúdo",
      });
    }
    
    if (periodMetrics.totalFollowerGain > 0) {
      result.push({
        type: "info",
        title: "Novos seguidores no período",
        value: `+${periodMetrics.totalFollowerGain.toLocaleString("pt-BR")}`,
      });
    }
    
    return result;
  }, [periodMetrics]);

  // Best performing content
  const bestContent = useMemo(() => {
    if (selectedChannel === "youtube" && youtubeVideos && youtubeVideos.length > 0) {
      const best = youtubeVideos.reduce((a, b) => (a.total_views || 0) > (b.total_views || 0) ? a : b);
      return {
        title: best.title,
        metric: "visualizações",
        value: best.total_views || 0,
        type: "Vídeo",
      };
    }
    
    if (metrics?.[0]?.metadata) {
      const posts = (metrics[0].metadata as any)?.recent_posts || [];
      if (posts.length > 0) {
        const best = posts.reduce((a: any, b: any) => (a.views || 0) > (b.views || 0) ? a : b);
        return {
          title: best.caption || best.title || "Post sem título",
          metric: "visualizações",
          value: best.views || 0,
          type: best.type || "Post",
        };
      }
    }
    
    return null;
  }, [selectedChannel, youtubeVideos, metrics]);

  // Channel definitions - Removed "cortes", added TikTok
  const channels = {
    newsletter: {
      icon: Newspaper,
      title: "Newsletter",
      description: "Análise de emails e engajamento da newsletter",
    },
    instagram: {
      icon: Instagram,
      title: "Instagram",
      description: "Métricas de posts, stories e engajamento",
    },
    twitter: {
      icon: Twitter,
      title: "X (Twitter)",
      description: "Impressões, engajamentos e crescimento de seguidores",
    },
    youtube: {
      icon: Youtube,
      title: "YouTube",
      description: "Views, horas assistidas e performance por vídeo",
    },
    tiktok: {
      icon: Video,
      title: "TikTok",
      description: "Performance de vídeos curtos e conteúdo viral",
    },
  };

  // Channel data status
  const { data: channelStatus, isLoading: statusLoading } = useChannelDataStatus(clientId || "");
  
  // YouTube OAuth
  const { data: youtubeConnection } = useYouTubeConnection(clientId || "");
  const startYouTubeOAuth = useStartYouTubeOAuth();
  const fetchYouTubeAnalytics = useFetchYouTubeAnalytics();

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <p className="text-muted-foreground">Cliente não encontrado</p>
      </div>
    );
  }

  // If no channel selected, show channel selection
  if (!selectedChannel) {
    const activeChannels = Object.entries(channels).filter(([key]) => !archivedChannels.includes(key));
    const archivedChannelsList = Object.entries(channels).filter(([key]) => archivedChannels.includes(key));

    return (
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <PageHeader
          title={client.name}
          subtitle="Escolha um canal para análise"
          onBack={() => navigate("/performance")}
        />

        {/* Active Channels - cleaner grid */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Canais Disponíveis</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeChannels.map(([key, channel]) => {
              const status = channelStatus?.[key];
              return (
                <ChannelCard
                  key={key}
                  channelKey={key}
                  icon={channel.icon}
                  title={channel.title}
                  description={channel.description}
                  hasData={status?.hasData || false}
                  daysOfData={status?.daysOfData || 0}
                  lastUpdate={status?.lastUpdate || null}
                  onClick={() => setSearchParams({ channel: key })}
                  onArchive={() => toggleArchive.mutate({ channel: key, archive: true })}
                />
              );
            })}
          </div>
        </div>

        {/* Archived Channels */}
        {archivedChannelsList.length > 0 && (
          <div className="space-y-3">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Archive className="h-4 w-4" />
              <span>Canais arquivados ({archivedChannelsList.length})</span>
              <span className="text-xs">{showArchived ? "▼" : "▶"}</span>
            </button>
            
            {showArchived && (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {archivedChannelsList.map(([key, channel]) => {
                  const status = channelStatus?.[key];
                  return (
                    <ChannelCard
                      key={key}
                      channelKey={key}
                      icon={channel.icon}
                      title={channel.title}
                      description={channel.description}
                      hasData={status?.hasData || false}
                      daysOfData={status?.daysOfData || 0}
                      lastUpdate={status?.lastUpdate || null}
                      isArchived
                      onClick={() => setSearchParams({ channel: key })}
                      onRestore={() => toggleArchive.mutate({ channel: key, archive: false })}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const isStartOfMonth = new Date().getDate() <= 5;
  const dateRangeLabel = chartData.length > 0 ? `${chartData[0]?.date} - ${chartData[chartData.length - 1]?.date}` : "";

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Monthly reminder */}
      {isStartOfMonth && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-sm text-amber-200">
            Novo mês! Lembre-se de atualizar os CSVs de métricas.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <PageHeader
          title="Analytics"
          subtitle={`${channels[selectedChannel as keyof typeof channels]?.title || "Análise"} · ${client.name}`}
          onBack={() => setSearchParams({})}
        />
        
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={(v) => {
            setDateRange(v);
            if (v !== "custom") setCustomDateRange(undefined);
          }}>
            <SelectTrigger className="w-[160px] h-9">
              <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="custom">Período personalizado</SelectItem>
            </SelectContent>
          </Select>
          
          {dateRange === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  {customDateRange?.from ? (
                    customDateRange.to ? (
                      <>
                        {format(customDateRange.from, "dd/MM", { locale: ptBR })} - {format(customDateRange.to, "dd/MM", { locale: ptBR })}
                      </>
                    ) : (
                      format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                    )
                  ) : (
                    "Selecionar datas"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customDateRange}
                  onSelect={setCustomDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                  disabled={(date) => date > new Date()}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          )}
          
          <Button
            onClick={handleRefreshMetrics}
            disabled={isRefreshing}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {metricsLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {/* INSTAGRAM */}
      {!metricsLoading && selectedChannel === "instagram" && (
        <>
          {/* CSV Upload for Instagram */}
          <div className="grid gap-4 md:grid-cols-2">
            <CSVUploadCard
              title="Importar Métricas Instagram"
              description="Importe dados diários de seguidores, alcance e engajamento"
              columns={[
                { name: "date", required: true },
                { name: "followers", required: false },
                { name: "views", required: false },
                { name: "likes", required: false },
                { name: "comments", required: false },
              ]}
              templateName="instagram-metricas"
              onUpload={async (data) => { await importInstagramCSV.mutateAsync(data); }}
              isLoading={importInstagramCSV.isPending}
            />
          </div>

          {periodMetrics && (
            <>
              {/* Enhanced KPI Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <EnhancedKPICard
                  title={`Visualizações (${periodMetrics.daysInPeriod}d)`}
                  value={periodMetrics.totalViews}
                  change={periodMetrics.viewsChange}
                  icon={Eye}
                  sparklineData={sparklineData.views}
                  accentColor="primary"
                />
                <EnhancedKPICard
                  title={`Alcance (${periodMetrics.daysInPeriod}d)`}
                  value={periodMetrics.totalReach}
                  icon={Megaphone}
                  sparklineData={sparklineData.reach}
                  accentColor="secondary"
                />
                <EnhancedKPICard
                  title="Seguidores atuais"
                  value={periodMetrics.currentFollowers}
                  icon={Users}
                  sparklineData={sparklineData.followers}
                  accentColor="primary"
                />
                <EnhancedKPICard
                  title="Ganho no período"
                  value={periodMetrics.totalFollowerGain}
                  change={periodMetrics.followersChange}
                  icon={TrendingUp}
                  formatter={(v) => (v >= 0 ? `+${v.toLocaleString("pt-BR")}` : v.toLocaleString("pt-BR"))}
                  accentColor="accent"
                />
              </div>

              {/* Goals Panel */}
              <GoalsPanel
                clientId={clientId!}
                platform="instagram"
                currentMetrics={{
                  followers: periodMetrics.currentFollowers,
                  views: periodMetrics.totalViews,
                }}
              />

              {/* Insights */}
              {(insights.length > 0 || bestContent) && (
                <InsightsCard
                  insights={insights}
                  bestContent={bestContent || undefined}
                  periodComparison={periodMetrics.previousViews > 0 ? {
                    label: "Visualizações",
                    current: periodMetrics.totalViews,
                    previous: periodMetrics.previousViews,
                  } : undefined}
                />
              )}

              {/* Enhanced Area Chart */}
              {chartData.length >= 1 && (
                <EnhancedAreaChart
                  data={chartData}
                  metrics={instagramChartMetrics}
                  selectedMetric={chartMetric}
                  onMetricChange={setChartMetric}
                  dateRange={dateRangeLabel}
                />
              )}

              {/* Performance Table with badges */}
              {metrics?.[0]?.metadata && (metrics[0].metadata as any)?.recent_posts?.length > 0 && (
                <PerformanceTable
                  title="Posts Recentes"
                  description="Performance individual com indicadores de sucesso"
                  data={(metrics[0].metadata as any).recent_posts.map((post: any) => ({
                    ...post,
                    views: post.views || 0,
                    type: post.type === "Video" ? "Reels" : post.type,
                  }))}
                  columns={[
                    { 
                      key: "caption", 
                      label: "Post",
                      format: (value, row) => (
                        <div className="flex items-center gap-2">
                          <ContentTypeIcon type={row.type} />
                          <Badge variant="outline" className="text-xs shrink-0">
                            {row.type}
                          </Badge>
                          <span className="text-sm truncate max-w-[200px]">
                            {value || "Sem legenda"}
                          </span>
                        </div>
                      )
                    },
                    { 
                      key: "views", 
                      label: "Views", 
                      align: "right",
                      format: (value, row) => <ProgressBar value={value || 0} max={Math.max(...(metrics[0].metadata as any).recent_posts.map((p: any) => p.views || 0), 1)} />
                    },
                    { key: "likes", label: "Curtidas", align: "right", format: (v) => (v || 0).toLocaleString('pt-BR') },
                    { key: "comments", label: "Comentários", align: "right", format: (v) => (v || 0).toLocaleString('pt-BR') },
                    { 
                      key: "timestamp", 
                      label: "Data", 
                      align: "right",
                      format: (v) => v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '-'
                    },
                  ]}
                  metricKey="views"
                />
              )}
            </>
          )}
        </>
      )}

      {/* TWITTER */}
      {!metricsLoading && selectedChannel === "twitter" && (
        <>
          {/* Twitter Connection + CSV Upload */}
          <div className="grid gap-4 md:grid-cols-2">
            <TwitterConnectionCard clientId={clientId || ""} />
            <CSVUploadCard
              title="Importar Métricas Twitter/X"
              description="Importe dados de impressões, engajamentos e seguidores"
              columns={[
                { name: "date", required: true },
                { name: "impressions", required: false },
                { name: "followers", required: false },
                { name: "likes", required: false },
              ]}
              templateName="twitter-metricas"
              onUpload={async (data) => { await importTwitterCSV.mutateAsync(data); }}
              isLoading={importTwitterCSV.isPending}
            />
          </div>

          {metrics && metrics.length > 0 && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <EnhancedKPICard
                  title={`Impressões (${periodMetrics?.daysInPeriod || 0}d)`}
                  value={metrics.slice(0, parseInt(dateRange) || 30).reduce((sum, m) => sum + ((m.metadata as any)?.impressions || 0), 0)}
                  icon={Eye}
                  sparklineData={sparklineData.impressions}
                  accentColor="primary"
                />
                <EnhancedKPICard
                  title={`Engajamentos (${periodMetrics?.daysInPeriod || 0}d)`}
                  value={metrics.slice(0, parseInt(dateRange) || 30).reduce((sum, m) => sum + ((m.metadata as any)?.engagements || 0), 0)}
                  icon={MousePointer}
                  sparklineData={sparklineData.engagements}
                  accentColor="secondary"
                />
                <EnhancedKPICard
                  title="Seguidores atuais"
                  value={metrics[0]?.subscribers || 0}
                  icon={Users}
                  sparklineData={sparklineData.followers}
                  accentColor="primary"
                />
                <EnhancedKPICard
                  title="Novos seguidores"
                  value={metrics.slice(0, parseInt(dateRange) || 30).reduce((sum, m) => sum + ((m.metadata as any)?.new_follows || 0), 0)}
                  icon={UserPlus}
                  formatter={(v) => `+${v.toLocaleString("pt-BR")}`}
                  accentColor="accent"
                />
              </div>

              {chartData.length >= 1 && (
                <EnhancedAreaChart
                  data={chartData}
                  metrics={twitterChartMetrics}
                  selectedMetric={chartMetric}
                  onMetricChange={setChartMetric}
                  dateRange={dateRangeLabel}
                />
              )}
            </>
          )}
        </>
      )}

      {/* YOUTUBE */}
      {!metricsLoading && selectedChannel === "youtube" && (
        <>
          {/* YouTube Connection Card - inside channel page */}
          <YouTubeConnectionCard clientId={clientId || ""} />
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <EnhancedKPICard
              title={`Views (${periodMetrics?.daysInPeriod || 0}d)`}
              value={periodMetrics?.totalViews || 0}
              icon={Eye}
              sparklineData={sparklineData.views}
              accentColor="primary"
            />
            <EnhancedKPICard
              title="Horas Assistidas"
              value={youtubeVideos?.reduce((sum, v) => sum + (v.watch_hours || 0), 0) || 0}
              icon={Clock}
              formatter={(v) => `${(v / 1000).toFixed(1)}k`}
              accentColor="secondary"
            />
            <EnhancedKPICard
              title="Inscritos Ganhos"
              value={youtubeVideos?.reduce((sum, v) => sum + (v.subscribers_gained || 0), 0) || 0}
              icon={UserPlus}
              formatter={(v) => `+${v.toLocaleString("pt-BR")}`}
              accentColor="accent"
            />
            <EnhancedKPICard
              title="CTR Médio"
              value={youtubeVideos && youtubeVideos.length > 0 
                ? youtubeVideos.reduce((sum, v) => sum + (v.click_rate || 0), 0) / youtubeVideos.length 
                : 0}
              icon={MousePointer}
              formatter={(v) => `${v.toFixed(2)}%`}
              accentColor="primary"
            />
          </div>

          {/* Audience Sentiment Gauge for YouTube */}
          <div className="grid gap-4 md:grid-cols-2">
            <AudienceSentimentGauge
              score={youtubeSentiment?.score || 50}
              previousScore={undefined}
              totalComments={youtubeSentiment?.totalComments}
              lastUpdated={youtubeSentiment?.lastUpdated ? new Date(youtubeSentiment.lastUpdated).toLocaleDateString('pt-BR') : undefined}
              isLoading={analyzeSentiment.isPending}
              onRefresh={() => {
                // TODO: Get actual comments from YouTube API
                analyzeSentiment.mutate({ clientId: clientId || "", comments: [] });
              }}
            />
            
            {/* Best video insight */}
            {bestContent && (
              <InsightsCard
                insights={youtubeSentiment?.insights?.map(i => ({ type: "info" as const, title: i })) || []}
                bestContent={bestContent}
              />
            )}
          </div>

          {chartData.length >= 1 && (
            <EnhancedAreaChart
              data={chartData}
              metrics={youtubeChartMetrics}
              selectedMetric={chartMetric}
              onMetricChange={setChartMetric}
              dateRange={dateRangeLabel}
            />
          )}

          {/* YouTube Videos Table with enhanced styling */}
          {youtubeVideos && youtubeVideos.length > 0 && (
            <PerformanceTable
              title="Vídeos"
              description="Performance individual de cada vídeo"
              data={youtubeVideos
                .filter(video => {
                  if (dateRange === "custom" && customDateRange?.from && video.published_at) {
                    const publishDate = new Date(video.published_at);
                    const startDate = customDateRange.from;
                    const endDate = customDateRange.to || new Date();
                    return publishDate >= startDate && publishDate <= endDate;
                  }
                  if (video.published_at) {
                    const publishDate = new Date(video.published_at);
                    return publishDate >= new Date('2024-12-01');
                  }
                  return true;
                })
                .map(video => ({
                  ...video,
                  views: video.total_views || 0,
                }))}
              columns={[
                { 
                  key: "title", 
                  label: "Título",
                  format: (value, row) => (
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-10 bg-muted rounded overflow-hidden flex-shrink-0 relative group">
                        {row.thumbnail_url ? (
                          <>
                            <img 
                              src={row.thumbnail_url} 
                              alt={value}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="h-4 w-4 text-white" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-sm truncate max-w-[220px]">{value}</span>
                    </div>
                  )
                },
                { 
                  key: "total_views", 
                  label: "Views", 
                  align: "right",
                  format: (v) => (v || 0).toLocaleString('pt-BR')
                },
                { 
                  key: "watch_hours", 
                  label: "Horas", 
                  align: "right",
                  format: (v) => v ? `${(v / 1000).toFixed(1)}k` : '-'
                },
                { 
                  key: "subscribers_gained", 
                  label: "Inscritos", 
                  align: "right",
                  format: (v) => v ? <span className="text-emerald-500">+{v.toLocaleString('pt-BR')}</span> : '-'
                },
                { 
                  key: "click_rate", 
                  label: "CTR", 
                  align: "right",
                  format: (v) => v ? <span className="text-primary font-medium">{v}%</span> : '-'
                },
                { 
                  key: "published_at", 
                  label: "Data", 
                  align: "right",
                  format: (v) => v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '-'
                },
              ]}
              metricKey="views"
            />
          )}

          {(!youtubeVideos || youtubeVideos.length === 0) && !youtubeVideosLoading && (
            <Card className="border-border/50 border-dashed">
              <CardContent className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Play className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-2">Nenhum dado de vídeo</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Conecte sua conta YouTube acima ou importe CSVs do Analytics.
                </p>
                <Button variant="outline" onClick={handleRefreshMetrics} disabled={isRefreshing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Coletar Dados
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* TIKTOK - Coming Soon */}
      {!metricsLoading && selectedChannel === "tiktok" && (
        <Card className="border-border/50 border-dashed">
          <CardContent className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Video className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-2">TikTok Analytics</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Integração em desenvolvimento. Em breve você poderá acompanhar métricas de vídeos curtos.
            </p>
            <Badge variant="outline" className="text-muted-foreground">Em breve</Badge>
          </CardContent>
        </Card>
      )}

      {/* NEWSLETTER */}
      {!metricsLoading && selectedChannel === "newsletter" && (
        <>
          {/* CSV Upload for Newsletter */}
          <div className="grid gap-4 md:grid-cols-2">
            <CSVUploadCard
              title="Importar Métricas Newsletter"
              description="Importe dados de assinantes, abertura e cliques"
              columns={[
                { name: "date", required: true },
                { name: "subscribers", required: false },
                { name: "open_rate", required: false },
                { name: "click_rate", required: false },
              ]}
              templateName="newsletter-metricas"
              onUpload={async (data) => { await importNewsletterCSV.mutateAsync(data); }}
              isLoading={importNewsletterCSV.isPending}
            />
          </div>

          {metrics && metrics.length > 0 && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <EnhancedKPICard
                  title="Inscritos"
                  value={metrics[0]?.subscribers || 0}
                  icon={Users}
                  accentColor="primary"
                />
                <EnhancedKPICard
                  title="Taxa de Abertura"
                  value={metrics[0]?.open_rate || 0}
                  icon={Eye}
                  formatter={(v) => `${v}%`}
                  accentColor="secondary"
                />
                <EnhancedKPICard
                  title="Taxa de Cliques"
                  value={metrics[0]?.click_rate || 0}
                  icon={MousePointer}
                  formatter={(v) => `${v}%`}
                  accentColor="accent"
                />
                <EnhancedKPICard
                  title="Emails Enviados"
                  value={metrics[0]?.total_posts || 0}
                  icon={Newspaper}
                  accentColor="primary"
                />
              </div>
              <PerformanceTable
                title="Últimos Emails Enviados"
                description="Performance individual de cada email"
                data={(metrics[0].metadata as any).recent_posts.map((post: any) => ({
                  ...post,
                  views: post.opened || 0,
                }))}
                columns={[
                  { key: "title", label: "Título", format: (v) => <span className="font-medium">{v}</span> },
                  { key: "delivered", label: "Enviados", align: "right", format: (v) => (v || 0).toLocaleString('pt-BR') },
                  { key: "opened", label: "Aberturas", align: "right", format: (v) => (v || 0).toLocaleString('pt-BR') },
                  { key: "open_rate", label: "Taxa", align: "right", format: (v) => <span className="text-emerald-500 font-medium">{v}%</span> },
                  { key: "clicked", label: "Cliques", align: "right", format: (v) => (v || 0).toLocaleString('pt-BR') },
                  { key: "click_rate", label: "Taxa", align: "right", format: (v) => <span className="text-primary font-medium">{v}%</span> },
                  { 
                    key: "published_at", 
                    label: "Data", 
                    align: "right",
                    format: (v) => v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '-'
                  },
                ]}
                metricKey="views"
              />
            </>
          )}
        </>
      )}

      {/* No data state */}
      {!metricsLoading && (!metrics || metrics.length === 0) && selectedChannel !== "tiktok" && (
        <Card className="border-border/50 border-dashed">
          <CardContent className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-2">Nenhum dado disponível</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Clique em "Atualizar" para coletar dados ou importe via CSV.
            </p>
            <Button variant="outline" onClick={handleRefreshMetrics} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Coletar Dados
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
