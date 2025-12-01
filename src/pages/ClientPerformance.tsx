import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Users, Mail, BarChart3, Instagram, Youtube, Newspaper, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useState } from "react";
import { usePerformanceMetrics, useFetchBeehiivMetrics, useScrapeMetrics } from "@/hooks/usePerformanceMetrics";
import { useToast } from "@/components/ui/use-toast";

export default function ClientPerformance() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedChannel = searchParams.get("channel");
  const { toast } = useToast();

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
    selectedChannel || ""
  );

  const fetchBeehiiv = useFetchBeehiivMetrics();
  const scrapeMetrics = useScrapeMetrics();

  const handleRefreshMetrics = async () => {
    if (!clientId || !selectedChannel) return;

    try {
      if (selectedChannel === "newsletter") {
        await fetchBeehiiv.mutateAsync(clientId);
        toast({
          title: "Métricas atualizadas",
          description: "Dados da newsletter foram sincronizados com sucesso.",
        });
      } else {
        const urls: Record<string, string> = {
          instagram: "https://www.instagram.com/defiverso",
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
  const isRefreshing = fetchBeehiiv.isPending || scrapeMetrics.isPending;

  // Canais disponíveis por cliente
  const channels = {
    newsletter: {
      icon: Newspaper,
      title: "Newsletter",
      description: "Análise de emails e engajamento da newsletter",
      color: "primary",
    },
    instagram: {
      icon: Instagram,
      title: "Instagram",
      description: "Métricas de posts, stories e engajamento",
      color: "secondary",
    },
    cortes: {
      icon: Youtube,
      title: "Cortes (YouTube/TikTok)",
      description: "Performance de vídeos curtos e viral content",
      color: "accent",
    },
  };

  // Dados mockados baseados nas informações reais do Defiverso
  const defiversoData = {
    subscribers: 2847,
    openRate: 68.5,
    clickRate: 12.3,
    growthRate: 8.2,
    weeklyGrowth: [
      { week: "Sem 1", subscribers: 2650, opens: 67.2 },
      { week: "Sem 2", subscribers: 2720, opens: 68.1 },
      { week: "Sem 3", subscribers: 2780, opens: 67.8 },
      { week: "Sem 4", subscribers: 2847, opens: 68.5 },
    ],
    monthlyEngagement: [
      { month: "Ago", engagement: 65 },
      { month: "Set", engagement: 70 },
      { month: "Out", engagement: 68 },
      { month: "Nov", engagement: 75 },
    ],
    topTopics: [
      { topic: "Airdrops & Farms", engagement: 82 },
      { topic: "DeFi Protocols", engagement: 78 },
      { topic: "Market Analysis", engagement: 71 },
      { topic: "NFT Insights", engagement: 65 },
    ],
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Cliente não encontrado</p>
      </div>
    );
  }

  // Se não tem canal selecionado, mostra a seleção de canais
  if (!selectedChannel) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/performance")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <p className="text-sm text-muted-foreground">Escolha um canal para análise</p>
          </div>
        </div>

        {/* Channel Selection */}
        <div className="grid gap-6 md:grid-cols-3">
          {Object.entries(channels).map(([key, channel]) => {
            const Icon = channel.icon;
            return (
              <Card
                key={key}
                className="border-border/50 bg-card/50 hover:border-border transition-all cursor-pointer"
                onClick={() => setSearchParams({ channel: key })}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-foreground" />
                    <CardTitle className="text-base">
                      {channel.title}
                    </CardTitle>
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchParams({})}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <p className="text-sm text-muted-foreground">
              {channels[selectedChannel as keyof typeof channels]?.title || "Análise de Performance"}
            </p>
          </div>
        </div>
        <Button
          onClick={handleRefreshMetrics}
          disabled={isRefreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Atualizando...' : 'Atualizar Métricas'}
        </Button>
      </div>

      {metricsLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {!metricsLoading && latestMetrics && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {selectedChannel === 'newsletter' ? 'Inscritos' : 'Seguidores'}
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(latestMetrics.subscribers || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total acumulado
                </p>
              </CardContent>
            </Card>

            {selectedChannel === 'newsletter' && (
              <>
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Taxa de Abertura</CardTitle>
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{latestMetrics.open_rate || 0}%</div>
                    <p className="text-xs text-muted-foreground">
                      Média do período
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Taxa de Cliques</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{latestMetrics.click_rate || 0}%</div>
                    <p className="text-xs text-muted-foreground">
                      Engajamento ativo
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            <Card className="border-border/50 bg-card/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {selectedChannel === 'newsletter' ? 'Emails Enviados' : 'Posts'}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latestMetrics.total_posts || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Total publicado
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Historical Chart */}
          {metrics && metrics.length > 1 && (
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>Evolução Histórica</CardTitle>
                <CardDescription>Crescimento ao longo do tempo</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    subscribers: {
                      label: selectedChannel === 'newsletter' ? "Inscritos" : "Seguidores",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.slice(0, 30).reverse()}>
                      <defs>
                        <linearGradient id="colorSubs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis 
                        dataKey="metric_date" 
                        className="text-xs"
                        tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      />
                      <YAxis className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="subscribers"
                        stroke="hsl(var(--primary))"
                        fillOpacity={1}
                        fill="url(#colorSubs)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Recent Posts Table */}
          {selectedChannel === 'newsletter' && latestMetrics?.metadata?.recent_posts && latestMetrics.metadata.recent_posts.length > 0 && (
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle>Últimos Emails Enviados</CardTitle>
                <CardDescription>Performance individual de cada email</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-semibold">Título</th>
                        <th className="text-right py-3 px-4 font-semibold">Enviados</th>
                        <th className="text-right py-3 px-4 font-semibold">Aberturas</th>
                        <th className="text-right py-3 px-4 font-semibold">Taxa Abertura</th>
                        <th className="text-right py-3 px-4 font-semibold">Cliques</th>
                        <th className="text-right py-3 px-4 font-semibold">Taxa Clique</th>
                        <th className="text-right py-3 px-4 font-semibold">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestMetrics.metadata.recent_posts.map((post: any, index: number) => (
                        <tr key={post.id || index} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium">{post.title}</div>
                            {post.subtitle && (
                              <div className="text-sm text-muted-foreground mt-1 line-clamp-1">{post.subtitle}</div>
                            )}
                          </td>
                          <td className="text-right py-3 px-4 tabular-nums">{post.delivered?.toLocaleString('pt-BR') || '-'}</td>
                          <td className="text-right py-3 px-4 tabular-nums">{post.opened?.toLocaleString('pt-BR') || '-'}</td>
                          <td className="text-right py-3 px-4 tabular-nums font-semibold text-primary">{post.open_rate}%</td>
                          <td className="text-right py-3 px-4 tabular-nums">{post.clicked?.toLocaleString('pt-BR') || '-'}</td>
                          <td className="text-right py-3 px-4 tabular-nums font-semibold text-secondary">{post.click_rate}%</td>
                          <td className="text-right py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
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
              Nenhum dado disponível ainda. Clique em "Atualizar Métricas" para coletar os dados.
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
