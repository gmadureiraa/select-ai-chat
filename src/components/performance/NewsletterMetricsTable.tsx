import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, MousePointer, Mail, TrendingUp, TrendingDown, Minus, Rss, Pencil, Image as ImageIcon, ExternalLink } from "lucide-react";
import { useNewsletterPosts } from "@/hooks/usePerformanceMetrics";
import { useContentLibrary } from "@/hooks/useContentLibrary";
import { NewsletterSyncBadge } from "./NewsletterSyncBadge";
import { NewsletterContentDialog } from "./NewsletterContentDialog";
import { NewsletterEditDialog } from "./NewsletterEditDialog";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NewsletterMetricsTableProps {
  clientId: string;
  isLoading?: boolean;
}

const getStorageUrl = (path: string) => {
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("client-files").getPublicUrl(path);
  return data.publicUrl;
};

export function NewsletterMetricsTable({ clientId, isLoading: externalLoading }: NewsletterMetricsTableProps) {
  const { data: posts = [], isLoading: postsLoading } = useNewsletterPosts(clientId);
  const { contents } = useContentLibrary(clientId);
  
  const [viewingNewsletter, setViewingNewsletter] = useState<any>(null);
  const [viewingMetrics, setViewingMetrics] = useState<any>(null);
  const [editingNewsletter, setEditingNewsletter] = useState<any>(null);
  
  const isLoading = externalLoading || postsLoading;

  // Get newsletters from content library
  const newsletters = contents.filter(c => c.content_type === 'newsletter');

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

  const handleRowClick = (post: any) => {
    // Find the matching newsletter in content library
    const newsletter = newsletters.find(n => n.id === post.content_library_id);
    if (newsletter) {
      setViewingNewsletter(newsletter);
      setViewingMetrics(post);
    }
  };

  const handleEdit = (e: React.MouseEvent, post: any) => {
    e.stopPropagation();
    const newsletter = newsletters.find(n => n.id === post.content_library_id);
    if (newsletter) {
      setEditingNewsletter(newsletter);
    }
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
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-xs w-[50px]"></TableHead>
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
              <TableHead className="text-xs text-center">
                <div className="flex items-center justify-center gap-1">
                  <Rss className="h-3 w-3" />
                  Sync
                </div>
              </TableHead>
              <TableHead className="text-xs text-center w-[60px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPosts.slice(0, 15).map((post, index) => {
              const subject = post.metadata?.subject || "-";
              const delivered = post.metadata?.delivered || post.views || 0;
              const openRate = post.open_rate || 0;
              const clickRate = post.click_rate || 0;
              const postUrl = post.metadata?.url || null; // NEW: Get URL from metadata
              
              const previousPost = sortedPosts[index + 1];
              const previousOpenRate = previousPost?.open_rate;
              
              const linkedNewsletter = newsletters.find(n => n.id === post.content_library_id);
              const hasContent = !!linkedNewsletter;
              const newsletterImages = (linkedNewsletter?.metadata as any)?.images;
              const thumbnailPath = Array.isArray(newsletterImages) && newsletterImages.length > 0 
                ? newsletterImages[0] 
                : linkedNewsletter?.thumbnail_url;

              return (
                <TableRow 
                  key={post.id} 
                  className={`border-border/30 ${hasContent ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                  onClick={() => hasContent && handleRowClick(post)}
                >
                  <TableCell className="p-1">
                    {thumbnailPath ? (
                      <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={getStorageUrl(thumbnailPath)}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-medium whitespace-nowrap">
                    {format(parseISO(post.metric_date), "dd MMM", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-xs max-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate" title={subject}>{subject}</span>
                      {/* NEW: Show external link icon if URL exists */}
                      {postUrl && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={postUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Ver edição online
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {hasContent && (Array.isArray(newsletterImages) && newsletterImages.length > 0) && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5">
                          <ImageIcon className="h-2.5 w-2.5" />
                          {newsletterImages.length}
                        </Badge>
                      )}
                    </div>
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
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <NewsletterSyncBadge
                      postId={post.id}
                      clientId={clientId}
                      contentLibraryId={post.content_library_id}
                      subject={subject}
                      metricDate={post.metric_date}
                      metadata={post.metadata}
                    />
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    {hasContent && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => handleEdit(e, post)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* View Dialog */}
      <NewsletterContentDialog
        newsletter={viewingNewsletter}
        metrics={viewingMetrics}
        open={!!viewingNewsletter}
        onOpenChange={(open) => {
          if (!open) {
            setViewingNewsletter(null);
            setViewingMetrics(null);
          }
        }}
      />

      {/* Edit Dialog */}
      <NewsletterEditDialog
        newsletter={editingNewsletter}
        open={!!editingNewsletter}
        onOpenChange={(open) => {
          if (!open) setEditingNewsletter(null);
        }}
      />
    </>
  );
}
