import { useState, useMemo } from "react";
import { 
  DollarSign, 
  Target, 
  Users, 
  Eye, 
  TrendingUp, 
  Upload,
  LayoutGrid,
  Megaphone,
  Layers,
  FileImage,
  BarChart3,
  Filter
} from "lucide-react";
import { format, subDays, isAfter, parseISO, startOfMonth, startOfWeek, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetaAdsCampaigns, useMetaAdsAdSets, useMetaAdsAds } from "@/hooks/useMetaAdsData";
import { MetaAdsCSVUpload } from "./MetaAdsCSVUpload";
import { MetaAdsDataTable } from "./MetaAdsCampaignsTable";
import { EnhancedKPICard } from "./EnhancedKPICard";
import { DonutChart } from "./DonutChart";
import { HorizontalBarRank } from "./HorizontalBarRank";
import { MetaAdsCampaign, MetaAdsKPIs } from "@/types/metaAds";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Legend
} from "recharts";

interface MetaAdsDashboardProps {
  clientId: string;
}

const CHART_COLORS = {
  spent: "hsl(var(--primary))",
  results: "#10b981",
  reach: "#3b82f6",
  impressions: "#8b5cf6"
};

const OBJECTIVE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatCompactCurrency(value: number): string {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return formatCurrency(value);
}

export function MetaAdsDashboard({ clientId }: MetaAdsDashboardProps) {
  const [period, setPeriod] = useState("all");
  const [objective, setObjective] = useState("all");
  const [status, setStatus] = useState("all");
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">("monthly");
  
  const { data: campaigns, isLoading: loadingCampaigns } = useMetaAdsCampaigns(clientId);
  const { data: adsets, isLoading: loadingAdsets } = useMetaAdsAdSets(clientId);
  const { data: ads, isLoading: loadingAds } = useMetaAdsAds(clientId);
  
  const isLoading = loadingCampaigns || loadingAdsets || loadingAds;
  
  // Get unique objectives from data
  const uniqueObjectives = useMemo(() => {
    const objectives = new Set<string>();
    campaigns?.forEach(c => {
      if (c.result_type) objectives.add(c.result_type.toLowerCase());
    });
    return Array.from(objectives).sort();
  }, [campaigns]);
  
  // Filter data by period, objective, and status
  const filteredData = useMemo(() => {
    const cutoffDate = period === 'all' ? null 
      : period === '30' ? subDays(new Date(), 30)
      : period === '90' ? subDays(new Date(), 90)
      : period === '180' ? subDays(new Date(), 180)
      : subDays(new Date(), 365);
    
    const filterByDate = <T extends { end_date?: string | null; start_date?: string | null }>(items: T[]): T[] => {
      if (!cutoffDate) return items;
      return items.filter(item => {
        if (!item.end_date) return true;
        return isAfter(parseISO(item.end_date), cutoffDate);
      });
    };
    
    const filterByObjective = <T extends { result_type?: string | null }>(items: T[]): T[] => {
      if (objective === 'all') return items;
      return items.filter(item => 
        item.result_type?.toLowerCase() === objective
      );
    };
    
    const filterByStatus = <T extends { campaign_status?: string | null; adset_status?: string | null; ad_status?: string | null }>(items: T[], statusField: keyof T): T[] => {
      if (status === 'all') return items;
      return items.filter(item => {
        const itemStatus = (item[statusField] as string)?.toLowerCase();
        return itemStatus === status;
      });
    };
    
    let filteredCampaigns = filterByDate(campaigns || []);
    filteredCampaigns = filterByObjective(filteredCampaigns);
    filteredCampaigns = filterByStatus(filteredCampaigns, 'campaign_status');
    
    let filteredAdsets = filterByDate(adsets || []);
    filteredAdsets = filterByStatus(filteredAdsets, 'adset_status');
    
    let filteredAds = filterByDate(ads || []);
    filteredAds = filterByStatus(filteredAds, 'ad_status');
    
    return {
      campaigns: filteredCampaigns,
      adsets: filteredAdsets,
      ads: filteredAds
    };
  }, [campaigns, adsets, ads, period, objective, status]);
  
  // Calculate KPIs with sparkline data
  const { kpis, sparklines } = useMemo(() => {
    const { campaigns: filteredCampaigns } = filteredData;
    
    const totalSpent = filteredCampaigns.reduce((sum, c) => sum + (c.amount_spent || 0), 0);
    const totalResults = filteredCampaigns.reduce((sum, c) => sum + (c.results || 0), 0);
    const totalReach = filteredCampaigns.reduce((sum, c) => sum + (c.reach || 0), 0);
    const totalImpressions = filteredCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const activeCampaigns = filteredCampaigns.filter(c => c.campaign_status?.toLowerCase() === 'active').length;
    
    // Generate sparkline data from campaign spending over time
    const spentByDate: Record<string, number> = {};
    const resultsByDate: Record<string, number> = {};
    const reachByDate: Record<string, number> = {};
    const impressionsByDate: Record<string, number> = {};
    
    filteredCampaigns.forEach(c => {
      const date = c.end_date || c.start_date;
      if (date) {
        const key = format(parseISO(date), 'yyyy-MM-dd');
        spentByDate[key] = (spentByDate[key] || 0) + (c.amount_spent || 0);
        resultsByDate[key] = (resultsByDate[key] || 0) + (c.results || 0);
        reachByDate[key] = (reachByDate[key] || 0) + (c.reach || 0);
        impressionsByDate[key] = (impressionsByDate[key] || 0) + (c.impressions || 0);
      }
    });
    
    const sortedDates = Object.keys(spentByDate).sort();
    const lastN = sortedDates.slice(-12);
    
    return {
      kpis: {
        totalSpent,
        totalResults,
        avgCostPerResult: totalResults > 0 ? totalSpent / totalResults : 0,
        totalReach,
        totalImpressions,
        activeCampaigns,
        totalCampaigns: filteredCampaigns.length
      } as MetaAdsKPIs,
      sparklines: {
        spent: lastN.map(d => spentByDate[d] || 0),
        results: lastN.map(d => resultsByDate[d] || 0),
        reach: lastN.map(d => reachByDate[d] || 0),
        impressions: lastN.map(d => impressionsByDate[d] || 0)
      }
    };
  }, [filteredData]);
  
  // Evolution chart data (Investment vs Results over time)
  const evolutionData = useMemo(() => {
    const dataByPeriod: Record<string, { spent: number; results: number; date: string }> = {};
    
    filteredData.campaigns.forEach(c => {
      const date = c.end_date || c.start_date;
      if (!date) return;
      
      const parsedDate = parseISO(date);
      let periodKey: string;
      
      if (timeframe === 'daily') {
        periodKey = format(parsedDate, 'dd/MM');
      } else if (timeframe === 'weekly') {
        periodKey = format(startOfWeek(parsedDate, { locale: ptBR }), 'dd/MM');
      } else {
        periodKey = format(startOfMonth(parsedDate), 'MMM/yy', { locale: ptBR });
      }
      
      if (!dataByPeriod[periodKey]) {
        dataByPeriod[periodKey] = { spent: 0, results: 0, date: periodKey };
      }
      
      dataByPeriod[periodKey].spent += c.amount_spent || 0;
      dataByPeriod[periodKey].results += c.results || 0;
    });
    
    return Object.values(dataByPeriod)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12);
  }, [filteredData.campaigns, timeframe]);
  
  // Top campaigns by spending
  const topCampaignsBySpent = useMemo(() => {
    return filteredData.campaigns
      .filter(c => c.amount_spent && c.amount_spent > 0)
      .sort((a, b) => (b.amount_spent || 0) - (a.amount_spent || 0))
      .slice(0, 8)
      .map((c, index) => ({
        label: c.campaign_name.length > 30 
          ? c.campaign_name.substring(0, 30) + '...' 
          : c.campaign_name,
        value: c.amount_spent || 0,
        color: `bg-violet-${500 - (index * 50)}` // Gradient effect
      }));
  }, [filteredData.campaigns]);
  
  // Top campaigns by results
  const topCampaignsByResults = useMemo(() => {
    return filteredData.campaigns
      .filter(c => c.results && c.results > 0)
      .sort((a, b) => (b.results || 0) - (a.results || 0))
      .slice(0, 8)
      .map((c, index) => ({
        label: c.campaign_name.length > 30 
          ? c.campaign_name.substring(0, 30) + '...' 
          : c.campaign_name,
        value: c.results || 0
      }));
  }, [filteredData.campaigns]);
  
  // Results by objective type for donut chart
  const resultsByObjective = useMemo(() => {
    const typeMap: Record<string, { results: number; spent: number }> = {};
    
    filteredData.campaigns.forEach(c => {
      if (c.result_type) {
        const type = c.result_type.toLowerCase();
        if (!typeMap[type]) {
          typeMap[type] = { results: 0, spent: 0 };
        }
        typeMap[type].results += c.results || 0;
        typeMap[type].spent += c.amount_spent || 0;
      }
    });
    
    return Object.entries(typeMap)
      .map(([name, data], index) => ({ 
        name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: data.results,
        spent: data.spent,
        color: OBJECTIVE_COLORS[index % OBJECTIVE_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredData.campaigns]);
  
  const hasData = (campaigns?.length || 0) > 0 || (adsets?.length || 0) > 0 || (ads?.length || 0) > 0;
  
  // Custom tooltip for evolution chart
  const EvolutionTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-card border border-border rounded-lg shadow-xl p-3">
        <p className="text-sm font-medium mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">
              {entry.dataKey === 'spent' 
                ? formatCurrency(entry.value)
                : formatNumber(entry.value)
              }
            </span>
          </div>
        ))}
      </div>
    );
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header with Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Filter */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 6 meses</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Objective Filter */}
          <Select value={objective} onValueChange={setObjective}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Objetivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos objetivos</SelectItem>
              {uniqueObjectives.map(obj => (
                <SelectItem key={obj} value={obj}>
                  {obj.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Status Filter */}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="archived">Arquivados</SelectItem>
            </SelectContent>
          </Select>
          
          {hasData && (
            <div className="flex items-center gap-2 ml-auto">
              <Badge variant="outline" className="text-xs">
                {filteredData.campaigns.length} campanhas
              </Badge>
              <Badge variant="outline" className="text-xs">
                {filteredData.ads.length} anúncios
              </Badge>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end">
          <Button
            variant={showUpload ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowUpload(!showUpload)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV
          </Button>
        </div>
      </div>
      
      {/* Upload Section */}
      {showUpload && (
        <MetaAdsCSVUpload 
          clientId={clientId} 
          onComplete={() => setShowUpload(false)}
        />
      )}
      
      {!hasData && !showUpload ? (
        <Card className="p-8 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto">
              <Megaphone className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Nenhum dado de Meta Ads</h3>
            <p className="text-muted-foreground text-sm">
              Importe seus relatórios do Gerenciador de Anúncios do Facebook para começar a acompanhar o desempenho das suas campanhas.
            </p>
            <Button onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importar Primeiro CSV
            </Button>
          </div>
        </Card>
      ) : hasData && (
        <>
          {/* Enhanced KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <EnhancedKPICard
              title="Total Investido"
              value={kpis.totalSpent}
              icon={DollarSign}
              formatter={formatCurrency}
              sparklineData={sparklines.spent}
              color="primary"
            />
            <EnhancedKPICard
              title="Resultados"
              value={kpis.totalResults}
              icon={Target}
              formatter={(v) => formatNumber(v)}
              sparklineData={sparklines.results}
              color="primary"
            />
            <EnhancedKPICard
              title="Custo por Resultado"
              value={kpis.avgCostPerResult}
              icon={TrendingUp}
              formatter={formatCurrency}
              color="secondary"
            />
            <EnhancedKPICard
              title="Alcance Total"
              value={kpis.totalReach}
              icon={Users}
              formatter={(v) => formatNumber(v)}
              sparklineData={sparklines.reach}
              color="secondary"
            />
            <EnhancedKPICard
              title="Impressões"
              value={kpis.totalImpressions}
              icon={Eye}
              formatter={(v) => formatNumber(v)}
              sparklineData={sparklines.impressions}
              color="muted"
            />
          </div>
          
          {/* Tabs for different views */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Visão Geral
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="gap-2">
                <Megaphone className="h-4 w-4" />
                Campanhas
              </TabsTrigger>
              <TabsTrigger value="adsets" className="gap-2">
                <Layers className="h-4 w-4" />
                Conjuntos
              </TabsTrigger>
              <TabsTrigger value="ads" className="gap-2">
                <FileImage className="h-4 w-4" />
                Anúncios
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Evolution Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium">Evolução de Investimento x Resultados</CardTitle>
                      <CardDescription>Comparativo ao longo do tempo</CardDescription>
                    </div>
                    <Select value={timeframe} onValueChange={(v: any) => setTimeframe(v)}>
                      <SelectTrigger className="w-[120px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {evolutionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={evolutionData}>
                        <defs>
                          <linearGradient id="spentGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS.spent} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={CHART_COLORS.spent} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          yAxisId="left"
                          tickFormatter={(v) => formatCompactCurrency(v)}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          tickFormatter={(v) => formatNumber(v)}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<EvolutionTooltip />} />
                        <Legend />
                        <Bar 
                          yAxisId="left"
                          dataKey="spent" 
                          name="Investimento" 
                          fill={CHART_COLORS.spent}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="results" 
                          name="Resultados" 
                          stroke={CHART_COLORS.results}
                          strokeWidth={2}
                          dot={{ r: 4, fill: CHART_COLORS.results }}
                          activeDot={{ r: 6 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Sem dados de evolução
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Donut Chart - Results by Objective */}
                <DonutChart
                  data={resultsByObjective}
                  title="Resultados por Objetivo"
                  centerValue={formatNumber(kpis.totalResults)}
                  centerLabel="Total"
                />
                
                {/* Top Campaigns by Spending */}
                <HorizontalBarRank
                  title="Top Campanhas por Investimento"
                  items={topCampaignsBySpent}
                  maxItems={6}
                  valueFormatter={formatCompactCurrency}
                />
                
                {/* Top Campaigns by Results */}
                <HorizontalBarRank
                  title="Top Campanhas por Resultados"
                  items={topCampaignsByResults}
                  maxItems={6}
                  valueFormatter={(v) => formatNumber(v)}
                />
              </div>
              
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Campanhas Ativas</p>
                  <p className="text-2xl font-bold">{kpis.activeCampaigns}</p>
                  <p className="text-xs text-muted-foreground">de {kpis.totalCampaigns} total</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Conjuntos de Anúncios</p>
                  <p className="text-2xl font-bold">{filteredData.adsets.length}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Anúncios</p>
                  <p className="text-2xl font-bold">{filteredData.ads.length}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">CPM Médio</p>
                  <p className="text-2xl font-bold">
                    {kpis.totalImpressions > 0 
                      ? formatCurrency((kpis.totalSpent / kpis.totalImpressions) * 1000)
                      : '-'
                    }
                  </p>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="campaigns" className="mt-4">
              <MetaAdsDataTable type="campaigns" campaigns={filteredData.campaigns} />
            </TabsContent>
            
            <TabsContent value="adsets" className="mt-4">
              <MetaAdsDataTable type="adsets" adsets={filteredData.adsets} />
            </TabsContent>
            
            <TabsContent value="ads" className="mt-4">
              <MetaAdsDataTable type="ads" ads={filteredData.ads} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
