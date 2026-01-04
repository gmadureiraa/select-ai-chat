import { useState, useMemo } from "react";
import { 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MetricsSpreadsheetProps {
  data: any[];
  platform?: string;
}

type SortDirection = "asc" | "desc" | null;

const ITEMS_PER_PAGE = 50;

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString("pt-BR");
};

const getColumnConfig = (platform: string) => {
  switch (platform) {
    case "instagram":
      return [
        { key: "date", label: "Data", sortable: true },
        { key: "type", label: "Tipo", sortable: true },
        { key: "caption", label: "Legenda", sortable: false },
        { key: "reach", label: "Alcance", sortable: true, numeric: true },
        { key: "impressions", label: "Impressões", sortable: true, numeric: true },
        { key: "engagement", label: "Eng. %", sortable: true, numeric: true },
        { key: "likes", label: "Curtidas", sortable: true, numeric: true },
        { key: "comments", label: "Coment.", sortable: true, numeric: true },
        { key: "saves", label: "Salvos", sortable: true, numeric: true },
        { key: "shares", label: "Compart.", sortable: true, numeric: true },
      ];
    case "youtube":
      return [
        { key: "date", label: "Data", sortable: true },
        { key: "title", label: "Título", sortable: false },
        { key: "views", label: "Views", sortable: true, numeric: true },
        { key: "watchHours", label: "Horas", sortable: true, numeric: true },
        { key: "ctr", label: "CTR %", sortable: true, numeric: true },
        { key: "subscribers", label: "Inscritos", sortable: true, numeric: true },
        { key: "duration", label: "Duração (min)", sortable: true, numeric: true },
      ];
    case "newsletter":
      return [
        { key: "date", label: "Data", sortable: true },
        { key: "subscribers", label: "Inscritos", sortable: true, numeric: true },
        { key: "openRate", label: "Abertura %", sortable: true, numeric: true },
        { key: "clickRate", label: "Cliques %", sortable: true, numeric: true },
        { key: "views", label: "Views", sortable: true, numeric: true },
      ];
    default:
      return [];
  }
};

const getTypeColor = (type: string) => {
  switch (type?.toLowerCase()) {
    case "reel":
    case "reels":
      return "bg-pink-500/20 text-pink-500 border-pink-500/30";
    case "carousel":
    case "carrossel":
      return "bg-blue-500/20 text-blue-500 border-blue-500/30";
    case "image":
    case "imagem":
      return "bg-green-500/20 text-green-500 border-green-500/30";
    case "story":
    case "stories":
      return "bg-purple-500/20 text-purple-500 border-purple-500/30";
    case "video":
      return "bg-red-500/20 text-red-500 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export function MetricsSpreadsheet({ data, platform = "instagram" }: MetricsSpreadsheetProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const columns = getColumnConfig(platform);

  // Get unique types for filter
  const uniqueTypes = useMemo(() => {
    if (platform !== "instagram") return [];
    const types = new Set(data.map(item => item.type).filter(Boolean));
    return Array.from(types);
  }, [data, platform]);

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item => 
        Object.values(item).some(value => 
          String(value).toLowerCase().includes(term)
        )
      );
    }

    // Apply type filter
    if (typeFilter !== "all" && platform === "instagram") {
      result = result.filter(item => item.type === typeFilter);
    }

    // Apply sorting
    if (sortColumn && sortDirection) {
      const column = columns.find(c => c.key === sortColumn);
      result.sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];
        
        if (column?.numeric) {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
        } else {
          aVal = String(aVal || "").toLowerCase();
          bVal = String(bVal || "").toLowerCase();
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, sortColumn, sortDirection, typeFilter, columns, platform]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / ITEMS_PER_PAGE);
  const paginatedData = processedData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      if (sortDirection === "asc") setSortDirection("desc");
      else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(key);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (key: string) => {
    if (sortColumn !== key) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    if (sortDirection === "asc") return <ArrowUp className="h-3 w-3 ml-1" />;
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const renderCellValue = (item: any, column: any) => {
    const value = item[column.key];
    
    if (column.key === "type") {
      return (
        <Badge variant="outline" className={`text-xs capitalize ${getTypeColor(value)}`}>
          {value}
        </Badge>
      );
    }
    
    if (column.key === "engagement" || column.key === "ctr" || column.key === "openRate" || column.key === "clickRate") {
      return `${(Number(value) || 0).toFixed(1)}%`;
    }
    
    if (column.numeric) {
      return formatNumber(Number(value) || 0);
    }
    
    if (column.key === "caption" || column.key === "title") {
      return (
        <span className="truncate max-w-[200px] block" title={value}>
          {value || "-"}
        </span>
      );
    }
    
    return value || "-";
  };

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Todas as Métricas ({processedData.length} itens)
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-9 w-[200px]"
              />
            </div>
            {platform === "instagram" && uniqueTypes.length > 0 && (
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[130px] h-9">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueTypes.map(type => (
                    <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={`text-xs whitespace-nowrap ${column.sortable ? "cursor-pointer hover:bg-muted/50" : ""}`}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center">
                      {column.label}
                      {column.sortable && getSortIcon(column.key)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    Nenhum dado encontrado
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item, index) => (
                  <TableRow key={item.id || index} className="hover:bg-muted/30">
                    {columns.map((column) => (
                      <TableCell key={column.key} className="text-sm py-2.5">
                        {renderCellValue(item, column)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
            <span className="text-xs text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
