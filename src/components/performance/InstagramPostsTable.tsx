import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Search, ExternalLink, Image as ImageIcon, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface InstagramPostsTableProps {
  posts: InstagramPost[];
  isLoading?: boolean;
}

type SortField = "posted_at" | "likes" | "comments" | "engagement_rate" | "saves";
type SortOrder = "asc" | "desc";

const getPerformanceBadge = (engagement: number | null) => {
  if (!engagement) return null;
  if (engagement >= 8) return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[10px]">🔥 Viral</Badge>;
  if (engagement >= 4) return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">✓ Bom</Badge>;
  if (engagement >= 2) return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[10px]">Médio</Badge>;
  return <Badge className="bg-muted text-muted-foreground text-[10px]">Baixo</Badge>;
};

export function InstagramPostsTable({ posts, isLoading }: InstagramPostsTableProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("posted_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  
  const ITEMS_PER_PAGE = 15;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const filteredPosts = posts
    .filter((post) => {
      const matchesSearch = !search || 
        post.caption?.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || post.post_type === typeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

  const totalPages = Math.ceil(filteredPosts.length / ITEMS_PER_PAGE);
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Link copiado!",
      description: "O link foi copiado para a área de transferência.",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhum post importado</p>
        <p className="text-xs mt-1">Faça upload do CSV com seus posts</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por legenda..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 h-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => {
          setTypeFilter(v);
          setCurrentPage(1);
        }}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="image">Imagem</SelectItem>
            <SelectItem value="carousel">Carrossel</SelectItem>
            <SelectItem value="reel">Reel</SelectItem>
            <SelectItem value="story">Story</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="min-w-[180px]">Legenda</TableHead>
              <TableHead className="w-[90px]">
                <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs" onClick={() => handleSort("posted_at")}>
                  Data <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[70px] text-right">
                <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs" onClick={() => handleSort("likes")}>
                  Likes <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[70px] text-right">
                <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs" onClick={() => handleSort("comments")}>
                  Com. <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[70px] text-right">
                <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs" onClick={() => handleSort("engagement_rate")}>
                  Eng. <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPosts.map((post) => (
              <TableRow key={post.id} className="group">
                <TableCell className="py-2">
                  {post.thumbnail_url ? (
                    <img 
                      src={post.thumbnail_url} 
                      alt="" 
                      className="w-9 h-9 rounded object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded bg-muted flex items-center justify-center">
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs line-clamp-2">
                        {post.caption || "Sem legenda"}
                      </p>
                      <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                        {post.post_type || "image"}
                      </Badge>
                    </div>
                    {post.permalink && (
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(post.permalink!)}
                          title="Copiar link"
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        {/* Use native anchor tag to avoid iframe sandbox blocking */}
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-accent"
                          title="Abrir no Instagram"
                        >
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground py-2">
                  {post.posted_at 
                    ? format(new Date(post.posted_at), "dd/MM/yy", { locale: ptBR })
                    : "-"
                  }
                </TableCell>
                <TableCell className="text-right font-medium text-xs py-2">
                  {post.likes?.toLocaleString() || 0}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground py-2">
                  {post.comments?.toLocaleString() || 0}
                </TableCell>
                <TableCell className="text-right font-medium text-xs py-2">
                  {post.engagement_rate?.toFixed(1) || 0}%
                </TableCell>
                <TableCell className="py-2">
                  {getPerformanceBadge(post.engagement_rate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredPosts.length)} de {filteredPosts.length}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {currentPage}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
