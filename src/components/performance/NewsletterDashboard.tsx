import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Mail, Eye, MousePointer, Users, Upload, FileSpreadsheet, CheckCircle, AlertCircle, ChevronDown, UserPlus, UserMinus, Calendar } from "lucide-react";
import { StatCard } from "./StatCard";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
import { GoalsPanel } from "./GoalsPanel";
import { MetricMiniCard } from "./MetricMiniCard";
import { NewsletterInsightsCard } from "./NewsletterInsightsCard";
import { BestNewsletterCard } from "./BestNewsletterCard";
import { NewsletterMetricsTable } from "./NewsletterMetricsTable";
import { ImportHistoryPanel } from "./ImportHistoryPanel";
import { DataCompletenessWarning } from "./DataCompletenessWarning";
import { SmartCSVUpload } from "./SmartCSVUpload";
import { subDays, format, parseISO, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSmartNewsletterImport } from "@/hooks/useSmartNewsletterImport";
import { useNewsletterPosts } from "@/hooks/usePerformanceMetrics";

interface NewsletterMetric {
  id: string;
  metric_date: string;
  views?: number | null;
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

const periodOptions = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo período" },
];

export function NewsletterDashboard({ clientId, metrics, isLoading }: NewsletterDashboardProps) {
  const [period, setPeriod] = useState("30");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("delivered");
  const [isDragging, setIsDragging] = useState(false);
  
  const { importFile, importMultipleFiles, isImporting, result, reset } = useSmartNewsletterImport(clientId);
  
  // Fetch newsletter posts separately
  const { data: newsletterPosts = [], isLoading: isLoadingPosts } = useNewsletterPosts(clientId);

  const cutoffDate = useMemo(() => {
    if (period === "all") return null;
    return startOfDay(subDays(new Date(), parseInt(period)));
  }, [period]);

  const previousPeriodCutoff = useMemo(() => {
    if (period === "all") return null;
    const days = parseInt(period);
    return startOfDay(subDays(new Date(), days * 2));
  }, [period]);

  const filteredMetrics = useMemo(() => {
    if (!cutoffDate) return metrics;
    return metrics.filter(m => isAfter(parseISO(m.metric_date), cutoffDate))
      .sort((a, b) => a.metric_date.localeCompare(b.metric_date));
  }, [metrics, cutoffDate]);

  const previousPeriodMetrics = useMemo(() => {
    if (!previousPeriodCutoff || !cutoffDate) return [];
    return metrics.filter(m => {
      const date = parseISO(m.metric_date);
      return isAfter(date, previousPeriodCutoff) && !isAfter(date, cutoffDate);
    });
  }, [metrics, previousPeriodCutoff, cutoffDate]);

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

    const prevTotalDelivered = previousPeriodMetrics.reduce((sum, m) => sum + (m.views || m.metadata?.delivered || 0), 0);

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
      totalDeliveredTrend: calcTrend(totalDelivered, prevTotalDelivered),
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
      { key: "delivered", label: "Enviados", dataKey: "delivered", color: "hsl(270, 70%, 55%)" },
      { key: "openRate", label: "Taxa de Abertura (%)", dataKey: "openRate", color: "hsl(200, 80%, 55%)" },
      { key: "clickRate", label: "Taxa de Clique (%)", dataKey: "clickRate", color: "hsl(145, 80%, 45%)" },
      { key: "subscribers", label: "Inscritos", dataKey: "subscribers", color: "hsl(45, 80%, 50%)" },
      { key: "newSubscribers", label: "Novos Inscritos", dataKey: "newSubscribers", color: "hsl(350, 80%, 55%)" },
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

  // Data completeness
  const dataCompleteness = useMemo(() => ({
    total: metrics.length,
    withOpenRate: metrics.filter(m => m.open_rate && m.open_rate > 0).length,
    withClickRate: metrics.filter(m => m.click_rate && m.click_rate > 0).length,
    withSubscribers: metrics.filter(m => m.subscribers && m.subscribers > 0).length,
  }), [metrics]);

  const hasData = metrics.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Newsletter Analytics</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Importe seus dados para começar
            </p>
          </div>
        </div>
        <SmartCSVUpload clientId={clientId} platform="newsletter" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Newsletter Analytics</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {metrics.length} dias de dados • {kpis.editionsCount} edições no período
            </p>
          </div>
          <DataCompletenessWarning platform="newsletter" data={dataCompleteness} />
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

      {/* CSV Upload */}
      <Collapsible open={showUpload} onOpenChange={setShowUpload}>
        <CollapsibleContent className="pt-2">
          <SmartCSVUpload clientId={clientId} platform="newsletter" />
        </CollapsibleContent>
      </Collapsible>

      {/* Primary KPIs - 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={Users}
          label="Inscritos"
          value={kpis.subscribers}
          change={period !== "all" ? kpis.subscribersTrend : undefined}
          sparklineData={getSparklineData("subscribers")}
          color="violet"
          highlight
        />
        <StatCard
          icon={Eye}
          label="Taxa de Abertura"
          value={`${kpis.avgOpenRate.toFixed(1)}%`}
          change={period !== "all" ? kpis.avgOpenRateTrend : undefined}
          sparklineData={getSparklineData("openRate")}
          color="blue"
        />
        <StatCard
          icon={MousePointer}
          label="Taxa de Clique"
          value={`${kpis.avgClickRate.toFixed(1)}%`}
          change={period !== "all" ? kpis.avgClickRateTrend : undefined}
          sparklineData={getSparklineData("clickRate")}
          color="emerald"
        />
        <StatCard
          icon={Mail}
          label="Total Enviados"
          value={kpis.totalDelivered}
          change={period !== "all" ? kpis.totalDeliveredTrend : undefined}
          sparklineData={getSparklineData("delivered")}
          color="amber"
        />
        <StatCard
          icon={UserPlus}
          label="Novos Inscritos"
          value={kpis.totalNewSubs}
          color="rose"
        />
        <StatCard
          icon={UserMinus}
          label="Descadastros"
          value={kpis.totalUnsubscribes}
          color="secondary"
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
        {/* GoalsPanel temporariamente desabilitado - bugs ao mudar período */}
        {/* <GoalsPanel 
          clientId={clientId} 
          platform="newsletter"
          currentMetrics={currentMetrics}
        /> */}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        {bestEdition && (
          <BestNewsletterCard 
            edition={bestEdition}
          />
        )}
      </div>

      {/* Newsletter Posts Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Edições da Newsletter</CardTitle>
        </CardHeader>
        <CardContent>
          <NewsletterMetricsTable 
            clientId={clientId}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Import History */}
      <ImportHistoryPanel clientId={clientId} platform="newsletter" />
    </div>
  );
}
