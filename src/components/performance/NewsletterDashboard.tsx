import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Mail, Eye, MousePointer, Users, TrendingUp, Upload, FileSpreadsheet, CheckCircle, AlertCircle, ChevronDown, UserPlus, UserMinus, Bookmark } from "lucide-react";
import { StatCard } from "./StatCard";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
import { GoalsPanel } from "./GoalsPanel";
import { MetricMiniCard } from "./MetricMiniCard";
import { NewsletterInsightsCard } from "./NewsletterInsightsCard";
import { BestNewsletterCard } from "./BestNewsletterCard";
import { NewsletterMetricsTable } from "./NewsletterMetricsTable";
import { subDays, format, parseISO, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSmartNewsletterImport } from "@/hooks/useSmartNewsletterImport";
import { useNewsletterPosts } from "@/hooks/usePerformanceMetrics";

interface NewsletterMetric {
  id: string;
  metric_date: string;
  views?: number | null; // delivered/enviados
  subscribers?: number | null;
  open_rate?: number | null;
  click_rate?: number | null;
  metadata?: {
    subject?: string;
    post_id?: string;
    sent?: number;
    delivered?: number;
    totalOpens?: number;
    uniqueOpens?: number;
    opens?: number;
    clicks?: number;
    uniqueClicks?: number;
    unsubscribes?: number;
    spamReports?: number;
    newSubscribers?: number;
    verifiedClickRate?: number;
    acquisitionSources?: Record<string, number>;
  } | null;
}

interface NewsletterDashboardProps {
  clientId: string;
  metrics: NewsletterMetric[];
  isLoading?: boolean;
}

export function NewsletterDashboard({ clientId, metrics, isLoading }: NewsletterDashboardProps) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("delivered");
  const [isDragging, setIsDragging] = useState(false);
  
  const { importFile, importMultipleFiles, isImporting, result, reset } = useSmartNewsletterImport(clientId);
  
  // Fetch newsletter posts separately
  const { data: newsletterPosts = [], isLoading: isLoadingPosts } = useNewsletterPosts(clientId);

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
    // Get latest subscriber count (find most recent with actual subscriber data)
    const metricsWithSubs = metrics.filter(m => m.subscribers && m.subscribers > 0);
    const latestWithSubs = [...metricsWithSubs].sort((a, b) => b.metric_date.localeCompare(a.metric_date))[0];
    const currentSubs = latestWithSubs?.subscribers || 0;
    
    // Calculate averages ONLY from metrics that have actual data (not null/0)
    const metricsWithOpenRate = filteredMetrics.filter(m => m.open_rate && m.open_rate > 0);
    const avgOpenRate = metricsWithOpenRate.length > 0
      ? metricsWithOpenRate.reduce((sum, m) => sum + (m.open_rate || 0), 0) / metricsWithOpenRate.length
      : 0;
    
    const metricsWithClickRate = filteredMetrics.filter(m => m.click_rate && m.click_rate > 0);
    const avgClickRate = metricsWithClickRate.length > 0
      ? metricsWithClickRate.reduce((sum, m) => sum + (m.click_rate || 0), 0) / metricsWithClickRate.length
      : 0;
    
    // Totals from metadata
    const totalDelivered = filteredMetrics.reduce((sum, m) => sum + (m.views || m.metadata?.delivered || 0), 0);
    const totalOpens = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.opens || 0), 0);
    const totalClicks = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.clicks || 0), 0);
    const totalNewSubs = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.newSubscribers || 0), 0);
    const totalUnsubscribes = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.unsubscribes || 0), 0);

    // Previous period for trends - only compare metrics with data
    const prevMetricsWithSubs = previousPeriodMetrics.filter(m => m.subscribers && m.subscribers > 0);
    const prevSubs = prevMetricsWithSubs.length > 0
      ? [...prevMetricsWithSubs].sort((a, b) => b.metric_date.localeCompare(a.metric_date))[0]?.subscribers || 0
      : 0;
    
    const prevMetricsWithOpenRate = previousPeriodMetrics.filter(m => m.open_rate && m.open_rate > 0);
    const prevAvgOpenRate = prevMetricsWithOpenRate.length > 0
      ? prevMetricsWithOpenRate.reduce((sum, m) => sum + (m.open_rate || 0), 0) / prevMetricsWithOpenRate.length
      : 0;
    
    const prevMetricsWithClickRate = previousPeriodMetrics.filter(m => m.click_rate && m.click_rate > 0);
    const prevAvgClickRate = prevMetricsWithClickRate.length > 0
      ? prevMetricsWithClickRate.reduce((sum, m) => sum + (m.click_rate || 0), 0) / prevMetricsWithClickRate.length
      : 0;

    const calcTrend = (current: number, prev: number) => prev > 0 ? ((current - prev) / prev) * 100 : 0;

    // Count only editions with actual send data (open_rate indicates an actual send)
    const editionsWithData = filteredMetrics.filter(m => m.open_rate && m.open_rate > 0);

    return {
      subscribers: currentSubs,
      subscribersTrend: calcTrend(currentSubs, prevSubs),
      avgOpenRate,
      avgOpenRateTrend: calcTrend(avgOpenRate, prevAvgOpenRate),
      avgClickRate,
      avgClickRateTrend: calcTrend(avgClickRate, prevAvgClickRate),
      totalDelivered,
      totalOpens,
      totalClicks,
      totalNewSubs,
      totalUnsubscribes,
      editionsCount: editionsWithData.length,
    };
  }, [metrics, filteredMetrics, previousPeriodMetrics]);

  // Sparkline data for KPIs
  const getSparklineData = (key: string) => {
    return filteredMetrics.slice(-14).map(m => {
      switch (key) {
        case "subscribers": return m.subscribers || 0;
        case "openRate": return m.open_rate || 0;
        case "clickRate": return m.click_rate || 0;
        case "delivered": return m.views || m.metadata?.delivered || 0;
        default: return 0;
      }
    });
  };

  const chartData = useMemo(() => {
    return filteredMetrics.map(m => ({
      date: format(parseISO(m.metric_date), "dd/MM", { locale: ptBR }),
      fullDate: m.metric_date,
      delivered: m.views || m.metadata?.delivered || 0,
      openRate: m.open_rate || 0,
      clickRate: m.click_rate || 0,
      opens: m.metadata?.opens || 0,
      clicks: m.metadata?.clicks || 0,
      subscribers: m.subscribers || 0,
      newSubscribers: m.metadata?.newSubscribers || 0,
    }));
  }, [filteredMetrics]);

  // Only show metrics that have data
  const availableMetrics = useMemo(() => {
    const allMetrics = [
      { key: "delivered", label: "Enviados", dataKey: "delivered", color: "hsl(var(--primary))" },
      { key: "openRate", label: "Taxa de Abertura (%)", dataKey: "openRate", color: "hsl(var(--chart-2))" },
      { key: "clickRate", label: "Taxa de Clique (%)", dataKey: "clickRate", color: "hsl(var(--chart-3))" },
      { key: "subscribers", label: "Inscritos", dataKey: "subscribers", color: "hsl(var(--chart-4))" },
      { key: "newSubscribers", label: "Novos Inscritos", dataKey: "newSubscribers", color: "hsl(var(--chart-5))" },
    ];

    return allMetrics.filter(metric => 
      chartData.some(d => (d as any)[metric.dataKey] > 0)
    );
  }, [chartData]);

  // Get best performing edition (highest open rate)
  const bestEdition = useMemo(() => {
    if (filteredMetrics.length === 0) return null;
    return filteredMetrics.reduce((best, edition) => 
      (edition.open_rate || 0) > (best.open_rate || 0) ? edition : best
    , filteredMetrics[0]);
  }, [filteredMetrics]);

  const currentMetrics = {
    followers: kpis.subscribers,
    engagement: kpis.avgOpenRate,
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    reset();
    importMultipleFiles(files);
  };

  const hasData = metrics.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importar Métricas de Newsletter (Beehiiv)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Arraste os arquivos CSV ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Suporta múltiplos arquivos: Performance, Posts e Assinantes
              </p>
              <input
                type="file"
                accept=".csv"
                multiple
                className="hidden"
                id="newsletter-csv-upload"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button variant="outline" size="sm" asChild disabled={isImporting}>
                <label htmlFor="newsletter-csv-upload" className="cursor-pointer">
                  {isImporting ? "Importando..." : "Selecionar Arquivos"}
                </label>
              </Button>
            </div>
            {result && (
              <div className={`mt-4 flex items-center gap-2 text-sm ${
                result.success ? "text-green-600" : "text-destructive"
              }`}>
                {result.success ? (
                  <><CheckCircle className="h-4 w-4" />{result.count} registros importados</>
                ) : (
                  <><AlertCircle className="h-4 w-4" />{result.error}</>
                )}
              </div>
            )}
            <div className="mt-4 text-xs text-muted-foreground">
              <p className="font-medium mb-1">CSVs aceitos do Beehiiv:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>email_performance_by_date (Date, Delivered, Open Rate, Click-Through Rate)</li>
                <li>posts_by_date (Date, Subject, Sent, Opens, Clicks...)</li>
                <li>subscriber_acquisitions_by_day (Created At, Acquisition Source, Count)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Newsletter</h3>
          <p className="text-xs text-muted-foreground">
            {metrics.length} dias de dados • {kpis.editionsCount} edições no período
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
          <Collapsible open={showUpload} onOpenChange={setShowUpload}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Importar</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showUpload ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>

      {/* Upload Section */}
      <Collapsible open={showUpload} onOpenChange={setShowUpload}>
        <CollapsibleContent>
          <Card>
            <CardContent className="pt-4">
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFiles(e.dataTransfer.files);
                }}
              >
                <input
                  type="file"
                  accept=".csv"
                  multiple
                  className="hidden"
                  id="newsletter-csv-upload-2"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <Button variant="outline" size="sm" asChild disabled={isImporting}>
                  <label htmlFor="newsletter-csv-upload-2" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    {isImporting ? "Importando..." : "Selecionar CSVs"}
                  </label>
                </Button>
              </div>
              {result && (
                <div className={`mt-3 flex items-center gap-2 text-sm ${
                  result.success ? "text-green-600" : "text-destructive"
                }`}>
                  {result.success ? (
                    <><CheckCircle className="h-4 w-4" />{result.count} registros importados</>
                  ) : (
                    <><AlertCircle className="h-4 w-4" />{result.error}</>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Inscritos"
          value={kpis.subscribers}
          change={kpis.subscribersTrend}
          icon={Users}
          sparklineData={getSparklineData("subscribers")}
        />
        <StatCard
          label="Taxa de Abertura"
          value={`${kpis.avgOpenRate.toFixed(1)}%`}
          change={kpis.avgOpenRateTrend}
          icon={Eye}
          sparklineData={getSparklineData("openRate")}
        />
        <StatCard
          label="Taxa de Clique"
          value={`${kpis.avgClickRate.toFixed(1)}%`}
          change={kpis.avgClickRateTrend}
          icon={MousePointer}
          sparklineData={getSparklineData("clickRate")}
        />
        <StatCard
          label="Total Enviados"
          value={kpis.totalDelivered}
          icon={Mail}
          sparklineData={getSparklineData("delivered")}
        />
      </div>

      {/* Chart + Goals */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EnhancedAreaChart
            data={chartData}
            metrics={availableMetrics}
            selectedMetric={selectedMetric}
            onMetricChange={setSelectedMetric}
            title="Evolução de Métricas"
          />
        </div>
        <GoalsPanel 
          clientId={clientId} 
          platform="newsletter"
          currentMetrics={currentMetrics}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricMiniCard
          icon={Eye}
          label="Total Aberturas"
          value={kpis.totalOpens}
          sparklineData={filteredMetrics.slice(-14).map(m => m.metadata?.opens || 0)}
          color="blue"
        />
        <MetricMiniCard
          icon={MousePointer}
          label="Total Cliques"
          value={kpis.totalClicks}
          sparklineData={filteredMetrics.slice(-14).map(m => m.metadata?.clicks || 0)}
          color="emerald"
        />
        <MetricMiniCard
          icon={UserPlus}
          label="Novos Inscritos"
          value={kpis.totalNewSubs}
          sparklineData={filteredMetrics.slice(-14).map(m => m.metadata?.newSubscribers || 0)}
          color="violet"
        />
        <MetricMiniCard
          icon={UserMinus}
          label="Descadastros"
          value={kpis.totalUnsubscribes}
          sparklineData={filteredMetrics.slice(-14).map(m => m.metadata?.unsubscribes || 0)}
          color="rose"
        />
      </div>

      {/* Insights and Best Edition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NewsletterInsightsCard metrics={filteredMetrics} />
        {bestEdition && <BestNewsletterCard edition={bestEdition} />}
      </div>

      {/* Posts Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <NewsletterMetricsTable metrics={newsletterPosts} isLoading={isLoadingPosts} />
        </CardContent>
      </Card>
    </div>
  );
}