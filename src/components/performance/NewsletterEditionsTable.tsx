import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, MousePointer, Mail, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface NewsletterMetric {
  id: string;
  metric_date: string;
  views?: number | null;
  subscribers?: number | null;
  open_rate?: number | null;
  click_rate?: number | null;
  metadata?: {
    delivered?: number;
    opens?: number;
    clicks?: number;
    subject?: string;
  } | null;
}

interface NewsletterEditionsTableProps {
  editions: NewsletterMetric[];
  isLoading?: boolean;
}

export function NewsletterEditionsTable({ editions, isLoading }: NewsletterEditionsTableProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getOpenRateBadge = (rate: number) => {
    if (rate >= 50) return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">Excelente</Badge>;
    if (rate >= 30) return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">Bom</Badge>;
    if (rate >= 15) return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Médio</Badge>;
    return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Baixo</Badge>;
  };

  const getTrend = (current: number, previous: number | undefined) => {
    if (previous === undefined || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    if (change > 5) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
    if (change < -5) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (editions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma edição encontrada</p>
      </div>
    );
  }

  // Sort by date descending
  const sortedEditions = [...editions].sort((a, b) => b.metric_date.localeCompare(a.metric_date));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50">
            <TableHead className="text-xs">Data</TableHead>
            <TableHead className="text-xs">Assunto</TableHead>
            <TableHead className="text-xs text-center">
              <div className="flex items-center justify-center gap-1">
                <Mail className="h-3 w-3" />
                Enviados
              </div>
            </TableHead>
            <TableHead className="text-xs text-center">
              <div className="flex items-center justify-center gap-1">
                <Eye className="h-3 w-3" />
                Abertura
              </div>
            </TableHead>
            <TableHead className="text-xs text-center">
              <div className="flex items-center justify-center gap-1">
                <MousePointer className="h-3 w-3" />
                Cliques
              </div>
            </TableHead>
            <TableHead className="text-xs text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedEditions.slice(0, 10).map((edition, index) => {
            const delivered = edition.views || edition.metadata?.delivered || 0;
            const opens = edition.metadata?.opens || 0;
            const clicks = edition.metadata?.clicks || 0;
            const openRate = edition.open_rate || 0;
            const clickRate = edition.click_rate || 0;
            const subject = edition.metadata?.subject || "-";
            const previousOpenRate = sortedEditions[index + 1]?.open_rate;

            return (
              <TableRow key={edition.id} className="border-border/30">
                <TableCell className="text-xs font-medium">
                  {format(parseISO(edition.metric_date), "dd/MM/yy", { locale: ptBR })}
                </TableCell>
                <TableCell className="text-xs max-w-[200px] truncate" title={subject}>
                  {subject}
                </TableCell>
                <TableCell className="text-xs text-center font-medium">
                  {formatNumber(delivered)}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs font-medium">{openRate.toFixed(1)}%</span>
                    {getTrend(openRate, previousOpenRate)}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-xs font-medium">{clickRate.toFixed(1)}%</span>
                </TableCell>
                <TableCell className="text-center">
                  {getOpenRateBadge(openRate)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
