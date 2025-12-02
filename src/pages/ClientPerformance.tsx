import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Eye, Heart, MessageCircle, Share2, Instagram, Youtube, Newspaper, RefreshCw, TrendingUp, TrendingDown, Users, CalendarIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useState, useMemo } from "react";
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
  const [chartMetric, setChartMetric] = useState<"views" | "likes" | "followers" | "dailyGain" | "engagement">("followers");

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

const latestMetrics = metrics?.[0];
  const previousMetrics = metrics?.[1];
  const isRefreshing = fetchBeehiiv.isPending || scrapeMetrics.isPending || fetchInstagram.isPending;

  // Chart data configuration
  const chartConfig = useMemo(() => ({
    views: { label: "Visualizações", color: "hsl(217, 91%, 60%)", dataKey: "views" },
    likes: { label: "Curtidas", color: "hsl(142, 71%, 45%)", dataKey: "likes" },
    followers: { label: "Seguidores", color: "hsl(262, 83%, 58%)", dataKey: "subscribers" },
    dailyGain: { label: "Ganho Diário", color: "hsl(142, 71%, 45%)", dataKey: "daily_gain" },
    engagement: { label: "Engajamento (%)", color: "hsl(38, 92%, 50%)", dataKey: "engagement_rate" },
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
      const dailyGain = metadata?.daily_gain || 0;
      
      let calculatedSubscribers = runningTotal;
      if (index > 0) {
        const prevMetadata = sortedMetrics[index - 1]?.metadata as any;
        const prevDailyGain = prevMetadata?.daily_gain || 0;
        runningTotal -= prevDailyGain;
        calculatedSubscribers = runningTotal;
      }
      
      return {
        ...m,
        subscribers: calculatedSubscribers,
        daily_gain: dailyGain,
        date: new Date(m.metric_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      };
    });
    
    // Reverse to show oldest to newest in chart
    return calculatedData.reverse();
  }, [metrics, dateRange, customDateRange]);

  // Calculate percentage change
  const calculateChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return change.toFixed(0);
  };

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

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
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

      {!metricsLoading && latestMetrics && selectedChannel === "instagram" && (
        <>
          {/* Instagram KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Visualizações agregadas"
              value={latestMetrics.views || 0}
              change={previousMetrics ? calculateChange(latestMetrics.views || 0, previousMetrics.views || 0) : null}
              icon={Eye}
            />
            <KPICard
              title="Curtidas agregadas"
              value={latestMetrics.likes || 0}
              change={previousMetrics ? calculateChange(latestMetrics.likes || 0, previousMetrics.likes || 0) : null}
              icon={Heart}
            />
            <KPICard
              title="Comentários agregados"
              value={latestMetrics.comments || 0}
              change={previousMetrics ? calculateChange(latestMetrics.comments || 0, previousMetrics.comments || 0) : null}
              icon={MessageCircle}
            />
            <KPICard
              title="Compartilhamentos"
              value={latestMetrics.shares || 0}
              change={previousMetrics ? calculateChange(latestMetrics.shares || 0, previousMetrics.shares || 0) : null}
              icon={Share2}
            />
          </div>

          {/* Followers Card */}
          <div className="grid gap-4 md:grid-cols-3">
            <KPICard
              title="Seguidores"
              value={latestMetrics.subscribers || 0}
              change={previousMetrics ? calculateChange(latestMetrics.subscribers || 0, previousMetrics.subscribers || 0) : null}
              icon={Users}
            />
            <KPICard
              title="Taxa de Engajamento"
              value={latestMetrics.engagement_rate || 0}
              change={null}
              icon={TrendingUp}
              formatter={(v) => `${v.toFixed(2)}%`}
            />
            <KPICard
              title="Total de Posts"
              value={latestMetrics.total_posts || 0}
              change={null}
              icon={Instagram}
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
                    <ToggleGroupItem value="followers" className="text-xs px-3 h-7 data-[state=on]:bg-background">
                      Seguidores
                    </ToggleGroupItem>
                    <ToggleGroupItem value="dailyGain" className="text-xs px-3 h-7 data-[state=on]:bg-background">
                      Ganho Diário
                    </ToggleGroupItem>
                    <ToggleGroupItem value="views" className="text-xs px-3 h-7 data-[state=on]:bg-background">
                      Views
                    </ToggleGroupItem>
                    <ToggleGroupItem value="likes" className="text-xs px-3 h-7 data-[state=on]:bg-background">
                      Curtidas
                    </ToggleGroupItem>
                    <ToggleGroupItem value="engagement" className="text-xs px-3 h-7 data-[state=on]:bg-background">
                      Engajamento
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
                          if (chartMetric === 'engagement') return `${value}%`;
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
                          chartMetric === 'engagement' ? `${value.toFixed(2)}%` : value.toLocaleString('pt-BR'),
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
          {latestMetrics?.metadata?.recent_posts && latestMetrics.metadata.recent_posts.length > 0 && (
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
                      {latestMetrics.metadata.recent_posts.map((post: any, index: number) => (
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

      {/* Newsletter metrics (existing) */}
      {!metricsLoading && latestMetrics && selectedChannel === "newsletter" && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Inscritos"
              value={latestMetrics.subscribers || 0}
              change={previousMetrics ? calculateChange(latestMetrics.subscribers || 0, previousMetrics.subscribers || 0) : null}
              icon={Users}
            />
            <KPICard
              title="Taxa de Abertura"
              value={latestMetrics.open_rate || 0}
              change={null}
              icon={Eye}
              formatter={(v) => `${v}%`}
            />
            <KPICard
              title="Taxa de Cliques"
              value={latestMetrics.click_rate || 0}
              change={null}
              icon={TrendingUp}
              formatter={(v) => `${v}%`}
            />
            <KPICard
              title="Emails Enviados"
              value={latestMetrics.total_posts || 0}
              change={null}
              icon={Newspaper}
            />
          </div>

          {/* Recent Emails Table */}
          {latestMetrics?.metadata?.recent_posts && latestMetrics.metadata.recent_posts.length > 0 && (
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
                      {latestMetrics.metadata.recent_posts.map((post: any, index: number) => (
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

      {!metricsLoading && !latestMetrics && (
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
