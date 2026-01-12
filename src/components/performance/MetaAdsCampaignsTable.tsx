import { useState, useMemo } from "react";
import { ArrowUpDown, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Search, ChevronLeft } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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

const ITEMS_PER_PAGE = 15;

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

function PerformanceBadge({ value, average }: { value: number | null | undefined; average: number }) {
  if (value === null || value === undefined || average === 0) return null;
  
  const ratio = value / average;
  
  if (ratio >= 1.3) {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
        Top
      </Badge>
    );
  }
  if (ratio <= 0.7) {
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
        Baixo
      </Badge>
    );
  }
  return null;
}

export function MetaAdsDataTable({ type, campaigns, adsets, ads }: MetaAdsDataTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('amount_spent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Get raw data and calculate averages
  const { rawData, averages } = useMemo(() => {
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
    
    const totalResults = items.reduce((sum, i) => sum + (i.results || 0), 0);
    const totalSpent = items.reduce((sum, i) => sum + (i.amount_spent || 0), 0);
    const avgResults = items.length > 0 ? totalResults / items.length : 0;
    const avgSpent = items.length > 0 ? totalSpent / items.length : 0;
    const avgCPR = totalResults > 0 ? totalSpent / totalResults : 0;
    
    return {
      rawData: items,
      averages: { results: avgResults, spent: avgSpent, cpr: avgCPR }
    };
  }, [type, campaigns, adsets, ads]);
  
  // Filter and sort data
  const filteredData = useMemo(() => {
    let items = [...rawData];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => {
        const name = type === 'campaigns' ? item.campaign_name 
          : type === 'adsets' ? item.adset_name 
          : item.ad_name;
        return name?.toLowerCase().includes(query);
      });
    }
    
    // Apply sorting
    return items.sort((a, b) => {
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
  }, [rawData, searchQuery, sortKey, sortDirection, type]);
  
  // Paginate data
  const { paginatedData, totalPages, startIndex, endIndex } = useMemo(() => {
    const total = filteredData.length;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, total);
    
    return {
      paginatedData: filteredData.slice(startIndex, endIndex),
      totalPages,
      startIndex: startIndex + 1,
      endIndex
    };
  }, [filteredData, currentPage]);
  
  // Reset to page 1 when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  
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
      <ArrowUpDown className={cn(
        "ml-2 h-3 w-3",
        sortKey === column && "text-primary"
      )} />
    </Button>
  );
  
  const typeLabel = type === 'campaigns' ? 'campanhas' : type === 'adsets' ? 'conjuntos' : 'anúncios';
  
  if (rawData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum dado disponível. Importe um arquivo CSV para começar.
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Search and info bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Buscar ${typeLabel}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full sm:w-[280px]"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Mostrando {startIndex}-{endIndex} de {filteredData.length}
          </span>
          {searchQuery && (
            <Badge variant="secondary" className="text-xs">
              Filtrado
            </Badge>
          )}
        </div>
      </div>
      
      {/* Table */}
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
            {paginatedData.map((item) => {
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
                      <div className="flex items-center gap-2">
                        <div className="truncate max-w-[220px]" title={name}>
                          {name}
                        </div>
                        <PerformanceBadge value={item.results} average={averages.results} />
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
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={cn(
                    "cursor-pointer",
                    currentPage === 1 && "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>
              
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNum)}
                      isActive={currentPage === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={cn(
                    "cursor-pointer",
                    currentPage === totalPages && "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
