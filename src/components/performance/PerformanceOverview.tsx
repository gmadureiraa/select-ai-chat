import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sparkles, RefreshCw, TrendingUp, TrendingDown, Users, Heart, Eye, Clock,
  Instagram, Youtube, Twitter, Mail, BarChart3, Target, Award, Zap,
  ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { useInstagramPosts } from "@/hooks/useInstagramPosts";
import { useYouTubeVideos } from "@/hooks/useYouTubeMetrics";
import { usePerformanceGoals } from "@/hooks/usePerformanceGoals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, parseISO, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { motion } from "framer-motion";

interface PerformanceOverviewProps {
  clientId: string;
  clientName: string;
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('pt-BR');
};

export function PerformanceOverview({ clientId, clientName }: PerformanceOverviewProps) {
  const [insights, setInsights] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cachedInsights, setCachedInsights] = useState<string | null>(null);

  const { data: instagramMetrics, isLoading: loadingMetrics } = usePerformanceMetrics(clientId, "instagram", 90);
  const { data: instagramPosts, isLoading: loadingPosts } = useInstagramPosts(clientId, 100);
  const { data: youtubeVideos, isLoading: loadingVideos } = useYouTubeVideos(clientId, 50);
  const { goals } = usePerformanceGoals(clientId);

  // Load cached insights from localStorage
  useEffect(() => {
    const cached = localStorage.getItem(`insights-${clientId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          setCachedInsights(parsed.insights);
        }
      } catch (e) {}
    }
  }, [clientId]);

  // Calculate aggregated stats
  const stats = useMemo(() => {
    const cutoff30 = subDays(new Date(), 30);
    const cutoff7 = subDays(new Date(), 7);

    // Instagram stats
    const posts30 = instagramPosts?.filter(p => p.posted_at && isAfter(parseISO(p.posted_at), cutoff30)) || [];
    const posts7 = instagramPosts?.filter(p => p.posted_at && isAfter(parseISO(p.posted_at), cutoff7)) || [];
    
    const totalLikes = posts30.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = posts30.reduce((sum, p) => sum + (p.comments || 0), 0);
    const totalReach = posts30.reduce((sum, p) => sum + (p.reach || 0), 0);
    const totalImpressions = posts30.reduce((sum, p) => sum + (p.impressions || 0), 0);
    
    const avgEngagement = posts30.length > 0
      ? posts30.filter(p => p.engagement_rate && p.engagement_rate > 0)
          .reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / 
          Math.max(1, posts30.filter(p => p.engagement_rate && p.engagement_rate > 0).length)
      : 0;

    // Followers from metrics
    const followers30 = instagramMetrics?.reduce((sum, m) => sum + (m.subscribers || 0), 0) || 0;
    
    // YouTube stats
    const totalViews = youtubeVideos?.reduce((sum, v) => sum + (v.total_views || 0), 0) || 0;
    const totalWatchHours = youtubeVideos?.reduce((sum, v) => sum + (v.watch_hours || 0), 0) || 0;
    const totalSubs = youtubeVideos?.reduce((sum, v) => sum + (v.subscribers_gained || 0), 0) || 0;

    // Best post
    const bestPost = instagramPosts?.length 
      ? instagramPosts.reduce((best, p) => (p.likes || 0) > (best.likes || 0) ? p : best, instagramPosts[0])
      : null;

    // Best video
    const bestVideo = youtubeVideos?.length
      ? youtubeVideos.reduce((best, v) => (v.total_views || 0) > (best.total_views || 0) ? v : best, youtubeVideos[0])
      : null;

    return {
      instagram: {
        followers: followers30,
        likes: totalLikes,
        comments: totalComments,
        reach: totalReach,
        impressions: totalImpressions,
        avgEngagement,
        postCount: posts30.length,
        bestPost,
      },
      youtube: {
        views: totalViews,
        watchHours: totalWatchHours,
        subscribers: totalSubs,
        videoCount: youtubeVideos?.length || 0,
        bestVideo,
      },
      hasData: (instagramPosts?.length || 0) > 0 || (youtubeVideos?.length || 0) > 0,
    };
  }, [instagramMetrics, instagramPosts, youtubeVideos]);

  // Chart data
  const chartData = useMemo(() => {
    const metricsMap = new Map<string, { views: number; followers: number; likes: number }>();
    
    instagramMetrics?.forEach(m => {
      metricsMap.set(m.metric_date, {
        views: m.views || 0,
        followers: m.subscribers || 0,
        likes: m.likes || 0,
      });
    });

    return Array.from(metricsMap.entries())
      .map(([date, data]) => ({
        date: format(parseISO(date), "dd/MM", { locale: ptBR }),
        ...data,
      }))
      .slice(-30);
  }, [instagramMetrics]);

  const generateInsights = async () => {
    setIsGenerating(true);
    try {
      const context = {
        instagram: stats.instagram,
        youtube: stats.youtube,
        goals: goals.filter(g => g.platform === 'instagram' || g.platform === 'youtube'),
      };

      const { data, error } = await supabase.functions.invoke("generate-performance-insights", {
        body: { clientId, clientName, context },
      });

      if (error) throw error;
      
      setInsights(data.insights);
      setCachedInsights(data.insights);
      
      // Cache insights
      localStorage.setItem(`insights-${clientId}`, JSON.stringify({
        insights: data.insights,
        timestamp: Date.now(),
      }));
      
      toast.success("Insights gerados com sucesso");
    } catch (error) {
      console.error("Error generating insights:", error);
      toast.error("Erro ao gerar insights");
    } finally {
      setIsGenerating(false);
    }
  };

  const isLoading = loadingMetrics || loadingPosts || loadingVideos;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  const displayInsights = insights || cachedInsights;

  const kpiCards = [
    {
      label: "Seguidores Ganhos",
      value: stats.instagram.followers,
      icon: Users,
      color: "emerald",
      platform: "Instagram",
    },
    {
      label: "Alcance Total",
      value: stats.instagram.reach,
      icon: Eye,
      color: "violet",
      platform: "Instagram",
    },
    {
      label: "Curtidas",
      value: stats.instagram.likes,
      icon: Heart,
      color: "rose",
      platform: "Instagram",
    },
    {
      label: "Views YouTube",
      value: stats.youtube.views,
      icon: Youtube,
      color: "red",
      platform: "YouTube",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Visão Geral</h2>
          <p className="text-sm text-muted-foreground">
            Métricas consolidadas dos últimos 30 dias
          </p>
        </div>
        <Button 
          variant="default" 
          onClick={generateInsights}
          disabled={isGenerating || !stats.hasData}
          className="gap-2"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Gerar Análise AI
            </>
          )}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className="border-border/50 bg-card/50 hover:border-border transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {kpi.label}
                      <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
                        {kpi.platform}
                      </Badge>
                    </span>
                    <p className="text-2xl font-bold mt-1">{formatNumber(kpi.value)}</p>
                  </div>
                  <div className={`p-2 rounded-lg bg-${kpi.color}-500/10`}>
                    <kpi.icon className={`h-5 w-5 text-${kpi.color}-500`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2">
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Evolução (30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ChartContainer
                  config={{
                    followers: { label: "Seguidores", color: "hsl(145, 80%, 45%)" },
                    views: { label: "Visualizações", color: "hsl(270, 70%, 55%)" },
                  }}
                  className="h-[280px] w-full"
                >
                  <ResponsiveContainer>
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="overviewGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(145, 80%, 45%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(145, 80%, 45%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-card border border-border rounded-lg shadow-xl p-3">
                              <p className="text-xs text-muted-foreground mb-1">{label}</p>
                              {payload.map((entry: any, i: number) => (
                                <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
                                  {entry.value?.toLocaleString('pt-BR')}
                                </p>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="followers"
                        stroke="hsl(145, 80%, 45%)"
                        strokeWidth={2}
                        fill="url(#overviewGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <EmptyState
                  variant="chart"
                  title="Sem dados ainda"
                  description="Importe métricas para visualizar a evolução"
                  className="h-[280px]"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Goals Progress */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Metas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {goals.length > 0 ? (
              <div className="space-y-4">
                {goals.slice(0, 4).map((goal) => {
                  const progress = Math.min((goal.current_value || 0) / goal.target_value * 100, 100);
                  return (
                    <div key={goal.id} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium capitalize">{goal.metric_name}</span>
                        <span className="text-muted-foreground">
                          {formatNumber(goal.current_value || 0)} / {formatNumber(goal.target_value)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                variant="default"
                title="Nenhuma meta definida"
                description="Defina metas no dashboard de cada rede"
                className="h-[200px] py-6"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Análise Inteligente</CardTitle>
            {displayInsights && (
              <Badge variant="secondary" className="text-xs">Atualizado</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {displayInsights ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {displayInsights}
              </p>
            </div>
          ) : stats.hasData ? (
            <div className="space-y-4">
              {/* Recommendations Section */}
              <div className="grid md:grid-cols-3 gap-4">
                {/* Best Performing Content */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Continue Fazendo</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {stats.instagram.bestPost 
                      ? `Seu melhor conteúdo teve ${formatNumber(stats.instagram.bestPost.likes || 0)} curtidas. Mantenha esse formato!`
                      : "Crie mais conteúdo para descobrir o que funciona melhor."
                    }
                  </p>
                </div>

                {/* Improvement Opportunity */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-amber-500/20">
                      <Target className="h-4 w-4 text-amber-600" />
                    </div>
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Oportunidade</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {stats.instagram.avgEngagement < 3 
                      ? "Taxa de engajamento abaixo de 3%. Tente usar mais CTAs e perguntas."
                      : stats.instagram.postCount < 10 
                        ? "Aumente a frequência de posts para mais visibilidade."
                        : "Explore novos formatos como Reels e Carrosséis."
                    }
                  </p>
                </div>

                {/* Next Step */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-primary/20">
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-primary">Próximo Passo</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Clique em "Gerar Análise AI" para receber recomendações personalizadas detalhadas.
                  </p>
                </div>
              </div>

              {/* Top Performers */}
              <div className="grid md:grid-cols-2 gap-4">
                {stats.instagram.bestPost && (
                  <div className="p-4 rounded-xl bg-card border border-border/50 hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <Award className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium">Top Post Instagram</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {stats.instagram.bestPost.caption || "Sem legenda"}
                    </p>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1.5 text-rose-500">
                        <Heart className="h-3.5 w-3.5" />
                        <span className="font-medium">{formatNumber(stats.instagram.bestPost.likes || 0)}</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-violet-500">
                        <Eye className="h-3.5 w-3.5" />
                        <span className="font-medium">{formatNumber(stats.instagram.bestPost.impressions || 0)}</span>
                      </span>
                    </div>
                  </div>
                )}
                
                {stats.youtube.bestVideo && (
                  <div className="p-4 rounded-xl bg-card border border-border/50 hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <Award className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium">Top Vídeo YouTube</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {stats.youtube.bestVideo.title}
                    </p>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1.5 text-rose-500">
                        <Eye className="h-3.5 w-3.5" />
                        <span className="font-medium">{formatNumber(stats.youtube.bestVideo.total_views || 0)} views</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-violet-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-medium">{formatNumber(stats.youtube.bestVideo.watch_hours || 0)}h</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Period Summary */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Resumo do Período</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Posts</p>
                    <p className="text-xl font-bold">{stats.instagram.postCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Engajamento</p>
                    <p className="text-xl font-bold">{stats.instagram.avgEngagement.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Vídeos</p>
                    <p className="text-xl font-bold">{stats.youtube.videoCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Watch Hours</p>
                    <p className="text-xl font-bold">{formatNumber(stats.youtube.watchHours)}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="mb-2">Nenhum dado disponível</p>
              <p className="text-xs">Importe métricas nas abas das redes sociais para ver análises</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}