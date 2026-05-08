import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  Trash2,
  Loader2,
  RefreshCw,
  Globe,
  Instagram,
  Music2,
  Youtube,
  Twitter,
  Mail,
  Radar as RadarIcon,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────
const SOURCE_TYPES = [
  "rss",
  "instagram",
  "tiktok",
  "youtube",
  "twitter",
  "newsletter",
] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

interface TrackedSource {
  id: string;
  workspace_id: string | null;
  client_id: string | null;
  source_type: SourceType;
  source_url: string;
  source_name: string | null;
  category: string | null;
  niche: string | null;
  is_active: boolean;
  last_scraped_at: string | null;
  created_at: string;
}

interface SourceFormData {
  source_type: SourceType;
  source_url: string;
  source_name: string;
  category: string;
  niche: string;
}

const TYPE_ICONS: Record<SourceType, React.ReactNode> = {
  rss: <Globe className="h-3.5 w-3.5" />,
  instagram: <Instagram className="h-3.5 w-3.5" />,
  tiktok: <Music2 className="h-3.5 w-3.5" />,
  youtube: <Youtube className="h-3.5 w-3.5" />,
  twitter: <Twitter className="h-3.5 w-3.5" />,
  newsletter: <Mail className="h-3.5 w-3.5" />,
};

const TYPE_COLORS: Record<SourceType, string> = {
  rss: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  instagram: "bg-pink-500/10 text-pink-600 border-pink-500/30",
  tiktok: "bg-zinc-500/10 text-zinc-600 border-zinc-500/30",
  youtube: "bg-red-500/10 text-red-600 border-red-500/30",
  twitter: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  newsletter: "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

const EMPTY_FORM: SourceFormData = {
  source_type: "rss",
  source_url: "",
  source_name: "",
  category: "",
  niche: "",
};

// `viral_tracked_sources` ainda não está nos types gerados do Supabase.
// `as any` em from() é o escape hatch padrão usado em outras partes do app
// pra tabelas novas que ainda não foram regeneradas no codegen.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sourcesTable = () => (supabase as any).from("viral_tracked_sources");

export function RadarSourcesManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState<SourceFormData>(EMPTY_FORM);
  const [pendingDelete, setPendingDelete] = useState<TrackedSource | null>(null);

  // ─── Fetch ────────────────────────────────────────────────────────────
  const {
    data: sources = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["radar-tracked-sources"],
    queryFn: async (): Promise<TrackedSource[]> => {
      const { data, error } = await sourcesTable()
        .select("*")
        .order("source_type", { ascending: true })
        .order("source_name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as TrackedSource[];
    },
  });

  // ─── Mutations ────────────────────────────────────────────────────────
  const createSource = useMutation({
    mutationFn: async (payload: SourceFormData) => {
      const { error } = await sourcesTable().insert({
        source_type: payload.source_type,
        source_url: payload.source_url.trim(),
        source_name: payload.source_name.trim() || null,
        category: payload.category.trim() || null,
        niche: payload.niche.trim() || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radar-tracked-sources"] });
      toast.success("Fonte adicionada");
      setCreateOpen(false);
      setFormData(EMPTY_FORM);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao criar fonte";
      toast.error(msg);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await sourcesTable()
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radar-tracked-sources"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar fonte";
      toast.error(msg);
    },
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sourcesTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radar-tracked-sources"] });
      toast.success("Fonte removida");
      setPendingDelete(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao remover fonte";
      toast.error(msg);
    },
  });

  // ─── Derived ──────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of sources) if (s.category) set.add(s.category);
    return Array.from(set).sort();
  }, [sources]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sources.filter((s) => {
      if (filterType !== "all" && s.source_type !== filterType) return false;
      if (filterCategory !== "all" && s.category !== filterCategory) return false;
      if (filterStatus === "active" && !s.is_active) return false;
      if (filterStatus === "inactive" && s.is_active) return false;
      if (!q) return true;
      const haystack = [
        s.source_name ?? "",
        s.source_url,
        s.category ?? "",
        s.niche ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sources, search, filterType, filterCategory, filterStatus]);

  const stats = useMemo(() => {
    const total = sources.length;
    const active = sources.filter((s) => s.is_active).length;
    const byType = SOURCE_TYPES.reduce<Record<string, number>>((acc, t) => {
      acc[t] = sources.filter((s) => s.source_type === t).length;
      return acc;
    }, {});
    return { total, active, byType };
  }, [sources]);

  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <RadarIcon className="h-6 w-6" />
            Radar — Fontes Monitoradas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fontes que os crons do Radar Viral usam pra popular news, IG, TikTok e briefs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova fonte
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-emerald-600">
              {stats.active}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              RSS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{stats.byType.rss ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Sociais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {(stats.byType.instagram ?? 0) +
                (stats.byType.tiktok ?? 0) +
                (stats.byType.youtube ?? 0) +
                (stats.byType.twitter ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, URL, categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {SOURCE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="inactive">Inativas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="flex-1">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {sources.length === 0
                ? "Nenhuma fonte cadastrada ainda."
                : "Nenhuma fonte bate com os filtros."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Tipo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">URL</TableHead>
                  <TableHead className="hidden lg:table-cell">Categoria</TableHead>
                  <TableHead className="hidden lg:table-cell">Último scrape</TableHead>
                  <TableHead className="w-[80px]">Ativa</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${TYPE_COLORS[s.source_type]} flex w-fit items-center gap-1.5 text-[11px] uppercase tracking-wide`}
                      >
                        {TYPE_ICONS[s.source_type]}
                        {s.source_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {s.source_name || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-[280px]">
                      <a
                        href={s.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground truncate block"
                      >
                        {s.source_url}
                      </a>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {s.category ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {s.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {s.last_scraped_at
                        ? formatDistanceToNow(new Date(s.last_scraped_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })
                        : "Nunca"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={s.is_active}
                        disabled={toggleActive.isPending}
                        onCheckedChange={(checked) =>
                          toggleActive.mutate({
                            id: s.id,
                            is_active: checked,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingDelete(s)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova fonte</DialogTitle>
            <DialogDescription>
              Adicione uma fonte para os crons do Radar monitorarem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.source_type}
                onValueChange={(v) =>
                  setFormData({ ...formData, source_type: v as SourceType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>URL *</Label>
              <Input
                placeholder="https://example.com/feed"
                value={formData.source_url}
                onChange={(e) =>
                  setFormData({ ...formData, source_url: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Ex: CoinDesk"
                value={formData.source_name}
                onChange={(e) =>
                  setFormData({ ...formData, source_name: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  placeholder="Ex: crypto"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Nicho</Label>
                <Input
                  placeholder="Ex: defi"
                  value={formData.niche}
                  onChange={(e) =>
                    setFormData({ ...formData, niche: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setFormData(EMPTY_FORM);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createSource.mutate(formData)}
              disabled={!formData.source_url.trim() || createSource.isPending}
            >
              {createSource.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover fonte?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.source_name || pendingDelete?.source_url} será
              removida permanentemente. Os artigos já scrapeados continuam no DB.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteSource.mutate(pendingDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
