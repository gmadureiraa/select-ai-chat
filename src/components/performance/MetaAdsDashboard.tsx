import { useState, useMemo } from "react";
import { 
  DollarSign, 
  Target, 
  Users, 
  Eye, 
  TrendingUp, 
  TrendingDown,
  Upload,
  LayoutGrid,
  List,
  Megaphone,
  Layers,
  FileImage
} from "lucide-react";
import { format, subDays, isAfter, parseISO } from "date-fns";
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
import { MetaAdsCampaign, MetaAdsAdSet, MetaAdsAd, MetaAdsKPIs } from "@/types/metaAds";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface MetaAdsDashboardProps {
  clientId: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  change, 
  color = 'primary',
  format: formatType = 'number'
}: { 
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  change?: number;
  color?: string;
  format?: 'number' | 'currency' | 'percent';
}) {
  const formattedValue = formatType === 'currency' 
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    : formatType === 'percent'
    ? `${value.toFixed(2)}%`
    : new Intl.NumberFormat('pt-BR').format(value);
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            color === 'primary' && "bg-primary/10 text-primary",
            color === 'green' && "bg-green-500/10 text-green-500",
            color === 'blue' && "bg-blue-500/10 text-blue-500",
            color === 'purple' && "bg-purple-500/10 text-purple-500",
            color === 'orange' && "bg-orange-500/10 text-orange-500",
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-lg font-semibold truncate">{formattedValue}</p>
          </div>
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 text-xs",
              change >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(change).toFixed(1)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MetaAdsDashboard({ clientId }: MetaAdsDashboardProps) {
  const [period, setPeriod] = useState("all");
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  
  const { data: campaigns, isLoading: loadingCampaigns } = useMetaAdsCampaigns(clientId);
  const { data: adsets, isLoading: loadingAdsets } = useMetaAdsAdSets(clientId);
  const { data: ads, isLoading: loadingAds } = useMetaAdsAds(clientId);
  
  const isLoading = loadingCampaigns || loadingAdsets || loadingAds;
  
  // Filter data by period
  const filteredData = useMemo(() => {
    const cutoffDate = period === 'all' ? null 
      : period === '30' ? subDays(new Date(), 30)
      : period === '90' ? subDays(new Date(), 90)
      : period === '180' ? subDays(new Date(), 180)
      : subDays(new Date(), 365);
    
    const filterByDate = <T extends { end_date?: string | null }>(items: T[]): T[] => {
      if (!cutoffDate) return items;
      return items.filter(item => {
        if (!item.end_date) return true;
        return isAfter(parseISO(item.end_date), cutoffDate);
      });
    };
    
    return {
      campaigns: filterByDate(campaigns || []),
      adsets: filterByDate(adsets || []),
      ads: filterByDate(ads || [])
    };
  }, [campaigns, adsets, ads, period]);
  
  // Calculate KPIs
  const kpis = useMemo((): MetaAdsKPIs => {
    const { campaigns: filteredCampaigns } = filteredData;
    
    const totalSpent = filteredCampaigns.reduce((sum, c) => sum + (c.amount_spent || 0), 0);
    const totalResults = filteredCampaigns.reduce((sum, c) => sum + (c.results || 0), 0);
    const totalReach = filteredCampaigns.reduce((sum, c) => sum + (c.reach || 0), 0);
    const totalImpressions = filteredCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const activeCampaigns = filteredCampaigns.filter(c => c.campaign_status === 'active').length;
    
    return {
      totalSpent,
      totalResults,
      avgCostPerResult: totalResults > 0 ? totalSpent / totalResults : 0,
      totalReach,
      totalImpressions,
      activeCampaigns,
      totalCampaigns: filteredCampaigns.length
    };
  }, [filteredData]);
  
  // Chart data: spending by campaign
  const spendingByCapaign = useMemo(() => {
    return filteredData.campaigns
      .filter(c => c.amount_spent && c.amount_spent > 0)
      .sort((a, b) => (b.amount_spent || 0) - (a.amount_spent || 0))
      .slice(0, 10)
      .map(c => ({
        name: c.campaign_name.length > 25 
          ? c.campaign_name.substring(0, 25) + '...' 
          : c.campaign_name,
        value: c.amount_spent || 0,
        results: c.results || 0
      }));
  }, [filteredData.campaigns]);
  
  // Chart data: results by type
  const resultsByType = useMemo(() => {
    const typeMap: Record<string, number> = {};
    
    filteredData.campaigns.forEach(c => {
      if (c.result_type && c.results) {
        const type = c.result_type.toLowerCase();
        typeMap[type] = (typeMap[type] || 0) + c.results;
      }
    });
    
    return Object.entries(typeMap)
      .map(([name, value]) => ({ 
        name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value 
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData.campaigns]);
  
  const hasData = (campaigns?.length || 0) > 0 || (adsets?.length || 0) > 0 || (ads?.length || 0) > 0;
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]">
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
          {hasData && (
            <Badge variant="outline" className="text-xs">
              {filteredData.campaigns.length} campanhas
            </Badge>
          )}
        </div>
        <Button
          variant={showUpload ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowUpload(!showUpload)}
        >
          <Upload className="h-4 w-4 mr-2" />
          Importar CSV
        </Button>
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
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard
              icon={DollarSign}
              label="Total Investido"
              value={kpis.totalSpent}
              format="currency"
              color="primary"
            />
            <StatCard
              icon={Target}
              label="Resultados"
              value={kpis.totalResults}
              color="green"
            />
            <StatCard
              icon={TrendingUp}
              label="Custo por Resultado"
              value={kpis.avgCostPerResult}
              format="currency"
              color="orange"
            />
            <StatCard
              icon={Users}
              label="Alcance Total"
              value={kpis.totalReach}
              color="blue"
            />
            <StatCard
              icon={Eye}
              label="Impressões"
              value={kpis.totalImpressions}
              color="purple"
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Spending by Campaign */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Investimento por Campanha</CardTitle>
                    <CardDescription>Top 10 campanhas por gasto</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {spendingByCapaign.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={spendingByCapaign} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis 
                            type="number" 
                            tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`}
                          />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            width={120}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip 
                            formatter={(value: number) => [
                              new Intl.NumberFormat('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL' 
                              }).format(value),
                              'Investimento'
                            ]}
                          />
                          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Sem dados de investimento
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Results by Type */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Resultados por Objetivo</CardTitle>
                    <CardDescription>Distribuição de resultados por tipo</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {resultsByType.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={resultsByType}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {resultsByType.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => [
                              new Intl.NumberFormat('pt-BR').format(value),
                              'Resultados'
                            ]}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Sem dados de resultados
                      </div>
                    )}
                  </CardContent>
                </Card>
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
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                          .format((kpis.totalSpent / kpis.totalImpressions) * 1000)
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
