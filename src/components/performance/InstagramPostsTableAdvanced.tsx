import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowUpDown, Search, ExternalLink, Image as ImageIcon, Copy, ChevronLeft, ChevronRight, Pencil, Users, Settings2, ArrowUp, ArrowDown, Filter, X, Calendar } from "lucide-react";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { format, parseISO, isAfter, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { InstagramPostEditDialog } from "./InstagramPostEditDialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface InstagramPostsTableAdvancedProps {
  posts: InstagramPost[];
  isLoading?: boolean;
  clientId: string;
}

type SortField = "posted_at" | "likes" | "comments" | "saves" | "shares" | "reach" | "impressions" | "engagement_rate" | "link_clicks" | "profile_visits";
type SortOrder = "asc" | "desc";

interface Column {
  id: SortField | "thumbnail" | "caption" | "type" | "actions";
  label: string;
  sortable: boolean;
  defaultVisible: boolean;
  width?: string;
}

const ALL_COLUMNS: Column[] = [
  { id: "thumbnail", label: "Capa", sortable: false, defaultVisible: true, width: "50px" },
  { id: "caption", label: "Legenda", sortable: false, defaultVisible: true },
  { id: "type", label: "Tipo", sortable: false, defaultVisible: true, width: "80px" },
  { id: "posted_at", label: "Data", sortable: true, defaultVisible: true, width: "85px" },
  { id: "impressions", label: "Impressões", sortable: true, defaultVisible: true, width: "90px" },
  { id: "reach", label: "Contas alc.", sortable: true, defaultVisible: true, width: "80px" },
  { id: "likes", label: "Curtidas", sortable: true, defaultVisible: true, width: "75px" },
  { id: "comments", label: "Comentários", sortable: true, defaultVisible: true, width: "95px" },
  { id: "shares", label: "Comp.", sortable: true, defaultVisible: true, width: "70px" },
  { id: "saves", label: "Salvos", sortable: true, defaultVisible: true, width: "70px" },
  { id: "engagement_rate", label: "Eng. %", sortable: true, defaultVisible: false, width: "70px" },
  { id: "link_clicks", label: "Cliques Link", sortable: true, defaultVisible: false, width: "95px" },
  { id: "profile_visits", label: "Visitas Perfil", sortable: true, defaultVisible: false, width: "100px" },
  { id: "actions", label: "", sortable: false, defaultVisible: true, width: "60px" },
];

const CONTENT_OBJECTIVES = [
  { value: "educational", label: "Educacional" },
  { value: "entertainment", label: "Entretenimento" },
  { value: "sales", label: "Vendas" },
  { value: "institutional", label: "Institucional" },
  { value: "trend", label: "Trend" },
  { value: "engagement", label: "Engajamento" },
  { value: "awareness", label: "Awareness" },
  { value: "other", label: "Outro" },
];

export function InstagramPostsTableAdvanced({ posts, isLoading, clientId }: InstagramPostsTableAdvancedProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [objectiveFilter, setObjectiveFilter] = useState<string>("all");
  const [collabFilter, setCollabFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("posted_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingPost, setEditingPost] = useState<InstagramPost | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id))
  );
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const { toast } = useToast();
  
  const ITEMS_PER_PAGE = 20;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setObjectiveFilter("all");
    setCollabFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setCurrentPage(1);
  };

  const hasActiveFilters = search || typeFilter !== "all" || objectiveFilter !== "all" || collabFilter !== "all" || dateFrom || dateTo;

  const filteredPosts = useMemo(() => {
    return posts
      .filter((post) => {
        const matchesSearch = !search || 
          post.caption?.toLowerCase().includes(search.toLowerCase());
        const matchesType = typeFilter === "all" || post.post_type === typeFilter;
        const matchesObjective = objectiveFilter === "all" || (post as any).content_objective === objectiveFilter;
        const matchesCollab = collabFilter === "all" || 
          (collabFilter === "yes" && (post as any).is_collab) ||
          (collabFilter === "no" && !(post as any).is_collab);
        
        let matchesDate = true;
        if (post.posted_at) {
          const postDate = startOfDay(parseISO(post.posted_at));
          if (dateFrom && isBefore(postDate, startOfDay(dateFrom))) matchesDate = false;
          if (dateTo && isAfter(postDate, startOfDay(dateTo))) matchesDate = false;
        }
        
        return matchesSearch && matchesType && matchesObjective && matchesCollab && matchesDate;
      })
      .sort((a, b) => {
        const aVal = (a as any)[sortField] || 0;
        const bVal = (b as any)[sortField] || 0;
        if (sortField === "posted_at") {
          const aDate = a.posted_at ? new Date(a.posted_at).getTime() : 0;
          const bDate = b.posted_at ? new Date(b.posted_at).getTime() : 0;
          return sortOrder === "asc" ? aDate - bDate : bDate - aDate;
        }
        if (sortOrder === "asc") {
          return aVal > bVal ? 1 : -1;
        }
        return aVal < bVal ? 1 : -1;
      });
  }, [posts, search, typeFilter, objectiveFilter, collabFilter, dateFrom, dateTo, sortField, sortOrder]);

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

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button 
      variant="ghost" 
      size="sm" 
      className="h-7 px-1.5 text-xs font-medium" 
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field ? (
        sortOrder === "desc" ? <ArrowDown className="ml-1 h-3 w-3" /> : <ArrowUp className="ml-1 h-3 w-3" />
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
      )}
    </Button>
  );

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
      {/* Filters Row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
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

        {/* Type Filter */}
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[120px] h-9">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="image">Imagem</SelectItem>
            <SelectItem value="carousel">Carrossel</SelectItem>
            <SelectItem value="reel">Reel</SelectItem>
            <SelectItem value="story">Story</SelectItem>
          </SelectContent>
        </Select>

        {/* Objective Filter */}
        <Select value={objectiveFilter} onValueChange={(v) => { setObjectiveFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Objetivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos objetivos</SelectItem>
            {CONTENT_OBJECTIVES.map(obj => (
              <SelectItem key={obj.value} value={obj.value}>{obj.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Collab Filter */}
        <Select value={collabFilter} onValueChange={(v) => { setCollabFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[110px] h-9">
            <SelectValue placeholder="Collab" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="yes">Collab</SelectItem>
            <SelectItem value="no">Não collab</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <Calendar className="h-4 w-4" />
              {dateFrom || dateTo ? (
                <span className="text-xs">
                  {dateFrom ? format(dateFrom, "dd/MM") : "..."} - {dateTo ? format(dateTo, "dd/MM") : "..."}
                </span>
              ) : (
                <span className="text-xs">Período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex gap-4 p-4">
              <div>
                <p className="text-xs font-medium mb-2">De</p>
                <CalendarComponent
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  locale={ptBR}
                />
              </div>
              <div>
                <p className="text-xs font-medium mb-2">Até</p>
                <CalendarComponent
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  locale={ptBR}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Column Visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="text-xs">Colunas</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ALL_COLUMNS.filter(c => c.id !== "thumbnail" && c.id !== "actions").map(column => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={visibleColumns.has(column.id)}
                onCheckedChange={() => toggleColumn(column.id)}
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground" onClick={clearFilters}>
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        {filteredPosts.length} posts encontrados
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {visibleColumns.has("thumbnail") && <TableHead style={{ width: "50px" }}></TableHead>}
              {visibleColumns.has("caption") && <TableHead className="min-w-[180px]">Legenda</TableHead>}
              {visibleColumns.has("type") && <TableHead style={{ width: "80px" }}>Tipo</TableHead>}
              {visibleColumns.has("posted_at") && (
                <TableHead style={{ width: "85px" }}>
                  <SortButton field="posted_at">Data</SortButton>
                </TableHead>
              )}
              {visibleColumns.has("impressions") && (
                <TableHead style={{ width: "90px" }} className="text-right">
                  <SortButton field="impressions">Impr.</SortButton>
                </TableHead>
              )}
              {visibleColumns.has("reach") && (
                <TableHead style={{ width: "80px" }} className="text-right">
                  <SortButton field="reach">Alc.</SortButton>
                </TableHead>
              )}
              {visibleColumns.has("likes") && (
                <TableHead style={{ width: "75px" }} className="text-right">
                  <SortButton field="likes">Curt.</SortButton>
                </TableHead>
              )}
              {visibleColumns.has("comments") && (
                <TableHead style={{ width: "95px" }} className="text-right">
                  <SortButton field="comments">Com.</SortButton>
                </TableHead>
              )}
              {visibleColumns.has("shares") && (
                <TableHead style={{ width: "70px" }} className="text-right">
                  <SortButton field="shares">Comp.</SortButton>
                </TableHead>
              )}
              {visibleColumns.has("saves") && (
                <TableHead style={{ width: "70px" }} className="text-right">
                  <SortButton field="saves">Salv.</SortButton>
                </TableHead>
              )}
              {visibleColumns.has("engagement_rate") && (
                <TableHead style={{ width: "70px" }} className="text-right">
                  <SortButton field="engagement_rate">Eng.%</SortButton>
                </TableHead>
              )}
              {visibleColumns.has("link_clicks") && (
                <TableHead style={{ width: "95px" }} className="text-right">
                  <SortButton field="link_clicks">Cliques</SortButton>
                </TableHead>
              )}
              {visibleColumns.has("profile_visits") && (
                <TableHead style={{ width: "100px" }} className="text-right">
                  <SortButton field="profile_visits">Visitas</SortButton>
                </TableHead>
              )}
              {visibleColumns.has("actions") && <TableHead style={{ width: "60px" }}></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPosts.map((post) => (
              <TableRow key={post.id} className="group">
                {visibleColumns.has("thumbnail") && (
                  <TableCell className="py-2">
                    <div className="w-9 h-9 rounded overflow-hidden flex-shrink-0 bg-gradient-to-br from-pink-500 via-purple-500 to-orange-500">
                      {post.thumbnail_url ? (
                        <img 
                          src={post.thumbnail_url} 
                          alt={post.caption?.slice(0, 20) || "Post"} 
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-medium">
                          {post.post_type === 'carousel' ? 'CAR' : 
                           post.post_type === 'reel' ? 'REEL' : 
                           post.post_type === 'story' ? 'ST' : 'IMG'}
                        </div>
                      )}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.has("caption") && (
                  <TableCell className="py-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs line-clamp-2">{post.caption || "Sem legenda"}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {(post as any).content_objective && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">
                              {CONTENT_OBJECTIVES.find(o => o.value === (post as any).content_objective)?.label || (post as any).content_objective}
                            </Badge>
                          )}
                          {(post as any).is_collab && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-500 text-purple-500">
                              <Users className="h-2.5 w-2.5 mr-0.5" />
                              Collab
                            </Badge>
                          )}
                        </div>
                      </div>
                      {post.permalink && (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyToClipboard(post.permalink!); }}
                            title="Copiar link"
                          >
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </Button>
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-accent"
                            title="Abrir no Instagram"
                          >
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </a>
                        </div>
                      )}
                    </div>
                  </TableCell>
                )}
                {visibleColumns.has("type") && (
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {post.post_type || "image"}
                    </Badge>
                  </TableCell>
                )}
                {visibleColumns.has("posted_at") && (
                  <TableCell className="text-xs text-muted-foreground py-2">
                    {post.posted_at ? format(new Date(post.posted_at), "dd/MM/yy", { locale: ptBR }) : "-"}
                  </TableCell>
                )}
                {visibleColumns.has("impressions") && (
                  <TableCell className="text-right text-xs py-2">
                    {post.impressions?.toLocaleString() || "-"}
                  </TableCell>
                )}
                {visibleColumns.has("reach") && (
                  <TableCell className="text-right text-xs py-2">
                    {post.reach?.toLocaleString() || "-"}
                  </TableCell>
                )}
                {visibleColumns.has("likes") && (
                  <TableCell className="text-right font-medium text-xs py-2">
                    {post.likes?.toLocaleString() || 0}
                  </TableCell>
                )}
                {visibleColumns.has("comments") && (
                  <TableCell className="text-right text-xs text-muted-foreground py-2">
                    {post.comments?.toLocaleString() || 0}
                  </TableCell>
                )}
                {visibleColumns.has("shares") && (
                  <TableCell className="text-right text-xs py-2">
                    {post.shares?.toLocaleString() || 0}
                  </TableCell>
                )}
                {visibleColumns.has("saves") && (
                  <TableCell className="text-right text-xs py-2">
                    {post.saves?.toLocaleString() || 0}
                  </TableCell>
                )}
                {visibleColumns.has("engagement_rate") && (
                  <TableCell className="text-right text-xs py-2">
                    {post.engagement_rate ? `${post.engagement_rate.toFixed(2)}%` : "-"}
                  </TableCell>
                )}
                {visibleColumns.has("link_clicks") && (
                  <TableCell className="text-right text-xs py-2">
                    {(post as any).link_clicks?.toLocaleString() || 0}
                  </TableCell>
                )}
                {visibleColumns.has("profile_visits") && (
                  <TableCell className="text-right text-xs py-2">
                    {(post as any).profile_visits?.toLocaleString() || 0}
                  </TableCell>
                )}
                {visibleColumns.has("actions") && (
                  <TableCell className="py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setEditingPost(post)}
                      title="Editar post"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                )}
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

      {/* Edit Dialog */}
      <InstagramPostEditDialog
        post={editingPost}
        open={!!editingPost}
        onOpenChange={(open) => !open && setEditingPost(null)}
        clientId={clientId}
      />
    </div>
  );
}
