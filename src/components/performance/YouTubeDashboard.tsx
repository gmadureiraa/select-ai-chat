import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Eye, Clock, Users, TrendingUp, MousePointer, Upload, ThumbsUp, MessageCircle } from "lucide-react";
import { StatCard } from "./StatCard";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
import { GoalsPanel } from "./GoalsPanel";
import { YouTubeConnectionCard } from "./YouTubeConnectionCard";
import { YouTubeCSVUpload } from "./YouTubeCSVUpload";
import { YouTubeVideosTable } from "./YouTubeVideosTable";
import { subDays, format, parseISO, isAfter } from "date-fns";
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

export function YouTubeDashboard({ clientId, videos, isLoading }: YouTubeDashboardProps) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("views");

  const cutoffDate = useMemo(() => subDays(new Date(), period), [period]);
  const previousPeriodCutoff = useMemo(() => subDays(cutoffDate, period), [cutoffDate, period]);

  const filteredVideos = useMemo(() =>
    videos.filter(v => v.published_at && isAfter(parseISO(v.published_at), cutoffDate))
      .sort((a, b) => (b.published_at || "").localeCompare(a.published_at || "")),
    [videos, cutoffDate]
  );

  const previousPeriodVideos = useMemo(() =>
    videos.filter(v => {
      if (!v.published_at) return false;
      const date = parseISO(v.published_at);
      return isAfter(date, previousPeriodCutoff) && !isAfter(date, cutoffDate);
    }),
    [videos, previousPeriodCutoff, cutoffDate]
  );

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
      comments: currentComments,
      avgCTR,
      videosCount: filteredVideos.length,
    };
  }, [videos, filteredVideos, previousPeriodVideos]);

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
    { key: "views", label: "Views", dataKey: "views", color: "hsl(var(--primary))" },
    { key: "watchHours", label: "Watch Hours", dataKey: "watchHours", color: "hsl(var(--chart-2))" },
    { key: "subscribers", label: "Inscritos", dataKey: "subscribers", color: "hsl(var(--chart-3))" },
    { key: "likes", label: "Likes", dataKey: "likes", color: "hsl(var(--chart-4))" },
  ];

  const currentMetrics = {
    views: kpis.views,
    followers: kpis.subscribers,
  };

  // Transform videos to match expected type
  const videosForTable = videos.map(v => ({
    ...v,
    duration_seconds: v.duration_seconds || 0,
  }));

  const hasData = videos.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <YouTubeConnectionCard clientId={clientId} />
          <YouTubeCSVUpload clientId={clientId} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">YouTube</h3>
          <p className="text-xs text-muted-foreground">
            {videos.length} vídeos • {filteredVideos.length} no período
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
            <YouTubeConnectionCard clientId={clientId} />
            <YouTubeCSVUpload clientId={clientId} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Views"
          value={kpis.views}
          change={kpis.viewsTrend}
          icon={Eye}
        />
        <StatCard
          label="Watch Hours"
          value={kpis.watchHours.toLocaleString()}
          change={kpis.watchHoursTrend}
          icon={Clock}
        />
        <StatCard
          label="Inscritos Ganhos"
          value={kpis.subscribers}
          change={kpis.subscribersTrend}
          icon={Users}
        />
        <StatCard
          label="CTR Médio"
          value={`${kpis.avgCTR.toFixed(1)}%`}
          icon={MousePointer}
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ThumbsUp className="h-3.5 w-3.5" />
            <span className="text-xs">Likes</span>
          </div>
          <p className="text-lg font-semibold">{kpis.likes.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="text-xs">Comentários</span>
          </div>
          <p className="text-lg font-semibold">{kpis.comments.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Eye className="h-3.5 w-3.5" />
            <span className="text-xs">Vídeos no Período</span>
          </div>
          <p className="text-lg font-semibold">{kpis.videosCount}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs">Views/Período</span>
          </div>
          <p className="text-lg font-semibold">{kpis.viewsPeriod.toLocaleString()}</p>
        </Card>
      </div>

      {/* Videos Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base">Todos os Vídeos</CardTitle>
        </CardHeader>
        <CardContent>
          <YouTubeVideosTable videos={videos as any} isLoading={isLoading} />
        </CardContent>
      </Card>
        </CardContent>
      </Card>
    </div>
  );
}