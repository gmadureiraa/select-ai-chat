import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Mail, Eye, MousePointer, Users, TrendingUp, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { StatCard } from "./StatCard";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
import { GoalsPanel } from "./GoalsPanel";
import { subDays, format, parseISO, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface NewsletterMetric {
  id: string;
  metric_date: string;
  views?: number | null;
  subscribers?: number | null;
  open_rate?: number | null;
  click_rate?: number | null;
  metadata?: {
    emails_sent?: number;
    opens?: number;
    clicks?: number;
    unsubscribes?: number;
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
  const [selectedMetric, setSelectedMetric] = useState("subscribers");
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<{ success: boolean; count: number; error?: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    const avgOpenRate = filteredMetrics.length > 0
      ? filteredMetrics.reduce((sum, m) => sum + (m.open_rate || 0), 0) / filteredMetrics.length
      : 0;
    const avgClickRate = filteredMetrics.length > 0
      ? filteredMetrics.reduce((sum, m) => sum + (m.click_rate || 0), 0) / filteredMetrics.length
      : 0;
    const totalOpens = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.opens || 0), 0);
    const totalClicks = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.clicks || 0), 0);
    const totalSent = filteredMetrics.reduce((sum, m) => sum + (m.metadata?.emails_sent || 0), 0);

    const prevSubs = previousPeriodMetrics.length > 0
      ? [...previousPeriodMetrics].sort((a, b) => b.metric_date.localeCompare(a.metric_date))[0]?.subscribers || 0
      : 0;

    const calcTrend = (current: number, prev: number) => prev > 0 ? ((current - prev) / prev) * 100 : 0;

    return {
      subscribers: currentSubs,
      subscribersTrend: calcTrend(currentSubs, prevSubs),
      avgOpenRate,
      avgClickRate,
      totalOpens,
      totalClicks,
      totalSent,
      editionsCount: filteredMetrics.length,
    };
  }, [metrics, filteredMetrics, previousPeriodMetrics]);

  const chartData = useMemo(() => {
    return filteredMetrics.map(m => ({
      date: format(parseISO(m.metric_date), "dd/MM", { locale: ptBR }),
      fullDate: m.metric_date,
      subscribers: m.subscribers || 0,
      openRate: m.open_rate || 0,
      clickRate: m.click_rate || 0,
      opens: m.metadata?.opens || 0,
      clicks: m.metadata?.clicks || 0,
    }));
  }, [filteredMetrics]);

  const chartMetrics = [
    { key: "subscribers", label: "Inscritos", dataKey: "subscribers", color: "hsl(var(--primary))" },
    { key: "openRate", label: "Taxa de Abertura", dataKey: "openRate", color: "hsl(var(--chart-2))" },
    { key: "clickRate", label: "Taxa de Clique", dataKey: "clickRate", color: "hsl(var(--chart-3))" },
    { key: "opens", label: "Aberturas", dataKey: "opens", color: "hsl(var(--chart-4))" },
  ];

  const currentMetrics = {
    followers: kpis.subscribers,
    engagement: kpis.avgOpenRate,
  };

  // CSV Import
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const lines = text.trim().split("\n");
      if (lines.length < 2) throw new Error("CSV vazio");

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
      const records: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim().replace(/['"]/g, ""));
        const record: any = {};

        headers.forEach((header, idx) => {
          const value = values[idx];
          if (!value) return;

          if (header.includes("date") || header.includes("data")) {
            record.metric_date = value;
          } else if (header.includes("subscriber") || header.includes("inscrit")) {
            record.subscribers = parseInt(value) || 0;
          } else if (header.includes("open_rate") || header.includes("taxa_abertura")) {
            record.open_rate = parseFloat(value) || 0;
          } else if (header.includes("click_rate") || header.includes("taxa_clique")) {
            record.click_rate = parseFloat(value) || 0;
          } else if (header.includes("opens") || header.includes("aberturas")) {
            record.opens = parseInt(value) || 0;
          } else if (header.includes("clicks") || header.includes("cliques")) {
            record.clicks = parseInt(value) || 0;
          } else if (header.includes("sent") || header.includes("enviados")) {
            record.emails_sent = parseInt(value) || 0;
          }
        });

        if (record.metric_date) {
          records.push(record);
        }
      }

      for (const record of records) {
        await supabase.from("platform_metrics").upsert({
          client_id: clientId,
          platform: "newsletter",
          metric_date: record.metric_date,
          subscribers: record.subscribers,
          open_rate: record.open_rate,
          click_rate: record.click_rate,
          metadata: {
            opens: record.opens,
            clicks: record.clicks,
            emails_sent: record.emails_sent,
          }
        }, { onConflict: "client_id,platform,metric_date" });
      }

      return records.length;
    },
    onSuccess: (count) => {
      setParseResult({ success: true, count });
      queryClient.invalidateQueries({ queryKey: ["performance-metrics", clientId] });
      localStorage.removeItem(`insights-${clientId}`);
      toast({ title: "Importação concluída", description: `${count} registros importados` });
    },
    onError: (error) => {
      setParseResult({ success: false, count: 0, error: error.message });
    }
  });

  const handleFile = (file: File) => {
    setParseResult(null);
    importMutation.mutate(file);
  };

  const hasData = metrics.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importar Métricas de Newsletter
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
                const file = e.dataTransfer.files[0];
                if (file?.name.endsWith(".csv")) handleFile(file);
              }}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Arraste o arquivo CSV ou clique para selecionar
              </p>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                id="newsletter-csv-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="newsletter-csv-upload" className="cursor-pointer">
                  Selecionar Arquivo
                </label>
              </Button>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Colunas aceitas:</p>
              <p>date, subscribers, open_rate, click_rate, opens, clicks, sent</p>
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
                  const file = e.dataTransfer.files[0];
                  if (file?.name.endsWith(".csv")) handleFile(file);
                }}
              >
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  id="newsletter-csv-upload-2"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor="newsletter-csv-upload-2" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar CSV
                  </label>
                </Button>
              </div>
              {parseResult && (
                <div className={`mt-3 flex items-center gap-2 text-sm ${
                  parseResult.success ? "text-green-600" : "text-destructive"
                }`}>
                  {parseResult.success ? (
                    <><CheckCircle className="h-4 w-4" />{parseResult.count} registros importados</>
                  ) : (
                    <><AlertCircle className="h-4 w-4" />{parseResult.error}</>
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
        />
        <StatCard
          label="Taxa de Abertura"
          value={`${kpis.avgOpenRate.toFixed(1)}%`}
          icon={Eye}
        />
        <StatCard
          label="Taxa de Clique"
          value={`${kpis.avgClickRate.toFixed(1)}%`}
          icon={MousePointer}
        />
        <StatCard
          label="Total Enviados"
          value={kpis.totalSent}
          icon={Mail}
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