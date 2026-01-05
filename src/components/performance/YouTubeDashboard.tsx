import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Eye, Clock, Users, TrendingUp, MousePointer, Upload, ThumbsUp, MessageCircle, ChevronDown, Calendar, FileText } from "lucide-react";
import { StatCard } from "./StatCard";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
import { GoalsPanel } from "./GoalsPanel";

import { SmartCSVUpload } from "./SmartCSVUpload";
import { YouTubeVideosTable } from "./YouTubeVideosTable";
import { ImportHistoryPanel } from "./ImportHistoryPanel";
import { DataCompletenessWarning } from "./DataCompletenessWarning";
import { MetricMiniCard } from "./MetricMiniCard";
import { PerformanceReportGenerator } from "./PerformanceReportGenerator";
import { subDays, format, parseISO, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  published_at?: string | null;
  thumbnail_url?: string | null;
  total_views?: number | null;
  watch_hours?: number | null;
  subscribers_gained?: number | null;
  impressions?: number | null;
  click_rate?: number | null;
  likes?: number | null;
  comments?: number | null;
  duration_seconds?: number | null;
}

interface YouTubeDashboardProps {
  clientId: string;
  videos: YouTubeVideo[];
  isLoading?: boolean;
}

const periodOptions = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo período" },
];

export function YouTubeDashboard({ clientId, videos, isLoading }: YouTubeDashboardProps) {
  const [period, setPeriod] = useState("30");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("views");
  const [showReportGenerator, setShowReportGenerator] = useState(false);

  const cutoffDate = useMemo(() => {
    if (period === "all") return null;
    return startOfDay(subDays(new Date(), parseInt(period)));
  }, [period]);

  const previousPeriodCutoff = useMemo(() => {
    if (period === "all") return null;
    const days = parseInt(period);
    return startOfDay(subDays(new Date(), days * 2));
  }, [period]);

  const filteredVideos = useMemo(() => {
    if (!cutoffDate) return videos;
    return videos.filter(v => v.published_at && isAfter(parseISO(v.published_at), cutoffDate))
      .sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
  }, [videos, cutoffDate]);

  const previousPeriodVideos = useMemo(() => {
    if (!previousPeriodCutoff || !cutoffDate) return [];
    return videos.filter(v => {
      if (!v.published_at) return false;
      const date = parseISO(v.published_at);
      return isAfter(date, previousPeriodCutoff) && !isAfter(date, cutoffDate);
    });
  }, [videos, previousPeriodCutoff, cutoffDate]);

  const kpis = useMemo(() => {
    const currentViews = filteredVideos.reduce((sum, v) => sum + (v.total_views || 0), 0);
    const currentWatchHours = filteredVideos.reduce((sum, v) => sum + (v.watch_hours || 0), 0);
    const currentSubs = filteredVideos.reduce((sum, v) => sum + (v.subscribers_gained || 0), 0);
    const currentLikes = filteredVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
    const currentComments = filteredVideos.reduce((sum, v) => sum + (v.comments || 0), 0);
    const avgCTR = filteredVideos.length > 0
      ? filteredVideos.reduce((sum, v) => sum + (v.click_rate || 0), 0) / filteredVideos.length
      : 0;

    const prevViews = previousPeriodVideos.reduce((sum, v) => sum + (v.total_views || 0), 0);
    const prevWatchHours = previousPeriodVideos.reduce((sum, v) => sum + (v.watch_hours || 0), 0);
    const prevSubs = previousPeriodVideos.reduce((sum, v) => sum + (v.subscribers_gained || 0), 0);
    const prevLikes = previousPeriodVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
    const prevComments = previousPeriodVideos.reduce((sum, v) => sum + (v.comments || 0), 0);

    const calcTrend = (current: number, prev: number) => prev > 0 ? ((current - prev) / prev) * 100 : 0;

    return {
      views: videos.reduce((sum, v) => sum + (v.total_views || 0), 0),
      viewsPeriod: currentViews,
      viewsTrend: calcTrend(currentViews, prevViews),
      watchHours: videos.reduce((sum, v) => sum + (v.watch_hours || 0), 0),
      watchHoursPeriod: currentWatchHours,
      watchHoursTrend: calcTrend(currentWatchHours, prevWatchHours),
      subscribers: videos.reduce((sum, v) => sum + (v.subscribers_gained || 0), 0),
      subscribersPeriod: currentSubs,
      subscribersTrend: calcTrend(currentSubs, prevSubs),
      likes: currentLikes,
      likesTrend: calcTrend(currentLikes, prevLikes),
      comments: currentComments,
      commentsTrend: calcTrend(currentComments, prevComments),
      avgCTR,
      videosCount: filteredVideos.length,
    };
  }, [videos, filteredVideos, previousPeriodVideos]);

  // Sparkline data
  const sparklineData = useMemo(() => {
    const recentVideos = filteredVideos.slice(0, 14).reverse();
    return {
      views: recentVideos.map(v => v.total_views || 0),
      watchHours: recentVideos.map(v => v.watch_hours || 0),
      subscribers: recentVideos.map(v => v.subscribers_gained || 0),
      likes: recentVideos.map(v => v.likes || 0),
      comments: recentVideos.map(v => v.comments || 0),
    };
  }, [filteredVideos]);

  // Group videos by date for chart
  const chartData = useMemo(() => {
    const byDate = new Map<string, { views: number; watchHours: number; subscribers: number; likes: number }>();
    
    filteredVideos.forEach(v => {
      if (!v.published_at) return;
      const date = v.published_at.split("T")[0];
      const existing = byDate.get(date) || { views: 0, watchHours: 0, subscribers: 0, likes: 0 };
      byDate.set(date, {
        views: existing.views + (v.total_views || 0),
        watchHours: existing.watchHours + (v.watch_hours || 0),
        subscribers: existing.subscribers + (v.subscribers_gained || 0),
        likes: existing.likes + (v.likes || 0),
      });
    });

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date: format(parseISO(date), "dd/MM", { locale: ptBR }),
        fullDate: date,
        views: data.views,
        watchHours: data.watchHours,
        subscribers: data.subscribers,
        likes: data.likes,
      }));
  }, [filteredVideos]);

  const chartMetrics = [
    { key: "views", label: "Views", dataKey: "views", color: "hsl(0, 80%, 55%)" },
    { key: "watchHours", label: "Watch Hours", dataKey: "watchHours", color: "hsl(200, 80%, 55%)" },
    { key: "subscribers", label: "Inscritos", dataKey: "subscribers", color: "hsl(145, 80%, 45%)" },
    { key: "likes", label: "Likes", dataKey: "likes", color: "hsl(45, 80%, 50%)" },
  ];

  const currentMetrics = {
    views: kpis.viewsPeriod,
    followers: kpis.subscribersPeriod,
  };

  // Data completeness stats
  const dataCompleteness = useMemo(() => ({
    total: videos.length,
    withThumbnails: videos.filter(v => v.thumbnail_url).length,
    withViews: videos.filter(v => v.total_views !== null && v.total_views !== undefined).length,
    withLikes: videos.filter(v => v.likes !== null && v.likes !== undefined).length,
  }), [videos]);

  const hasData = videos.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">YouTube Analytics</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Importe seus dados para começar
            </p>
          </div>
        </div>
        <SmartCSVUpload clientId={clientId} platform="youtube" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">YouTube Analytics</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {videos.length} vídeos • {filteredVideos.length} no período
            </p>
          </div>
          <DataCompletenessWarning platform="youtube" data={dataCompleteness} />
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px] bg-card border-border/50">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
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
          <Button 
            variant="outline" 
            className="border-border/50"
            onClick={() => setShowReportGenerator(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Relatório IA
          </Button>
          <Collapsible open={showUpload} onOpenChange={setShowUpload}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="border-border/50">
                <Upload className="h-4 w-4 mr-2" />
                Importar
                <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showUpload ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>

      {/* Report Generator Modal */}
      <PerformanceReportGenerator
        clientId={clientId}
        platform="YouTube"
        period={periodOptions.find(p => p.value === period)?.label || period}
        kpis={kpis}
        videos={filteredVideos}
        open={showReportGenerator}
        onOpenChange={setShowReportGenerator}
      />

      {/* CSV Upload */}
      <Collapsible open={showUpload} onOpenChange={setShowUpload}>
        <CollapsibleContent className="pt-2">
          <SmartCSVUpload clientId={clientId} platform="youtube" />
        </CollapsibleContent>
      </Collapsible>

      {/* Primary KPIs - 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={Eye}
          label="Visualizações"
          value={kpis.viewsPeriod}
          change={period !== "all" ? kpis.viewsTrend : undefined}
          sparklineData={sparklineData.views}
          color="rose"
          highlight
        />
        <StatCard
          icon={Clock}
          label="Horas Assistidas"
          value={kpis.watchHoursPeriod.toLocaleString()}
          change={period !== "all" ? kpis.watchHoursTrend : undefined}
          sparklineData={sparklineData.watchHours}
          color="blue"
        />
        <StatCard
          icon={Users}
          label="Inscritos Ganhos"
          value={kpis.subscribersPeriod}
          change={period !== "all" ? kpis.subscribersTrend : undefined}
          sparklineData={sparklineData.subscribers}
          color="emerald"
        />
        <StatCard
          icon={ThumbsUp}
          label="Curtidas"
          value={kpis.likes}
          change={period !== "all" ? kpis.likesTrend : undefined}
          sparklineData={sparklineData.likes}
          color="amber"
        />
        <StatCard
          icon={MessageCircle}
          label="Comentários"
          value={kpis.comments}
          change={period !== "all" ? kpis.commentsTrend : undefined}
          sparklineData={sparklineData.comments}
          color="violet"
        />
        <StatCard
          icon={MousePointer}
          label="CTR Médio"
          value={`${kpis.avgCTR.toFixed(1)}%`}
          color="blue"
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
            title="Performance por Data de Publicação"
          />
        </div>
        <GoalsPanel 
          clientId={clientId} 
          platform="youtube"
          currentMetrics={currentMetrics}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricMiniCard
          icon={Eye}
          label="Views Total"
          value={kpis.views}
          sparklineData={sparklineData.views}
          color="rose"
        />
        <MetricMiniCard
          icon={Clock}
          label="Horas Total"
          value={kpis.watchHours}
          sparklineData={sparklineData.watchHours}
          color="blue"
        />
        <MetricMiniCard
          icon={Users}
          label="Inscritos Total"
          value={kpis.subscribers}
          sparklineData={sparklineData.subscribers}
          color="emerald"
        />
        <MetricMiniCard
          icon={TrendingUp}
          label="Vídeos no Período"
          value={kpis.videosCount}
          color="violet"
        />
      </div>

      {/* Videos Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Todos os Vídeos</CardTitle>
        </CardHeader>
        <CardContent>
          <YouTubeVideosTable videos={videos as any} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* Import History */}
      <ImportHistoryPanel clientId={clientId} platform="youtube" />
    </div>
  );
}
