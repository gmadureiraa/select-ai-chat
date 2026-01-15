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
  Calendar,
  Linkedin,
  FileSpreadsheet
} from "lucide-react";
import { StatCard } from "./StatCard";
import { EnhancedAreaChart } from "./EnhancedAreaChart";
import { MetricMiniCard } from "./MetricMiniCard";
import { LinkedInPostsTable } from "./LinkedInPostsTable";
import { ImportHistoryPanel } from "./ImportHistoryPanel";
import { DataCompletenessWarning } from "./DataCompletenessWarning";
import { subDays, format, parseISO, isAfter, startOfDay } from "date-fns";
import { LinkedInPost } from "@/types/linkedin";
import { useImportLinkedInExcel, parseLinkedInExcel } from "@/hooks/useLinkedInPosts";
import { useImportHistory } from "@/hooks/useImportHistory";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";

interface LinkedInDashboardProps {
  clientId: string;
  posts: LinkedInPost[];
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

export function LinkedInDashboard({ clientId, posts, isLoading }: LinkedInDashboardProps) {
  const [period, setPeriod] = useState("30");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("impressions");
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useImportLinkedInExcel();
  const { logImport } = useImportHistory(clientId);
  const { canImportData } = useWorkspace();

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
    const currentComments = filteredPosts.reduce((sum, p) => sum + (p.comments || 0), 0);
    const currentShares = filteredPosts.reduce((sum, p) => sum + (p.shares || 0), 0);
    const currentClicks = filteredPosts.reduce((sum, p) => sum + (p.clicks || 0), 0);
    
    const avgEngagement = filteredPosts.length > 0
      ? filteredPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / filteredPosts.length
      : 0;

    const prevImpressions = previousPeriodPosts.reduce((sum, p) => sum + (p.impressions || 0), 0);
    const prevEngagements = previousPeriodPosts.reduce((sum, p) => sum + (p.engagements || 0), 0);
    
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
      comments: currentComments,
      shares: currentShares,
      clicks: currentClicks,
      avgEngagement,
      avgEngagementTrend: calcTrend(avgEngagement, prevAvgEngagement),
      postsCount: filteredPosts.length,
    };
  }, [filteredPosts, previousPeriodPosts]);

  // Sparkline data
  const sparklineData = useMemo(() => {
    const last14 = filteredPosts.slice(0, 14).reverse();
    return {
      impressions: last14.map(p => p.impressions || 0),
      engagements: last14.map(p => p.engagements || 0),
      engagement: last14.map(p => p.engagement_rate || 0),
    };
  }, [filteredPosts]);

  // Chart data grouped by date
  const chartData = useMemo(() => {
    const dateMap = new Map<string, { 
      impressions: number; 
      engagements: number; 
    }>();

    filteredPosts.forEach(post => {
      if (!post.posted_at) return;
      const dateKey = format(parseISO(post.posted_at), 'yyyy-MM-dd');
      const existing = dateMap.get(dateKey) || { impressions: 0, engagements: 0 };
      dateMap.set(dateKey, {
        impressions: existing.impressions + (post.impressions || 0),
        engagements: existing.engagements + (post.engagements || 0),
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
    { key: 'impressions', dataKey: 'impressions', label: 'Impressões', color: 'hsl(210, 80%, 55%)' },
    { key: 'engagements', dataKey: 'engagements', label: 'Engajamentos', color: 'hsl(145, 75%, 45%)' },
  ];

  // Handle file import
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsImporting(true);
    let totalPosts = 0;

    try {
      for (const file of Array.from(files)) {
        const buffer = await file.arrayBuffer();
        const { posts: parsedPosts, dailyMetrics, followers } = parseLinkedInExcel(buffer);

        if (parsedPosts.length === 0) {
          toast.error(`Nenhum post válido encontrado em ${file.name}`);
          continue;
        }

        await importMutation.mutateAsync({
          clientId,
          posts: parsedPosts,
          dailyMetrics,
          followers,
        });

        totalPosts += parsedPosts.length;

        // Log import
        await logImport.mutateAsync({
          clientId,
          platform: 'linkedin',
          fileName: file.name,
          recordsCount: parsedPosts.length,
          status: 'success',
          metadata: {
            dailyMetricsCount: dailyMetrics?.length || 0,
            totalFollowers: followers?.total || 0,
          },
        });
      }

      toast.success(`${totalPosts} posts do LinkedIn importados com sucesso!`);
      setShowUpload(false);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao importar dados do LinkedIn');
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
          <Linkedin className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sem dados do LinkedIn</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            Importe seus dados do LinkedIn Analytics para visualizar métricas de posts, impressões e engajamento.
          </p>
          
          <div
            className={`w-full max-w-md border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Arraste arquivos XLSX do LinkedIn Analytics aqui ou
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
              accept=".xlsx,.xls"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </div>
          
          <div className="mt-6 text-sm text-muted-foreground">
            <p className="font-medium mb-2">Como exportar do LinkedIn Analytics:</p>
            <ol className="list-decimal list-inside space-y-1 text-left">
              <li>Acesse sua página do LinkedIn</li>
              <li>Vá em "Analytics" → "Conteúdo"</li>
              <li>Clique em "Exportar" e baixe o arquivo XLSX</li>
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
          <h2 className="text-lg font-semibold">LinkedIn Analytics</h2>
          <span className="text-sm text-muted-foreground">
            {filteredPosts.length} posts no período
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period Selector */}
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

          {/* Upload Toggle */}
          {canImportData && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUpload(!showUpload)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar XLSX
            </Button>
          )}
        </div>
      </div>

      {/* Data Completeness Warning */}
      {posts.length > 0 && (
        <DataCompletenessWarning
          platform="linkedin"
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
              <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Arraste arquivos XLSX do LinkedIn Analytics aqui ou
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
          icon={Users}
          label="Posts no Período"
          value={kpis.postsCount}
          color="violet"
        />
        <StatCard
          icon={TrendingUp}
          label="Taxa Engajamento"
          value={`${kpis.avgEngagement.toFixed(2)}%`}
          change={kpis.avgEngagementTrend}
          changeLabel="vs período anterior"
          sparklineData={sparklineData.engagement}
          color="amber"
        />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          <EnhancedAreaChart
            data={chartData}
            metrics={availableMetrics}
            selectedMetric={selectedMetric}
            onMetricChange={setSelectedMetric}
            title="Performance por Data"
          />
        </div>
      )}

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricMiniCard
          icon={MousePointer}
          label="Cliques"
          value={kpis.clicks}
          color="blue"
        />
        <MetricMiniCard
          icon={Users}
          label="Curtidas"
          value={kpis.likes}
          color="rose"
        />
        <MetricMiniCard
          icon={TrendingUp}
          label="Comentários"
          value={kpis.comments}
          color="emerald"
        />
        <MetricMiniCard
          icon={Eye}
          label="Compartilhamentos"
          value={kpis.shares}
          color="violet"
        />
      </div>

      {/* Posts Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Todos os Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <LinkedInPostsTable posts={posts} isLoading={isLoading} clientId={clientId} />
        </CardContent>
      </Card>

      {/* Import History */}
      <ImportHistoryPanel clientId={clientId} platform="linkedin" />
    </div>
  );
}
