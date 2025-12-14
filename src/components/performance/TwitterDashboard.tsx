import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Eye, Heart, Users, TrendingUp, MessageCircle, Bookmark, Share2, Upload, BarChart3 } from "lucide-react";
import { StatCard } from "./StatCard";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
import { GoalsPanel } from "./GoalsPanel";
import { TwitterConnectionCard } from "./TwitterConnectionCard";
import { TwitterCSVUpload } from "./TwitterCSVUpload";
import { subDays, format, parseISO, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TwitterMetric {
  id: string;
  metric_date: string;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  subscribers?: number | null;
  engagement_rate?: number | null;
  metadata?: {
    bookmarks?: number;
    replies?: number;
    retweets?: number;
    link_clicks?: number;
    profile_visits?: number;
  } | null;
}

interface TwitterDashboardProps {
  clientId: string;
  metrics: TwitterMetric[];
  isLoading?: boolean;
}

export function TwitterDashboard({ clientId, metrics, isLoading }: TwitterDashboardProps) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("impressions");

  const cutoffDate = useMemo(() => subDays(new Date(), period), [period]);
  const previousPeriodCutoff = useMemo(() => subDays(cutoffDate, period), [cutoffDate, period]);

  const filteredMetrics = useMemo(() => 
    metrics.filter(m => isAfter(parseISO(m.metric_date), cutoffDate))
      .sort((a, b) => a.metric_date.localeCompare(b.metric_date)),
    [metrics, cutoffDate]
  );

  const previousPeriodMetrics = useMemo(() =>
    metrics.filter(m => {
      const date = parseISO(m.metric_date);
      return isAfter(date, previousPeriodCutoff) && !isAfter(date, cutoffDate);
    }),
    [metrics, previousPeriodCutoff, cutoffDate]
  );

  const kpis = useMemo(() => {
    const currentImpressions = filteredMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    const currentLikes = filteredMetrics.reduce((sum, m) => sum + (m.likes || 0), 0);
    const currentFollowers = filteredMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0);
    const currentBookmarks = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.bookmarks || 0), 0);
    const currentRetweets = filteredMetrics.reduce((sum, m) => sum + (m.shares || 0), 0);
    const currentReplies = filteredMetrics.reduce((sum, m) => sum + (m.comments || 0), 0);
    const currentProfileVisits = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.profile_visits || 0), 0);

    const prevImpressions = previousPeriodMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    const prevLikes = previousPeriodMetrics.reduce((sum, m) => sum + (m.likes || 0), 0);
    const prevFollowers = previousPeriodMetrics.reduce((sum, m) => sum + (m.subscribers || 0), 0);
    const prevRetweets = previousPeriodMetrics.reduce((sum, m) => sum + (m.shares || 0), 0);

    const calcTrend = (current: number, prev: number) => prev > 0 ? ((current - prev) / prev) * 100 : 0;

    return {
      impressions: currentImpressions,
      impressionsTrend: calcTrend(currentImpressions, prevImpressions),
      likes: currentLikes,
      likesTrend: calcTrend(currentLikes, prevLikes),
      followers: currentFollowers,
      followersTrend: calcTrend(currentFollowers, prevFollowers),
      bookmarks: currentBookmarks,
      retweets: currentRetweets,
      retweetsTrend: calcTrend(currentRetweets, prevRetweets),
      replies: currentReplies,
      profileVisits: currentProfileVisits,
      avgEngagement: currentImpressions > 0 
        ? ((currentLikes + currentRetweets + currentReplies + currentBookmarks) / currentImpressions) * 100 
        : 0,
    };
  }, [filteredMetrics, previousPeriodMetrics]);

  const chartData = useMemo(() => {
    return filteredMetrics.map(m => ({
      date: format(parseISO(m.metric_date), "dd/MM", { locale: ptBR }),
      fullDate: m.metric_date,
      impressions: m.views || 0,
      likes: m.likes || 0,
      followers: m.subscribers || 0,
      retweets: m.shares || 0,
      replies: m.comments || 0,
      bookmarks: m.metadata?.bookmarks || 0,
    }));
  }, [filteredMetrics]);

  const chartMetrics = [
    { key: "impressions", label: "Impressões", dataKey: "impressions", color: "hsl(var(--primary))" },
    { key: "likes", label: "Curtidas", dataKey: "likes", color: "hsl(var(--chart-2))" },
    { key: "followers", label: "Seguidores", dataKey: "followers", color: "hsl(var(--chart-3))" },
    { key: "retweets", label: "Retweets", dataKey: "retweets", color: "hsl(var(--chart-4))" },
    { key: "replies", label: "Respostas", dataKey: "replies", color: "hsl(var(--chart-5))" },
  ];

  const currentMetrics = {
    followers: kpis.followers,
    views: kpis.impressions,
    engagement: kpis.avgEngagement,
  };

  const hasData = metrics.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <TwitterConnectionCard clientId={clientId} />
          <TwitterCSVUpload clientId={clientId} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">X / Twitter</h3>
          <p className="text-xs text-muted-foreground">
            {metrics.length} dias de dados • {filteredMetrics.length} no período
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted/50 rounded-lg p-0.5">
            {[7, 30, 90].map((p) => (
              <Button
                key={p}
                variant={period === p ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setPeriod(p as 7 | 30 | 90)}
              >
                {p}d
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => setShowUpload(!showUpload)}
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Importar</span>
          </Button>
        </div>
      </div>

      {/* Upload Section */}
      <Collapsible open={showUpload} onOpenChange={setShowUpload}>
        <CollapsibleContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <TwitterConnectionCard clientId={clientId} />
            <TwitterCSVUpload clientId={clientId} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Impressões"
          value={kpis.impressions}
          change={kpis.impressionsTrend}
          icon={Eye}
        />
        <StatCard
          label="Curtidas"
          value={kpis.likes}
          change={kpis.likesTrend}
          icon={Heart}
        />
        <StatCard
          label="Novos Seguidores"
          value={kpis.followers}
          change={kpis.followersTrend}
          icon={Users}
        />
        <StatCard
          label="Engajamento"
          value={`${kpis.avgEngagement.toFixed(2)}%`}
          icon={TrendingUp}
        />
      </div>

      {/* Chart + Goals */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EnhancedAreaChart
            data={chartData}
            metrics={chartMetrics}
            selectedMetric={selectedMetric}
            onMetricChange={setSelectedMetric}
            title="Evolução de Métricas"
          />
        </div>
        <GoalsPanel 
          clientId={clientId} 
          platform="twitter"
          currentMetrics={currentMetrics}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Share2 className="h-3.5 w-3.5" />
            <span className="text-xs">Retweets</span>
          </div>
          <p className="text-lg font-semibold">{kpis.retweets.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="text-xs">Respostas</span>
          </div>
          <p className="text-lg font-semibold">{kpis.replies.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Bookmark className="h-3.5 w-3.5" />
            <span className="text-xs">Salvos</span>
          </div>
          <p className="text-lg font-semibold">{kpis.bookmarks.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="text-xs">Visitas Perfil</span>
          </div>
          <p className="text-lg font-semibold">{kpis.profileVisits.toLocaleString()}</p>
        </Card>
      </div>
    </div>
  );
}