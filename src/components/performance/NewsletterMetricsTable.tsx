import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, MousePointer, Mail, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";

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
    newSubscribers?: number;
  } | null;
}

interface NewsletterMetricsTableProps {
  metrics: NewsletterMetric[];
  isLoading?: boolean;
}

export function NewsletterMetricsTable({ metrics, isLoading }: NewsletterMetricsTableProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getTrend = (current: number | null | undefined, previous: number | null | undefined) => {
    if (!current || !previous || previous === 0) return null;
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

  // Filter only metrics that have actual newsletter data (views or open_rate)
  const validMetrics = metrics.filter(m => 
    (m.views && m.views > 0) || (m.open_rate && m.open_rate > 0)
  );

  if (validMetrics.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum dado de envio encontrado</p>
        <p className="text-xs mt-1">Importe CSVs de performance do Beehiiv</p>
      </div>
    );
  }

  // Sort by date descending
  const sortedMetrics = [...validMetrics].sort((a, b) => b.metric_date.localeCompare(a.metric_date));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50">
            <TableHead className="text-xs">Data</TableHead>
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
            <TableHead className="text-xs text-center">
              <div className="flex items-center justify-center gap-1">
                <Users className="h-3 w-3" />
                Novos Inscritos
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedMetrics.slice(0, 15).map((metric, index) => {
            const delivered = metric.views || metric.metadata?.delivered || 0;
            const openRate = metric.open_rate || 0;
            const clickRate = metric.click_rate || 0;
            const newSubs = metric.metadata?.newSubscribers || 0;
            
            const previousMetric = sortedMetrics[index + 1];
            const previousOpenRate = previousMetric?.open_rate;

            return (
              <TableRow key={metric.id} className="border-border/30">
                <TableCell className="text-xs font-medium">
                  {format(parseISO(metric.metric_date), "dd MMM yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell className="text-xs text-center font-medium">
                  {delivered > 0 ? formatNumber(delivered) : "-"}
                </TableCell>
                <TableCell className="text-center">
                  {openRate > 0 ? (
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs font-medium">{openRate.toFixed(1)}%</span>
                      {getTrend(openRate, previousOpenRate)}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {clickRate > 0 ? (
                    <span className="text-xs font-medium">{clickRate.toFixed(1)}%</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {newSubs > 0 ? (
                    <span className="text-xs font-medium text-emerald-600">+{newSubs}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
