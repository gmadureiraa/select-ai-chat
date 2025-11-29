import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Users, Mail, BarChart3, Instagram, Youtube, Newspaper } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useState } from "react";

export default function ClientPerformance() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedChannel = searchParams.get("channel");

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
            <h1 className="text-3xl font-bold">{client.name}</h1>
            <p className="text-muted-foreground">Escolha um canal para análise</p>
          </div>
        </div>

        {/* Channel Selection */}
        <div className="grid gap-6 md:grid-cols-3">
          {Object.entries(channels).map(([key, channel]) => {
            const Icon = channel.icon;
            return (
              <Card
                key={key}
                className={`hover:shadow-lg transition-all cursor-pointer border-${channel.color}/20 hover:border-${channel.color}/40 group`}
                onClick={() => setSearchParams({ channel: key })}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg bg-${channel.color}/10 group-hover:bg-${channel.color}/20 transition-colors`}>
                      <Icon className={`h-6 w-6 text-${channel.color}`} />
                    </div>
                    <CardTitle className={`group-hover:text-${channel.color} transition-colors`}>
                      {channel.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{channel.description}</CardDescription>
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
            <h1 className="text-3xl font-bold">{client.name}</h1>
            <p className="text-muted-foreground">
              {channels[selectedChannel as keyof typeof channels]?.title || "Análise de Performance"}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inscritos Totais</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{defiversoData.subscribers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-accent" />
              +{defiversoData.growthRate}% este mês
            </p>
          </CardContent>
        </Card>

        <Card className="border-accent/20 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Abertura</CardTitle>
            <Mail className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{defiversoData.openRate}%</div>
            <p className="text-xs text-muted-foreground">
              Acima da média do setor (21%)
            </p>
          </CardContent>
        </Card>

        <Card className="border-secondary/20 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Cliques</CardTitle>
            <BarChart3 className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{defiversoData.clickRate}%</div>
            <p className="text-xs text-muted-foreground">
              Excelente engajamento
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crescimento Semanal</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+67</div>
            <p className="text-xs text-muted-foreground">
              Novos inscritos esta semana
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Subscriber Growth */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Crescimento de Inscritos</CardTitle>
            <CardDescription>Evolução mensal dos últimos 4 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                subscribers: {
                  label: "Inscritos",
                  color: "hsl(var(--primary))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={defiversoData.weeklyGrowth}>
                  <defs>
                    <linearGradient id="colorSubs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="week" className="text-xs" />
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

        {/* Engagement Rate */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Taxa de Engajamento</CardTitle>
            <CardDescription>Taxa de abertura semanal</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                opens: {
                  label: "Taxa de Abertura",
                  color: "hsl(var(--accent))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={defiversoData.weeklyGrowth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" domain={[60, 75]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="opens"
                    stroke="hsl(var(--accent))"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "hsl(var(--accent))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Topics */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>Tópicos de Maior Engajamento</CardTitle>
          <CardDescription>Baseado em opens e cliques</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {defiversoData.topTopics.map((topic, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{topic.topic}</span>
                    <span className="text-sm text-muted-foreground">{topic.engagement}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                      style={{ width: `${topic.engagement}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
