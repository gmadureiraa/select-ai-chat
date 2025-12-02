import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Eye, Instagram, Youtube, Newspaper, RefreshCw, TrendingUp, TrendingDown, Users, CalendarIcon, Megaphone, Twitter, MousePointer, Heart, MessageCircle, Repeat2, UserPlus, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useState, useMemo, useEffect } from "react";
import { usePerformanceMetrics, useFetchBeehiivMetrics, useScrapeMetrics, useFetchInstagramMetrics } from "@/hooks/usePerformanceMetrics";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

export default function ClientPerformance() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedChannel = searchParams.get("channel");
const { toast } = useToast();
  const [dateRange, setDateRange] = useState("30");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [chartMetric, setChartMetric] = useState<"views" | "reach" | "followers" | "dailyGain" | "impressions" | "engagements" | "likes">("followers");

  // Set default chart metric based on selected channel
  useEffect(() => {
    if (selectedChannel === "twitter") {
      setChartMetric("impressions");
    } else if (selectedChannel === "instagram") {
      setChartMetric("followers");
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

  const { data: metrics, isLoading: metricsLoading } = usePerformanceMetrics(
    clientId || "", 
    selectedChannel || "",
    100 // Fetch up to 100 days for custom ranges
  );

  const fetchBeehiiv = useFetchBeehiivMetrics();
  const scrapeMetrics = useScrapeMetrics();
  const fetchInstagram = useFetchInstagramMetrics();

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
        // Get Instagram username from client social_media
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
      } else {
        const urls: Record<string, string> = {
          cortes: "https://www.youtube.com/channel/UCDUYB7s0W20qs90e160B1LA",
        };
        
        const platform = selectedChannel === "cortes" ? "youtube" : selectedChannel;
        await scrapeMetrics.mutateAsync({
          clientId,
          platform,
          url: urls[selectedChannel],
        });
        toast({
          title: "Métricas atualizadas",
          description: "Dados foram coletados com sucesso.",
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

  const isRefreshing = fetchBeehiiv.isPending || scrapeMetrics.isPending || fetchInstagram.isPending;

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
    
    // Sum views for the period
    const totalViews = filteredMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    
    // Sum reach for the period from metadata
    const totalReach = filteredMetrics.reduce((sum, m) => {
      const metadata = m.metadata as any;
      return sum + (metadata?.reach || 0);
    }, 0);
    
    // Calculate follower gain in the period from followers_gained metadata
    const totalFollowerGain = filteredMetrics.reduce((sum, m) => {
      const metadata = m.metadata as any;
      return sum + (metadata?.followers_gained || metadata?.daily_gain || 0);
    }, 0);
    
    // Current followers from most recent metric
    const currentFollowers = metrics[0]?.subscribers || 0;
    
    return {
      totalViews,
      totalReach,
      totalFollowerGain,
      currentFollowers,
      daysInPeriod: filteredMetrics.length,
    };
  }, [metrics, dateRange, customDateRange]);

  // Chart data configuration - Kaleidos colors (green and pink)
  const chartConfig = useMemo(() => ({
    views: { label: "Visualizações", color: "hsl(160, 84%, 39%)", dataKey: "views" },
    reach: { label: "Alcance", color: "hsl(330, 81%, 60%)", dataKey: "reach" },
    followers: { label: "Seguidores", color: "hsl(160, 84%, 39%)", dataKey: "subscribers" },
    dailyGain: { label: "Ganho Diário", color: "hsl(330, 81%, 60%)", dataKey: "followers_gained" },
    engagement: { label: "Engajamento (%)", color: "hsl(160, 84%, 39%)", dataKey: "engagement_rate" },
    impressions: { label: "Impressões", color: "hsl(160, 84%, 39%)", dataKey: "impressions" },
    engagements: { label: "Engajamentos", color: "hsl(330, 81%, 60%)", dataKey: "engagements" },
    likes: { label: "Curtidas", color: "hsl(330, 81%, 60%)", dataKey: "likes" },
  }), []);

  const chartData = useMemo(() => {
    if (!metrics) return [];
    
    // Filter metrics based on date range selection
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
    
    // Current followers from the most recent metric
    const currentFollowers = metrics[0]?.subscribers || 0;
    
    // Sort by date descending for calculation
    const sortedMetrics = [...filteredMetrics].sort((a, b) => 
      new Date(b.metric_date).getTime() - new Date(a.metric_date).getTime()
    );
    
    // Calculate historical followers by subtracting daily gains backwards
    let runningTotal = currentFollowers;
    
    // First, calculate how much to subtract to get to the first date in our range
    const allMetricsSorted = [...metrics].sort((a, b) => 
      new Date(b.metric_date).getTime() - new Date(a.metric_date).getTime()
    );
    
    // Find the index of the first metric in our filtered range
    const firstFilteredDate = sortedMetrics[0]?.metric_date;
    const startIndex = allMetricsSorted.findIndex(m => m.metric_date === firstFilteredDate);
    
    // Subtract daily gains from index 0 to startIndex to get the correct starting point
    for (let i = 0; i < startIndex; i++) {
      const metadata = allMetricsSorted[i]?.metadata as any;
      const dailyGain = metadata?.daily_gain || 0;
      runningTotal -= dailyGain;
    }
    
    const calculatedData = sortedMetrics.map((m, index) => {
      const metadata = m.metadata as any;
      const dailyGain = metadata?.followers_gained || metadata?.daily_gain || metadata?.new_follows || 0;
      
      let calculatedSubscribers = runningTotal;
      if (index > 0) {
        const prevMetadata = sortedMetrics[index - 1]?.metadata as any;
        const prevDailyGain = prevMetadata?.followers_gained || prevMetadata?.daily_gain || prevMetadata?.new_follows || 0;
        runningTotal -= prevDailyGain;
        calculatedSubscribers = runningTotal;
      }
      
      return {
        ...m,
        subscribers: m.subscribers || calculatedSubscribers,
        followers_gained: dailyGain,
        reach: metadata?.reach || 0,
        impressions: metadata?.impressions || 0,
        engagements: metadata?.engagements || 0,
        date: new Date(m.metric_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      };
    });
    
    // Reverse to show oldest to newest in chart
    return calculatedData.reverse();
  }, [metrics, dateRange, customDateRange]);

  // Canais disponíveis por cliente
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
    cortes: {
      icon: Youtube,
      title: "Cortes (YouTube/TikTok)",
      description: "Performance de vídeos curtos e viral content",
    },
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
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

  // Se não tem canal selecionado, mostra a seleção de canais
  if (!selectedChannel) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <PageHeader
          title={client.name}
          subtitle="Escolha um canal para análise"
          onBack={() => navigate("/performance")}
        />

        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(channels).map(([key, channel]) => {
            const Icon = channel.icon;
            return (
              <Card
                key={key}
                className="border-border/50 bg-card/50 hover:border-border transition-all cursor-pointer"
                onClick={() => setSearchParams({ channel: key })}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{channel.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">{channel.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // KPI Card Component
  const KPICard = ({ 
    title, 
    value, 
    change, 
    icon: Icon,
    formatter = (v: number) => v.toLocaleString("pt-BR")
  }: { 
    title: string; 
    value: number; 
    change: string | null;
    icon: any;
    formatter?: (v: number) => string;
  }) => (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-semibold tracking-tight">
          {formatter(value)}
        </div>
        {change !== null && (
          <div className={`text-xs mt-1 flex items-center gap-1 ${
            parseFloat(change) >= 0 ? "text-emerald-500" : "text-red-500"
          }`}>
            {parseFloat(change) >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {parseFloat(change) >= 0 ? "+" : ""}{change}% últimos 7 dias
          </div>
        )}
      </CardContent>
    </Card>
  );

  const isStartOfMonth = new Date().getDate() <= 5;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Monthly reminder alert */}
      {isStartOfMonth && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-sm text-amber-200">
            Novo mês! Lembre-se de atualizar os CSVs de métricas do Instagram e Twitter.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="Analytics"
          subtitle={`${channels[selectedChannel as keyof typeof channels]?.title || "Análise"} · ${client.name}`}
          onBack={() => setSearchParams({})}
          badge={<Badge variant="outline" className="ml-2 text-xs">Beta</Badge>}
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
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {!metricsLoading && periodMetrics && selectedChannel === "instagram" && (
        <>
          {/* Instagram KPI Cards - Period Based */}
          <div className="grid gap-4 md:grid-cols-4">
            <KPICard
              title={`Visualizações (${periodMetrics.daysInPeriod} dias)`}
              value={periodMetrics.totalViews}
              change={null}
              icon={Eye}
            />
            <KPICard
              title={`Alcance (${periodMetrics.daysInPeriod} dias)`}
              value={periodMetrics.totalReach}
              change={null}
              icon={Megaphone}
            />
            <KPICard
              title="Seguidores atuais"
              value={periodMetrics.currentFollowers}
              change={null}
              icon={Users}
            />
            <KPICard
              title={`Ganho no período`}
              value={periodMetrics.totalFollowerGain}
              change={null}
              icon={TrendingUp}
              formatter={(v) => (v >= 0 ? `+${v.toLocaleString("pt-BR")}` : v.toLocaleString("pt-BR"))}
            />
          </div>

          {/* Historical Chart */}
          {metrics && metrics.length >= 1 && (
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{chartConfig[chartMetric].label}</CardTitle>
                    <CardDescription className="text-xs">
                      {chartData.length > 0 && `${chartData[0]?.date} - ${chartData[chartData.length - 1]?.date}`}
                    </CardDescription>
                  </div>
                  <ToggleGroup 
                    type="single" 
                    value={chartMetric} 
                    onValueChange={(v) => v && setChartMetric(v as typeof chartMetric)}
                    className="bg-muted/50 p-1 rounded-lg"
                  >
                    <ToggleGroupItem value="views" className="text-xs px-3 h-7 data-[state=on]:bg-background">
                      Views
                    </ToggleGroupItem>
                    <ToggleGroupItem value="reach" className="text-xs px-3 h-7 data-[state=on]:bg-background">
                      Alcance
                    </ToggleGroupItem>
                    <ToggleGroupItem value="followers" className="text-xs px-3 h-7 data-[state=on]:bg-background">
                      Seguidores
                    </ToggleGroupItem>
                    <ToggleGroupItem value="dailyGain" className="text-xs px-3 h-7 data-[state=on]:bg-background">
                      Ganho Diário
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    [chartConfig[chartMetric].dataKey]: { 
                      label: chartConfig[chartMetric].label, 
                      color: chartConfig[chartMetric].color 
                    },
                  }}
                  className="h-[280px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        className="text-xs"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        className="text-xs" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => {
                          return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value;
                        }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [
                          value.toLocaleString('pt-BR'),
                          chartConfig[chartMetric].label
                        ]}
                      />
                      <Line
                        type="natural"
                        dataKey={chartConfig[chartMetric].dataKey}
                        stroke={chartConfig[chartMetric].color}
                        strokeWidth={2}
                        dot={chartData.length > 30 ? false : { r: 3, fill: chartConfig[chartMetric].color }}
                        activeDot={{ r: 5, stroke: chartConfig[chartMetric].color, strokeWidth: 2, fill: 'hsl(var(--background))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Recent Posts */}
          {metrics?.[0]?.metadata && (metrics[0].metadata as any)?.recent_posts?.length > 0 && (
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">Posts Recentes</CardTitle>
                <CardDescription>Performance individual de cada post</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Post</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Views</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Curtidas</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Comentários</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(metrics[0].metadata as any).recent_posts.map((post: any, index: number) => (
                        <tr key={post.id || index} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {post.type === "Video" ? "Reels" : post.type}
                              </Badge>
                              <span className="text-sm truncate max-w-[200px]">
                                {post.caption || "Sem legenda"}
                              </span>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4 tabular-nums text-sm">{(post.views || 0).toLocaleString('pt-BR')}</td>
                          <td className="text-right py-3 px-4 tabular-nums text-sm">{(post.likes || 0).toLocaleString('pt-BR')}</td>
                          <td className="text-right py-3 px-4 tabular-nums text-sm">{(post.comments || 0).toLocaleString('pt-BR')}</td>
                          <td className="text-right py-3 px-4 text-sm text-muted-foreground">
                            {post.timestamp ? new Date(post.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Twitter metrics */}
      {!metricsLoading && metrics && metrics.length > 0 && selectedChannel === "twitter" && (
        <>
          {/* Twitter KPI Cards - Period Based */}
          <div className="grid gap-4 md:grid-cols-4">
            <KPICard
              title={`Impressões (${periodMetrics?.daysInPeriod || 0} dias)`}
              value={metrics.slice(0, parseInt(dateRange) || 30).reduce((sum, m) => sum + ((m.metadata as any)?.impressions || 0), 0)}
              change={null}
              icon={Eye}
            />
            <KPICard
              title={`Engajamentos (${periodMetrics?.daysInPeriod || 0} dias)`}
              value={metrics.slice(0, parseInt(dateRange) || 30).reduce((sum, m) => sum + ((m.metadata as any)?.engagements || 0), 0)}
              change={null}
              icon={MousePointer}
            />
            <KPICard
              title="Seguidores atuais"
              value={metrics[0]?.subscribers || 0}
              change={null}
              icon={Users}
            />
            <KPICard
              title={`Novos seguidores`}
              value={metrics.slice(0, parseInt(dateRange) || 30).reduce((sum, m) => sum + ((m.metadata as any)?.new_follows || 0), 0)}
              change={null}
              icon={UserPlus}
              formatter={(v) => `+${v.toLocaleString("pt-BR")}`}
            />
          </div>

          {/* Twitter Historical Chart */}
          {chartData.length >= 1 && (
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{chartConfig[chartMetric]?.label || "Métrica"}</CardTitle>
                    <CardDescription className="text-xs">
                      {chartData.length > 0 && `${chartData[0]?.date} - ${chartData[chartData.length - 1]?.date}`}
                    </CardDescription>
                  </div>
                  <ToggleGroup 
                    type="single" 
                    value={chartMetric} 
                    onValueChange={(v) => v && setChartMetric(v as typeof chartMetric)}
                    className="bg-muted/50 p-1 rounded-lg"
                  >
                    <ToggleGroupItem value="impressions" className="text-xs px-3 h-7 data-[state=on]:bg-background">
                      Impressões
                    </ToggleGroupItem>
                    <ToggleGroupItem value="engagements" className="text-xs px-3 h-7 data-[state=on]:bg-background">
                      Engajamentos
                    </ToggleGroupItem>
                    <ToggleGroupItem value="likes" className="text-xs px-3 h-7 data-[state=on]:bg-background">
                      Curtidas
                    </ToggleGroupItem>
                    <ToggleGroupItem value="followers" className="text-xs px-3 h-7 data-[state=on]:bg-background">
                      Seguidores
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    [chartConfig[chartMetric]?.dataKey || 'impressions']: { 
                      label: chartConfig[chartMetric]?.label || 'Impressões', 
                      color: chartConfig[chartMetric]?.color || 'hsl(199, 89%, 48%)' 
                    },
                  }}
                  className="h-[280px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        className="text-xs"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        className="text-xs" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => {
                          return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value;
                        }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [
                          value.toLocaleString('pt-BR'),
                          chartConfig[chartMetric]?.label || 'Valor'
                        ]}
                      />
                      <Line
                        type="natural"
                        dataKey={chartConfig[chartMetric]?.dataKey || 'impressions'}
                        stroke={chartConfig[chartMetric]?.color || 'hsl(199, 89%, 48%)'}
                        strokeWidth={2}
                        dot={chartData.length > 30 ? false : { r: 3, fill: chartConfig[chartMetric]?.color || 'hsl(199, 89%, 48%)' }}
                        activeDot={{ r: 5, stroke: chartConfig[chartMetric]?.color || 'hsl(199, 89%, 48%)', strokeWidth: 2, fill: 'hsl(var(--background))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Newsletter metrics (existing) */}
      {!metricsLoading && metrics && metrics.length > 0 && selectedChannel === "newsletter" && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Inscritos"
              value={metrics[0]?.subscribers || 0}
              change={null}
              icon={Users}
            />
            <KPICard
              title="Taxa de Abertura"
              value={metrics[0]?.open_rate || 0}
              change={null}
              icon={Eye}
              formatter={(v) => `${v}%`}
            />
            <KPICard
              title="Taxa de Cliques"
              value={metrics[0]?.click_rate || 0}
              change={null}
              icon={TrendingUp}
              formatter={(v) => `${v}%`}
            />
            <KPICard
              title="Emails Enviados"
              value={metrics[0]?.total_posts || 0}
              change={null}
              icon={Newspaper}
            />
          </div>

          {/* Recent Emails Table */}
          {metrics?.[0]?.metadata && (metrics[0].metadata as any)?.recent_posts?.length > 0 && (
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">Últimos Emails Enviados</CardTitle>
                <CardDescription>Performance individual de cada email</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Título</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Enviados</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Aberturas</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Taxa</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Cliques</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Taxa</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(metrics[0].metadata as any).recent_posts.map((post: any, index: number) => (
                        <tr key={post.id || index} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium text-sm">{post.title}</div>
                          </td>
                          <td className="text-right py-3 px-4 tabular-nums text-sm">{post.delivered?.toLocaleString('pt-BR') || '-'}</td>
                          <td className="text-right py-3 px-4 tabular-nums text-sm">{post.opened?.toLocaleString('pt-BR') || '-'}</td>
                          <td className="text-right py-3 px-4 tabular-nums text-sm font-medium text-emerald-500">{post.open_rate}%</td>
                          <td className="text-right py-3 px-4 tabular-nums text-sm">{post.clicked?.toLocaleString('pt-BR') || '-'}</td>
                          <td className="text-right py-3 px-4 tabular-nums text-sm font-medium text-primary">{post.click_rate}%</td>
                          <td className="text-right py-3 px-4 text-sm text-muted-foreground">
                            {post.published_at ? new Date(post.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!metricsLoading && (!metrics || metrics.length === 0) && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhum dado disponível ainda. Clique em "Atualizar" para coletar os dados.
            </p>
            <Button onClick={handleRefreshMetrics} disabled={isRefreshing}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Coletar Dados
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
