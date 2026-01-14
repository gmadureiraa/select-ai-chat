import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  MousePointer,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LinkedInPost } from "@/types/linkedin";

interface LinkedInPostsTableProps {
  posts: LinkedInPost[];
  isLoading?: boolean;
}

type SortField = "posted_at" | "impressions" | "engagements" | "engagement_rate";
type SortDirection = "asc" | "desc";

const POSTS_PER_PAGE = 10;

export function LinkedInPostsTable({ posts, isLoading }: LinkedInPostsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("posted_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);

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
            <TableRow>
              <TableHead className="w-[50%]">Post</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("posted_at")}
              >
                <div className="flex items-center gap-1">
                  Data <SortIcon field="posted_at" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("impressions")}
              >
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  <span className="hidden sm:inline">Impressões</span>
                  <SortIcon field="impressions" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("engagements")}
              >
                <div className="flex items-center gap-1">
                  <MousePointer className="h-4 w-4" />
                  <span className="hidden sm:inline">Engaj.</span>
                  <SortIcon field="engagements" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("engagement_rate")}
              >
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Taxa</span>
                  <SortIcon field="engagement_rate" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "Nenhum post encontrado" : "Nenhum post disponível"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedPosts.map((post) => (
                <TableRow key={post.id} className="group">
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-sm line-clamp-2">
                        {post.content || (
                          <span className="text-muted-foreground italic">Sem texto</span>
                        )}
                      </p>
                      {post.post_url && (
                        <a
                          href={post.post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver no LinkedIn
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {post.posted_at
                      ? format(parseISO(post.posted_at), "dd/MM/yyyy", { locale: ptBR })
                      : "-"}
                  </TableCell>
                  <TableCell className="text-blue-600 font-medium">
                    {formatNumber(post.impressions)}
                  </TableCell>
                  <TableCell className="text-emerald-600 font-medium">
                    {formatNumber(post.engagements)}
                  </TableCell>
                  <TableCell className="text-violet-600 font-medium">
                    {post.engagement_rate ? `${post.engagement_rate.toFixed(2)}%` : "-"}
                  </TableCell>
                </TableRow>
              ))
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
    </div>
  );
}
