import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, MousePointer, Mail, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useNewsletterPosts } from "@/hooks/usePerformanceMetrics";

interface NewsletterMetricsTableProps {
  clientId: string;
  isLoading?: boolean;
}

export function NewsletterMetricsTable({ clientId, isLoading: externalLoading }: NewsletterMetricsTableProps) {
  const { data: posts = [], isLoading: postsLoading } = useNewsletterPosts(clientId);
  
  const isLoading = externalLoading || postsLoading;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getOpenRateBadge = (rate: number) => {
    if (rate >= 40) return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-[10px]">Excelente</Badge>;
    if (rate >= 30) return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-[10px]">Bom</Badge>;
    if (rate >= 20) return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px]">Médio</Badge>;
    return <Badge className="bg-red-500/20 text-red-600 border-red-500/30 text-[10px]">Baixo</Badge>;
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

  // Filter only posts that have actual data
  const validPosts = posts.filter(m => 
    (m.views && m.views > 0) || (m.open_rate && m.open_rate > 0)
  );

  if (validPosts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum post encontrado</p>
        <p className="text-xs mt-1">Importe o CSV "posts_by_date" do Beehiiv</p>
      </div>
    );
  }

  // Sort by date descending
  const sortedPosts = [...validPosts].sort((a, b) => b.metric_date.localeCompare(a.metric_date));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50">
            <TableHead className="text-xs">Data</TableHead>
            <TableHead className="text-xs">Título</TableHead>
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
          {sortedPosts.slice(0, 15).map((post, index) => {
            const subject = post.metadata?.subject || "-";
            const delivered = post.metadata?.delivered || post.views || 0;
            const openRate = post.open_rate || 0;
            const clickRate = post.click_rate || 0;
            
            const previousPost = sortedPosts[index + 1];
            const previousOpenRate = previousPost?.open_rate;

            return (
              <TableRow key={post.id} className="border-border/30">
                <TableCell className="text-xs font-medium whitespace-nowrap">
                  {format(parseISO(post.metric_date), "dd MMM", { locale: ptBR })}
                </TableCell>
                <TableCell className="text-xs max-w-[200px] truncate" title={subject}>
                  {subject}
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
                  {openRate > 0 ? getOpenRateBadge(openRate) : "-"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
