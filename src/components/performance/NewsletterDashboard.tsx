import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Mail, Eye, MousePointer, Users, TrendingUp, Upload, FileSpreadsheet, CheckCircle, AlertCircle, ChevronDown, UserPlus } from "lucide-react";
import { StatCard } from "./StatCard";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
import { GoalsPanel } from "./GoalsPanel";
import { subDays, format, parseISO, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSmartNewsletterImport } from "@/hooks/useSmartNewsletterImport";

interface NewsletterMetric {
  id: string;
  metric_date: string;
  views?: number | null; // delivered/enviados
  subscribers?: number | null;
  open_rate?: number | null;
  click_rate?: number | null;
  metadata?: {
    delivered?: number;
    opens?: number;
    clicks?: number;
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
    const latestMetric = [...metrics].sort((a, b) => b.metric_date.localeCompare(a.metric_date))[0];
    const currentSubs = latestMetric?.subscribers || 0;
    
    // Calculate averages
    const avgOpenRate = filteredMetrics.length > 0
      ? filteredMetrics.reduce((sum, m) => sum + (m.open_rate || 0), 0) / filteredMetrics.length
      : 0;
    const avgClickRate = filteredMetrics.length > 0
      ? filteredMetrics.reduce((sum, m) => sum + (m.click_rate || 0), 0) / filteredMetrics.length
      : 0;
    
    // Totals from metadata
    const totalDelivered = filteredMetrics.reduce((sum, m) => sum + (m.views || m.metadata?.delivered || 0), 0);
    const totalOpens = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.opens || 0), 0);
    const totalClicks = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.clicks || 0), 0);
    const totalNewSubs = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.newSubscribers || 0), 0);
    const totalUnsubscribes = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.unsubscribes || 0), 0);

    // Previous period for trends
    const prevSubs = previousPeriodMetrics.length > 0
      ? [...previousPeriodMetrics].sort((a, b) => b.metric_date.localeCompare(a.metric_date))[0]?.subscribers || 0
      : 0;
    const prevAvgOpenRate = previousPeriodMetrics.length > 0
      ? previousPeriodMetrics.reduce((sum, m) => sum + (m.open_rate || 0), 0) / previousPeriodMetrics.length
      : 0;
    const prevAvgClickRate = previousPeriodMetrics.length > 0
      ? previousPeriodMetrics.reduce((sum, m) => sum + (m.click_rate || 0), 0) / previousPeriodMetrics.length
      : 0;

    const calcTrend = (current: number, prev: number) => prev > 0 ? ((current - prev) / prev) * 100 : 0;

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
      editionsCount: filteredMetrics.length,
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Eye className="h-3.5 w-3.5" />
            <span className="text-xs">Total Aberturas</span>
          </div>
          <p className="text-lg font-semibold">{kpis.totalOpens.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MousePointer className="h-3.5 w-3.5" />
            <span className="text-xs">Total Cliques</span>
          </div>
          <p className="text-lg font-semibold">{kpis.totalClicks.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Mail className="h-3.5 w-3.5" />
            <span className="text-xs">Edições</span>
          </div>
          <p className="text-lg font-semibold">{kpis.editionsCount}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs">Média Abertura</span>
          </div>
          <p className="text-lg font-semibold">{kpis.avgOpenRate.toFixed(1)}%</p>
        </Card>
      </div>
    </div>
  );
}