import { useState, useMemo } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Eye,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Heart,
  MessageCircle,
  Share2,
  Edit,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LinkedInPost } from "@/types/linkedin";
import { ContentSyncBadge } from "./ContentSyncBadge";
import { LinkedInPostContentDialog } from "./LinkedInPostContentDialog";
import { LinkedInPostEditDialog } from "./LinkedInPostEditDialog";
import { supabase } from "@/integrations/supabase/client";

interface LinkedInPostsTableProps {
  posts: LinkedInPost[];
  isLoading?: boolean;
  clientId?: string;
}

type SortField = "posted_at" | "impressions" | "engagements" | "engagement_rate" | "likes" | "comments" | "shares";
type SortDirection = "asc" | "desc";

const POSTS_PER_PAGE = 15;

const getStorageUrl = (path: string) => {
  const { data } = supabase.storage.from("client-files").getPublicUrl(path);
  return data.publicUrl;
};

export function LinkedInPostsTable({ posts, isLoading, clientId }: LinkedInPostsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("posted_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingPost, setViewingPost] = useState<LinkedInPost | null>(null);
  const [editingPost, setEditingPost] = useState<LinkedInPost | null>(null);

  const filteredPosts = useMemo(() => {
    let result = posts;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.content?.toLowerCase().includes(query) ||
          p.post_url?.toLowerCase().includes(query)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case "posted_at":
          aVal = a.posted_at || "";
          bVal = b.posted_at || "";
          break;
        case "impressions":
          aVal = a.impressions || 0;
          bVal = b.impressions || 0;
          break;
        case "engagements":
          aVal = a.engagements || 0;
          bVal = b.engagements || 0;
          break;
        case "engagement_rate":
          aVal = a.engagement_rate || 0;
          bVal = b.engagement_rate || 0;
          break;
        case "likes":
          aVal = a.likes || 0;
          bVal = b.likes || 0;
          break;
        case "comments":
          aVal = a.comments || 0;
          bVal = b.comments || 0;
          break;
        case "shares":
          aVal = a.shares || 0;
          bVal = b.shares || 0;
          break;
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return result;
  }, [posts, searchQuery, sortField, sortDirection]);

  const paginatedPosts = useMemo(() => {
    const start = (currentPage - 1) * POSTS_PER_PAGE;
    return filteredPosts.slice(start, start + POSTS_PER_PAGE);
  }, [filteredPosts, currentPage]);

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "-";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString("pt-BR");
  };

  const getImageUrl = (path: string) => {
    if (path.startsWith("http")) return path;
    return getStorageUrl(path);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar posts..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="w-[35%]">Post</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("posted_at")}
              >
                <div className="flex items-center gap-1">
                  Data <SortIcon field="posted_at" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/80 text-right"
                onClick={() => handleSort("impressions")}
              >
                <div className="flex items-center justify-end gap-1">
                  <Eye className="h-4 w-4" />
                  <SortIcon field="impressions" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/80 text-right"
                onClick={() => handleSort("likes")}
              >
                <div className="flex items-center justify-end gap-1">
                  <Heart className="h-4 w-4" />
                  <SortIcon field="likes" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/80 text-right"
                onClick={() => handleSort("comments")}
              >
                <div className="flex items-center justify-end gap-1">
                  <MessageCircle className="h-4 w-4" />
                  <SortIcon field="comments" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/80 text-right"
                onClick={() => handleSort("shares")}
              >
                <div className="flex items-center justify-end gap-1">
                  <Share2 className="h-4 w-4" />
                  <SortIcon field="shares" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/80 text-right"
                onClick={() => handleSort("engagement_rate")}
              >
                <div className="flex items-center justify-end gap-1">
                  Eng.%
                  <SortIcon field="engagement_rate" />
                </div>
              </TableHead>
              {clientId && (
                <TableHead className="w-[70px] text-center">Sync</TableHead>
              )}
              <TableHead className="w-[60px] text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={clientId ? 10 : 9} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "Nenhum post encontrado" : "Nenhum post disponível"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedPosts.map((post) => {
                const images = post.images as string[] | null;
                const firstImage = images?.[0];
                
                return (
                  <TableRow 
                    key={post.id} 
                    className="group hover:bg-muted/30 cursor-pointer"
                    onClick={() => setViewingPost(post)}
                  >
                    {/* Thumbnail */}
                    <TableCell className="py-2">
                      <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-600 to-blue-800">
                        {firstImage ? (
                          <img 
                            src={getImageUrl(firstImage)} 
                            alt="Post media" 
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
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm line-clamp-2">
                          {post.content || (
                            <span className="text-muted-foreground italic">Sem texto</span>
                          )}
                        </p>
                        <div className="flex items-center gap-2">
                          {post.post_url && (
                            <a
                              href={post.post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver no LinkedIn
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
                    
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {post.posted_at
                        ? format(parseISO(post.posted_at), "dd/MM/yy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right text-blue-600 font-medium">
                      {formatNumber(post.impressions)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-rose-600 dark:text-rose-400">
                        {formatNumber(post.likes)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sky-600 dark:text-sky-400">
                        {formatNumber(post.comments)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatNumber(post.shares)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="font-mono">
                        {post.engagement_rate ? `${post.engagement_rate.toFixed(2)}%` : "-"}
                      </Badge>
                    </TableCell>
                    
                    {clientId && (
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <ContentSyncBadge
                          postId={post.id}
                          clientId={clientId}
                          platform="linkedin"
                          content={post.content}
                          contentSyncedAt={post.content_synced_at}
                          tableName="linkedin_posts"
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
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * POSTS_PER_PAGE + 1} -{" "}
            {Math.min(currentPage * POSTS_PER_PAGE, filteredPosts.length)} de{" "}
            {filteredPosts.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* View Dialog */}
      <LinkedInPostContentDialog
        post={viewingPost}
        open={!!viewingPost}
        onOpenChange={(open) => !open && setViewingPost(null)}
      />

      {/* Edit Dialog */}
      <LinkedInPostEditDialog
        post={editingPost}
        open={!!editingPost}
        onOpenChange={(open) => !open && setEditingPost(null)}
      />
    </div>
  );
}
