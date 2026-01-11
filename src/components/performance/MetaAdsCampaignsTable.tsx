import { useState, useMemo } from "react";
import { ArrowUpDown, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetaAdsCampaign, MetaAdsAdSet, MetaAdsAd } from "@/types/metaAds";
import { cn } from "@/lib/utils";

type DataType = 'campaigns' | 'adsets' | 'ads';

interface MetaAdsDataTableProps {
  type: DataType;
  campaigns?: MetaAdsCampaign[];
  adsets?: MetaAdsAdSet[];
  ads?: MetaAdsAd[];
}

type SortKey = 'name' | 'results' | 'reach' | 'impressions' | 'cost_per_result' | 'amount_spent';
type SortDirection = 'asc' | 'desc';

const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-500 border-green-500/20',
  inactive: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  archived: 'bg-muted text-muted-foreground border-muted',
};

const rankingColors: Record<string, string> = {
  'above_average': 'text-green-500',
  'average': 'text-yellow-500',
  'below_average': 'text-red-500',
  'acima da média': 'text-green-500',
  'na média': 'text-yellow-500',
  'abaixo da média': 'text-red-500',
};

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR').format(value);
}

function getStatusBadge(status: string | null | undefined) {
  if (!status) return null;
  const normalized = status.toLowerCase();
  const colorClass = statusColors[normalized] || statusColors.archived;
  const label = normalized === 'active' ? 'Ativo' 
    : normalized === 'inactive' ? 'Inativo' 
    : 'Arquivado';
  
  return (
    <Badge variant="outline" className={colorClass}>
      {label}
    </Badge>
  );
}

function RankingIndicator({ ranking }: { ranking: string | null | undefined }) {
  if (!ranking || ranking === '-') return <span className="text-muted-foreground">-</span>;
  
  const normalized = ranking.toLowerCase();
  const colorClass = Object.entries(rankingColors).find(([key]) => 
    normalized.includes(key)
  )?.[1] || 'text-muted-foreground';
  
  const Icon = normalized.includes('above') || normalized.includes('acima') 
    ? TrendingUp 
    : normalized.includes('below') || normalized.includes('abaixo')
    ? TrendingDown
    : Minus;
  
  return (
    <div className={cn("flex items-center gap-1", colorClass)}>
      <Icon className="h-3 w-3" />
      <span className="text-xs capitalize">
        {normalized.includes('above') || normalized.includes('acima') ? 'Acima' 
          : normalized.includes('below') || normalized.includes('abaixo') ? 'Abaixo' 
          : 'Média'}
      </span>
    </div>
  );
}

export function MetaAdsDataTable({ type, campaigns, adsets, ads }: MetaAdsDataTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('amount_spent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const data = useMemo(() => {
    let items: any[] = [];
    
    switch (type) {
      case 'campaigns':
        items = campaigns || [];
        break;
      case 'adsets':
        items = adsets || [];
        break;
      case 'ads':
        items = ads || [];
        break;
    }
    
    return [...items].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortKey) {
        case 'name':
          aVal = (type === 'campaigns' ? a.campaign_name : type === 'adsets' ? a.adset_name : a.ad_name) || '';
          bVal = (type === 'campaigns' ? b.campaign_name : type === 'adsets' ? b.adset_name : b.ad_name) || '';
          break;
        default:
          aVal = a[sortKey] ?? 0;
          bVal = b[sortKey] ?? 0;
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
  }, [type, campaigns, adsets, ads, sortKey, sortDirection]);
  
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };
  
  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const SortButton = ({ column, label }: { column: SortKey; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => handleSort(column)}
    >
      {label}
      <ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  );
  
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum dado disponível. Importe um arquivo CSV para começar.
      </div>
    );
  }
  
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30px]"></TableHead>
            <TableHead className="min-w-[200px]">
              <SortButton column="name" label="Nome" />
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">
              <SortButton column="results" label="Resultados" />
            </TableHead>
            <TableHead className="text-right">
              <SortButton column="reach" label="Alcance" />
            </TableHead>
            <TableHead className="text-right">
              <SortButton column="impressions" label="Impressões" />
            </TableHead>
            <TableHead className="text-right">
              <SortButton column="cost_per_result" label="CPR" />
            </TableHead>
            <TableHead className="text-right">
              <SortButton column="amount_spent" label="Gasto" />
            </TableHead>
            {type === 'ads' && (
              <TableHead className="text-center">Qualidade</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const name = type === 'campaigns' ? item.campaign_name 
              : type === 'adsets' ? item.adset_name 
              : item.ad_name;
            const status = type === 'campaigns' ? item.campaign_status 
              : type === 'adsets' ? item.adset_status 
              : item.ad_status;
            const isExpanded = expandedRows.has(item.id);
            
            return (
              <>
                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => toggleRow(item.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="truncate max-w-[250px]" title={name}>
                      {name}
                    </div>
                    {item.result_type && (
                      <span className="text-xs text-muted-foreground capitalize">
                        {item.result_type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(status)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(item.results)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(item.reach)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(item.impressions)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.cost_per_result)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.amount_spent)}
                  </TableCell>
                  {type === 'ads' && (
                    <TableCell className="text-center">
                      <RankingIndicator ranking={(item as MetaAdsAd).quality_ranking} />
                    </TableCell>
                  )}
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={type === 'ads' ? 9 : 8} className="bg-muted/30 p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Período:</span>
                          <p className="font-medium">
                            {item.start_date && item.end_date 
                              ? `${format(new Date(item.start_date), "dd/MM/yyyy", { locale: ptBR })} - ${format(new Date(item.end_date), "dd/MM/yyyy", { locale: ptBR })}`
                              : '-'
                            }
                          </p>
                        </div>
                        {type !== 'campaigns' && (
                          <div>
                            <span className="text-muted-foreground">Orçamento:</span>
                            <p className="font-medium">
                              {formatCurrency((item as MetaAdsAdSet).budget)}
                              {(item as MetaAdsAdSet).budget_type && (
                                <span className="text-muted-foreground text-xs ml-1">
                                  ({(item as MetaAdsAdSet).budget_type === 'daily' ? 'diário' : 'total'})
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                        {type === 'ads' && (
                          <>
                            <div>
                              <span className="text-muted-foreground">Taxa de Engajamento:</span>
                              <RankingIndicator ranking={(item as MetaAdsAd).engagement_rate_ranking} />
                            </div>
                            <div>
                              <span className="text-muted-foreground">Taxa de Conversão:</span>
                              <RankingIndicator ranking={(item as MetaAdsAd).conversion_rate_ranking} />
                            </div>
                          </>
                        )}
                        {item.attribution_setting && (
                          <div>
                            <span className="text-muted-foreground">Atribuição:</span>
                            <p className="font-medium">{item.attribution_setting}</p>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
