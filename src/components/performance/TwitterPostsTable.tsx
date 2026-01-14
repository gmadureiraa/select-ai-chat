import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronDown, 
  ChevronUp, 
  Search, 
  ExternalLink,
  Heart,
  Repeat2,
  MessageCircle,
  Eye,
  Edit,
  Image as ImageIcon
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TwitterPost } from "@/types/twitter";
import { TwitterPostEditDialog } from "./TwitterPostEditDialog";
import { TwitterPostContentDialog } from "./TwitterPostContentDialog";
import { ContentSyncBadge } from "./ContentSyncBadge";
import { supabase } from "@/integrations/supabase/client";

interface TwitterPostsTableProps {
  posts: TwitterPost[];
  isLoading?: boolean;
  clientId?: string;
}

type SortField = 'posted_at' | 'impressions' | 'engagements' | 'likes' | 'retweets' | 'replies' | 'engagement_rate';
type SortDirection = 'asc' | 'desc';

const getStorageUrl = (path: string) => {
  const { data } = supabase.storage.from("client-files").getPublicUrl(path);
  return data.publicUrl;
};

export function TwitterPostsTable({ posts, isLoading, clientId }: TwitterPostsTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>('posted_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const [editingPost, setEditingPost] = useState<TwitterPost | null>(null);
  const [viewingPost, setViewingPost] = useState<TwitterPost | null>(null);
  const pageSize = 20;

  const filteredPosts = useMemo(() => {
    let filtered = posts;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p => 
        p.content?.toLowerCase().includes(searchLower) ||
        p.tweet_id?.includes(search)
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case 'posted_at':
          aVal = a.posted_at || '';
          bVal = b.posted_at || '';
          break;
        case 'impressions':
          aVal = a.impressions || 0;
          bVal = b.impressions || 0;
          break;
        case 'engagements':
          aVal = a.engagements || 0;
          bVal = b.engagements || 0;
          break;
        case 'likes':
          aVal = a.likes || 0;
          bVal = b.likes || 0;
          break;
        case 'retweets':
          aVal = a.retweets || 0;
          bVal = b.retweets || 0;
          break;
        case 'replies':
          aVal = a.replies || 0;
          bVal = b.replies || 0;
          break;
        case 'engagement_rate':
          aVal = a.engagement_rate || 0;
          bVal = b.engagement_rate || 0;
          break;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    return filtered;
  }, [posts, search, sortField, sortDirection]);

  const paginatedPosts = useMemo(() => {
    const start = page * pageSize;
    return filteredPosts.slice(start, start + pageSize);
  }, [filteredPosts, page]);

  const totalPages = Math.ceil(filteredPosts.length / pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const formatNumber = (num: number | null | undefined) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString('pt-BR');
  };

  const getImageUrl = (path: string) => {
    if (path.startsWith("http")) return path;
    return getStorageUrl(path);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum tweet encontrado. Importe seus dados do Twitter Analytics.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tweets..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[280px]">Tweet</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => handleSort('posted_at')}
                >
                  <div className="flex items-center gap-1">
                    Data
                    <SortIcon field="posted_at" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/80 transition-colors text-right"
                  onClick={() => handleSort('impressions')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <Eye className="h-4 w-4" />
                    <SortIcon field="impressions" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/80 transition-colors text-right"
                  onClick={() => handleSort('likes')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <Heart className="h-4 w-4" />
                    <SortIcon field="likes" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/80 transition-colors text-right"
                  onClick={() => handleSort('retweets')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <Repeat2 className="h-4 w-4" />
                    <SortIcon field="retweets" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/80 transition-colors text-right"
                  onClick={() => handleSort('replies')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <MessageCircle className="h-4 w-4" />
                    <SortIcon field="replies" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/80 transition-colors text-right"
                  onClick={() => handleSort('engagement_rate')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Eng. %
                    <SortIcon field="engagement_rate" />
                  </div>
                </TableHead>
                {clientId && <TableHead className="w-[70px] text-center">Sync</TableHead>}
                <TableHead className="w-[60px] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPosts.map((post) => {
                const images = post.images as string[] | null;
                const firstImage = images?.[0];
                
                return (
                  <TableRow 
                    key={post.id} 
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => setViewingPost(post)}
                  >
                    {/* Thumbnail */}
                    <TableCell className="py-2">
                      <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gradient-to-br from-sky-400 to-blue-600">
                        {firstImage ? (
                          <img 
                            src={getImageUrl(firstImage)} 
                            alt="Tweet media" 
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white">
                            <ImageIcon className="h-4 w-4 opacity-60" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Content */}
                    <TableCell className="max-w-[280px]">
                      <div className="space-y-1">
                        <p className="text-sm line-clamp-2">
                          {post.content || <span className="text-muted-foreground italic">Sem texto</span>}
                        </p>
                        <div className="flex items-center gap-2">
                          {post.tweet_id && (
                            <a 
                              href={`https://twitter.com/i/web/status/${post.tweet_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver tweet
                            </a>
                          )}
                          {images && images.length > 1 && (
                            <Badge variant="secondary" className="text-[10px] h-4">
                              +{images.length - 1} imagens
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {post.posted_at 
                        ? format(parseISO(post.posted_at), "dd/MM/yy HH:mm", { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(post.impressions)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-rose-600 dark:text-rose-400">
                        {formatNumber(post.likes)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatNumber(post.retweets)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-blue-600 dark:text-blue-400">
                        {formatNumber(post.replies)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="font-mono">
                        {(post.engagement_rate || 0).toFixed(2)}%
                      </Badge>
                    </TableCell>
                    
                    {/* Sync Badge */}
                    {clientId && (
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <ContentSyncBadge
                          postId={post.id}
                          clientId={clientId}
                          platform="twitter"
                          content={post.content}
                          contentSyncedAt={post.content_synced_at}
                          tableName="twitter_posts"
                        />
                      </TableCell>
                    )}
                    
                    {/* Actions */}
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingPost(post)}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Mostrando {page * pageSize + 1} - {Math.min((page + 1) * pageSize, filteredPosts.length)} de {filteredPosts.length}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}

      {/* View Dialog */}
      <TwitterPostContentDialog
        post={viewingPost}
        open={!!viewingPost}
        onOpenChange={(open) => !open && setViewingPost(null)}
      />

      {/* Edit Dialog */}
      <TwitterPostEditDialog
        post={editingPost}
        open={!!editingPost}
        onOpenChange={(open) => !open && setEditingPost(null)}
      />
    </div>
  );
}
