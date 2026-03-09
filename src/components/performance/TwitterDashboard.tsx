import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Eye, 
  MousePointer, 
  Users, 
  TrendingUp, 
  Upload, 
  Heart, 
  Repeat2, 
  MessageCircle, 
  Calendar,
  Twitter,
  Sparkles,
  Trophy,
  ExternalLink
} from "lucide-react";
import { StatCard } from "./StatCard";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
import { MetricMiniCard } from "./MetricMiniCard";
import { TwitterPostsTable } from "./TwitterPostsTable";
import { ImportHistoryPanel } from "./ImportHistoryPanel";
import { DataCompletenessWarning } from "./DataCompletenessWarning";
import { PerformanceReportGenerator } from "./PerformanceReportGenerator";
import { subDays, format, parseISO, isAfter, startOfDay } from "date-fns";
import { TwitterPost } from "@/types/twitter";
import { useImportTwitterCSV, parseTwitterCSV } from "@/hooks/useTwitterMetrics";
import { useImportHistory } from "@/hooks/useImportHistory";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface TwitterDashboardProps {
  clientId: string;
  posts: TwitterPost[];
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

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export function TwitterDashboard({ clientId, posts, isLoading }: TwitterDashboardProps) {
  const [period, setPeriod] = useState("30");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("impressions");
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useImportTwitterCSV();
  const { logImport, imports } = useImportHistory(clientId);
  const { canImportData, canGenerateReports } = useWorkspace();

  // Last import timestamp
  const lastTwitterImport = useMemo(() => {
    const twitterImports = (imports || []).filter(i => i.platform === 'twitter');
    if (twitterImports.length === 0) return null;
    return twitterImports.sort((a, b) => (b.imported_at || "").localeCompare(a.imported_at || ""))[0];
  }, [imports]);

  const cutoffDate = useMemo(() => {
    if (period === "all") return null;
    return startOfDay(subDays(new Date(), parseInt(period)));
  }, [period]);

  const previousPeriodCutoff = useMemo(() => {
    if (period === "all") return null;
    const days = parseInt(period);
    return startOfDay(subDays(new Date(), days * 2));
  }, [period]);

  const filteredPosts = useMemo(() => {
    if (!cutoffDate) return posts;
    return posts.filter(p => p.posted_at && isAfter(parseISO(p.posted_at), cutoffDate))
      .sort((a, b) => (b.posted_at || "").localeCompare(a.posted_at || ""));
  }, [posts, cutoffDate]);

  const previousPeriodPosts = useMemo(() => {
    if (!previousPeriodCutoff || !cutoffDate) return [];
    return posts.filter(p => {
      if (!p.posted_at) return false;
      const date = parseISO(p.posted_at);
      return isAfter(date, previousPeriodCutoff) && !isAfter(date, cutoffDate);
    });
  }, [posts, previousPeriodCutoff, cutoffDate]);

  const kpis = useMemo(() => {
    const currentImpressions = filteredPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);
    const currentEngagements = filteredPosts.reduce((sum, p) => sum + (p.engagements || 0), 0);
    const currentLikes = filteredPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const currentRetweets = filteredPosts.reduce((sum, p) => sum + (p.retweets || 0), 0);
    const currentReplies = filteredPosts.reduce((sum, p) => sum + (p.replies || 0), 0);
    const currentProfileClicks = filteredPosts.reduce((sum, p) => sum + (p.profile_clicks || 0), 0);
    const currentUrlClicks = filteredPosts.reduce((sum, p) => sum + (p.url_clicks || 0), 0);
    
    const avgEngagement = filteredPosts.length > 0
      ? filteredPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / filteredPosts.length
      : 0;

    const prevImpressions = previousPeriodPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);
    const prevEngagements = previousPeriodPosts.reduce((sum, p) => sum + (p.engagements || 0), 0);
    const prevLikes = previousPeriodPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const prevRetweets = previousPeriodPosts.reduce((sum, p) => sum + (p.retweets || 0), 0);
    const prevReplies = previousPeriodPosts.reduce((sum, p) => sum + (p.replies || 0), 0);
    
    const prevAvgEngagement = previousPeriodPosts.length > 0
      ? previousPeriodPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / previousPeriodPosts.length
      : 0;

    const calcTrend = (current: number, prev: number) => prev > 0 ? ((current - prev) / prev) * 100 : 0;

    return {
      impressions: currentImpressions,
      impressionsTrend: calcTrend(currentImpressions, prevImpressions),
      engagements: currentEngagements,
      engagementsTrend: calcTrend(currentEngagements, prevEngagements),
      likes: currentLikes,
      likesTrend: calcTrend(currentLikes, prevLikes),
      retweets: currentRetweets,
      retweetsTrend: calcTrend(currentRetweets, prevRetweets),
      replies: currentReplies,
      repliesTrend: calcTrend(currentReplies, prevReplies),
      profileClicks: currentProfileClicks,
      urlClicks: currentUrlClicks,
      avgEngagement,
      avgEngagementTrend: calcTrend(avgEngagement, prevAvgEngagement),
      tweetsCount: filteredPosts.length,
    };
  }, [filteredPosts, previousPeriodPosts]);

  // Top 3 tweets by engagement
  const topTweets = useMemo(() => {
    return [...filteredPosts]
      .sort((a, b) => (b.engagements || 0) - (a.engagements || 0))
      .slice(0, 3);
  }, [filteredPosts]);

  // Post averages
  const postAverages = useMemo(() => {
    const count = filteredPosts.length;
    if (count === 0) return null;
    const formatAvg = (total: number) => {
      const avg = total / count;
      if (avg >= 1000) return `${(avg / 1000).toFixed(1)}k`;
      return avg.toFixed(avg >= 100 ? 0 : 1);
    };
    return {
      impressions: formatAvg(kpis.impressions),
      engagements: formatAvg(kpis.engagements),
      likes: formatAvg(kpis.likes),
      retweets: formatAvg(kpis.retweets),
      replies: formatAvg(kpis.replies),
    };
  }, [filteredPosts, kpis]);

  // Sparkline data
  const sparklineData = useMemo(() => {
    const last14 = filteredPosts.slice(0, 14).reverse();
    return {
      impressions: last14.map(p => p.impressions || 0),
      engagements: last14.map(p => p.engagements || 0),
      likes: last14.map(p => p.likes || 0),
      retweets: last14.map(p => p.retweets || 0),
      replies: last14.map(p => p.replies || 0),
      engagement: last14.map(p => p.engagement_rate || 0),
    };
  }, [filteredPosts]);

  // Chart data grouped by date
  const chartData = useMemo(() => {
    const dateMap = new Map<string, { 
      impressions: number; 
      engagements: number; 
      likes: number; 
      retweets: number;
      replies: number;
    }>();

    filteredPosts.forEach(post => {
      if (!post.posted_at) return;
      const dateKey = format(parseISO(post.posted_at), 'yyyy-MM-dd');
      const existing = dateMap.get(dateKey) || { impressions: 0, engagements: 0, likes: 0, retweets: 0, replies: 0 };
      dateMap.set(dateKey, {
        impressions: existing.impressions + (post.impressions || 0),
        engagements: existing.engagements + (post.engagements || 0),
        likes: existing.likes + (post.likes || 0),
        retweets: existing.retweets + (post.retweets || 0),
        replies: existing.replies + (post.replies || 0),
      });
    });

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        ...data,
      }));
  }, [filteredPosts]);

  const availableMetrics = [
    { key: 'impressions', dataKey: 'impressions', label: 'Impressões', color: 'hsl(var(--primary))' },
    { key: 'engagements', dataKey: 'engagements', label: 'Engajamentos', color: 'hsl(var(--primary))' },
    { key: 'likes', dataKey: 'likes', label: 'Curtidas', color: 'hsl(var(--primary))' },
    { key: 'retweets', dataKey: 'retweets', label: 'Retweets', color: 'hsl(var(--primary))' },
    { key: 'replies', dataKey: 'replies', label: 'Respostas', color: 'hsl(var(--primary))' },
  ];

  const selectedPeriodLabel = periodOptions.find(o => o.value === period)?.label || period;

  // Handle file import
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsImporting(true);
    let totalPosts = 0;

    try {
      for (const file of Array.from(files)) {
        const content = await file.text();
        const { posts: parsedPosts, dailyMetrics } = parseTwitterCSV(content);

        if (parsedPosts.length === 0) {
          toast.error(`Nenhum tweet válido encontrado em ${file.name}`);
          continue;
        }

        await importMutation.mutateAsync({
          clientId,
          posts: parsedPosts,
          dailyMetrics,
        });

        totalPosts += parsedPosts.length;

        await logImport.mutateAsync({
          clientId,
          platform: 'twitter',
          fileName: file.name,
          recordsCount: parsedPosts.length,
          status: 'success',
          metadata: {
            dateRange: dailyMetrics?.length ? {
              start: dailyMetrics[0].date,
              end: dailyMetrics[dailyMetrics.length - 1].date,
            } : null,
          },
        });
      }

      toast.success(`${totalPosts} tweets importados com sucesso!`);
      setShowUpload(false);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao importar dados do Twitter');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  // Empty state
  if (!isLoading && posts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Twitter className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sem dados do Twitter/X</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            Importe seus dados do Twitter Analytics para visualizar métricas de tweets, impressões e engajamento.
          </p>
          
          <div
            className={`w-full max-w-md border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Arraste arquivos CSV do Twitter Analytics aqui ou
            </p>
            <Button 
              variant="outline" 
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
            >
              {isImporting ? 'Importando...' : 'Selecionar Arquivos'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </div>
          
          <div className="mt-6 text-sm text-muted-foreground">
            <p className="font-medium mb-2">Como exportar do Twitter Analytics:</p>
            <ol className="list-decimal list-inside space-y-1 text-left">
              <li>Acesse analytics.twitter.com</li>
              <li>Vá em "Tweets" ou "Tweet activity"</li>
              <li>Clique em "Export data" e baixe o CSV</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold">Twitter/X Analytics</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{filteredPosts.length} tweets no período</span>
              {lastTwitterImport && (
                <>
                  <span>•</span>
                  <span>Último import: {format(parseISO(lastTwitterImport.imported_at), 'dd/MM/yyyy HH:mm')}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canGenerateReports && (
            <Button
              onClick={() => setShowReportGenerator(true)}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4" />
              Gerar Análise
            </Button>
          )}

          {canImportData && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUpload(!showUpload)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>
          )}
        </div>
      </div>

      {/* Data Completeness Warning */}
      {posts.length > 0 && (
        <DataCompletenessWarning
          platform="twitter"
          data={{
            total: posts.length,
            withViews: posts.filter(p => p.impressions && p.impressions > 0).length,
            withEngagement: posts.filter(p => p.engagements && p.engagements > 0).length,
          }}
        />
      )}

      {/* Upload Section */}
      {showUpload && canImportData && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Arraste arquivos CSV do Twitter Analytics aqui ou
              </p>
              <Button 
                variant="outline" 
                disabled={isImporting}
                onClick={() => fileInputRef.current?.click()}
              >
                {isImporting ? 'Importando...' : 'Selecionar Arquivos'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Eye}
          label="Impressões"
          value={kpis.impressions}
          change={kpis.impressionsTrend}
          changeLabel="vs período anterior"
          sparklineData={sparklineData.impressions}
          color="blue"
        />
        <StatCard
          icon={MousePointer}
          label="Engajamentos"
          value={kpis.engagements}
          change={kpis.engagementsTrend}
          changeLabel="vs período anterior"
          sparklineData={sparklineData.engagements}
          color="emerald"
        />
        <StatCard
          icon={Heart}
          label="Curtidas"
          value={kpis.likes}
          change={kpis.likesTrend}
          changeLabel="vs período anterior"
          sparklineData={sparklineData.likes}
          color="rose"
        />
        <StatCard
          icon={TrendingUp}
          label="Taxa Engajamento"
          value={`${kpis.avgEngagement.toFixed(2)}%`}
          change={kpis.avgEngagementTrend}
          changeLabel="vs período anterior"
          sparklineData={sparklineData.engagement}
          color="violet"
        />
      </div>

      {/* Chart */}
      <div className="grid grid-cols-1 gap-4">
        <EnhancedAreaChart
          data={chartData}
          metrics={availableMetrics}
          selectedMetric={selectedMetric}
          onMetricChange={setSelectedMetric}
          title="Performance por Data"
        />
      </div>

      {/* Top 3 Tweets */}
      {topTweets.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Top 3 Tweets</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topTweets.map((tweet, index) => (
                <div
                  key={tweet.id}
                  className="group relative bg-muted/30 rounded-xl overflow-hidden border border-border/50 hover:border-primary/30 transition-all hover:shadow-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                  </div>

                  <p className="text-sm text-foreground line-clamp-3 min-h-[3.75rem]">
                    {tweet.content?.slice(0, 280) || "Sem conteúdo"}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="space-y-0.5">
                      <Heart className="h-3.5 w-3.5 mx-auto text-rose-500" />
                      <p className="text-xs font-medium">{formatNumber(tweet.likes)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <Repeat2 className="h-3.5 w-3.5 mx-auto text-emerald-500" />
                      <p className="text-xs font-medium">{formatNumber(tweet.retweets)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <MessageCircle className="h-3.5 w-3.5 mx-auto text-blue-500" />
                      <p className="text-xs font-medium">{formatNumber(tweet.replies)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      <span>{formatNumber(tweet.impressions)} impr.</span>
                    </div>
                    <span className="font-medium text-primary">
                      {(tweet.engagement_rate || 0).toFixed(2)}% eng.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Post Averages */}
      {postAverages && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Médias por Tweet
              <span className="text-xs font-normal text-muted-foreground ml-2">
                ({filteredPosts.length} tweets)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
                <Eye className="h-4 w-4 text-blue-500 mb-1.5" />
                <span className="text-lg font-semibold">{postAverages.impressions}</span>
                <span className="text-[10px] text-muted-foreground">Impressões</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
                <Heart className="h-4 w-4 text-rose-500 mb-1.5" />
                <span className="text-lg font-semibold">{postAverages.likes}</span>
                <span className="text-[10px] text-muted-foreground">Curtidas</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
                <Repeat2 className="h-4 w-4 text-emerald-500 mb-1.5" />
                <span className="text-lg font-semibold">{postAverages.retweets}</span>
                <span className="text-[10px] text-muted-foreground">Retweets</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
                <MessageCircle className="h-4 w-4 text-blue-500 mb-1.5" />
                <span className="text-lg font-semibold">{postAverages.replies}</span>
                <span className="text-[10px] text-muted-foreground">Respostas</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
                <TrendingUp className="h-4 w-4 text-primary mb-1.5" />
                <span className="text-lg font-semibold">{kpis.avgEngagement.toFixed(2)}%</span>
                <span className="text-[10px] text-muted-foreground">Engaj. Médio</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricMiniCard
          icon={Repeat2}
          label="Retweets"
          value={kpis.retweets}
          sparklineData={sparklineData.retweets}
          color="emerald"
        />
        <MetricMiniCard
          icon={MessageCircle}
          label="Respostas"
          value={kpis.replies}
          sparklineData={sparklineData.replies}
          color="blue"
        />
        <MetricMiniCard
          icon={Users}
          label="Cliques no Perfil"
          value={kpis.profileClicks}
          color="violet"
        />
        <MetricMiniCard
          icon={TrendingUp}
          label="Tweets no Período"
          value={kpis.tweetsCount}
          color="amber"
        />
      </div>

      {/* Tweets Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Todos os Tweets</CardTitle>
        </CardHeader>
        <CardContent>
          <TwitterPostsTable posts={posts} isLoading={isLoading} clientId={clientId} />
        </CardContent>
      </Card>

      {/* Import History */}
      <ImportHistoryPanel clientId={clientId} platform="twitter" />

      {/* Report Generator Modal */}
      <PerformanceReportGenerator
        clientId={clientId}
        platform="Twitter/X"
        period={selectedPeriodLabel}
        kpis={kpis}
        posts={filteredPosts as any[]}
        previousPosts={previousPeriodPosts as any[]}
        open={showReportGenerator}
        onOpenChange={setShowReportGenerator}
      />
    </div>
  );
}
