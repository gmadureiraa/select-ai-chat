import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Search, ExternalLink, Image as ImageIcon } from "lucide-react";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InstagramPostsTableProps {
  posts: InstagramPost[];
  isLoading?: boolean;
}

type SortField = "posted_at" | "likes" | "comments" | "engagement_rate" | "saves";
type SortOrder = "asc" | "desc";

const getPerformanceBadge = (engagement: number | null) => {
  if (!engagement) return null;
  if (engagement >= 8) return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">🔥 Viral</Badge>;
  if (engagement >= 4) return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">✓ Bom</Badge>;
  if (engagement >= 2) return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">• Médio</Badge>;
  return <Badge className="bg-muted text-muted-foreground">⚠️ Baixo</Badge>;
};

export function InstagramPostsTable({ posts, isLoading }: InstagramPostsTableProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("posted_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted/50 rounded animate-pulse" />
        <div className="h-64 bg-muted/50 rounded animate-pulse" />
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum post do Instagram importado</p>
        <p className="text-sm mt-1">Faça upload do CSV com seus posts</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por legenda..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
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

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[60px]">Preview</TableHead>
              <TableHead className="min-w-[200px]">Legenda</TableHead>
              <TableHead className="w-[100px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("posted_at")}>
                  Data <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[80px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("likes")}>
                  Likes <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[80px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("comments")}>
                  Coment. <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[80px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("saves")}>
                  Salvos <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[100px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("engagement_rate")}>
                  Eng. <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPosts.map((post) => (
              <TableRow key={post.id} className="group">
                <TableCell>
                  {post.thumbnail_url ? (
                    <img 
                      src={post.thumbnail_url} 
                      alt="" 
                      className="w-10 h-10 rounded object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-start gap-2">
                    <p className="text-sm line-clamp-2 flex-1">
                      {post.caption || "Sem legenda"}
                    </p>
                    {post.permalink && (
                      <a 
                        href={post.permalink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </div>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {post.post_type || "image"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {post.posted_at 
                    ? format(new Date(post.posted_at), "dd/MM/yy", { locale: ptBR })
                    : "-"
                  }
                </TableCell>
                <TableCell className="font-medium">
                  {post.likes?.toLocaleString() || 0}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {post.comments?.toLocaleString() || 0}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {post.saves?.toLocaleString() || 0}
                </TableCell>
                <TableCell className="font-medium">
                  {post.engagement_rate?.toFixed(1) || 0}%
                </TableCell>
                <TableCell>
                  {getPerformanceBadge(post.engagement_rate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Mostrando {filteredPosts.length} de {posts.length} posts
      </p>
    </div>
  );
}
