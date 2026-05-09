import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Search, Trash2, ExternalLink, Loader2, Edit,
  FileText, Video, Mic, BookOpen, MessageSquare, ScrollText,
  Layers, Film, Image as ImageIcon, Mail, AtSign, Eye, Filter, Hash, X as XIcon
} from "lucide-react";
import { useReferenceLibrary, ReferenceItem, ReferenceType } from "@/hooks/useReferenceLibrary";
import { ReferenceGalleryDialog } from "./ReferenceGalleryDialog";
import { CrossAppActions } from "@/components/kai/viral/CrossAppActions";

const FORMAT_CHIP: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; class: string }
> = {
  carousel: { label: "Carrossel", icon: Layers, class: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
  reel: { label: "Reel", icon: Film, class: "bg-rose-500/10 text-rose-600 border-rose-500/30" },
  static: { label: "Imagem única", icon: ImageIcon, class: "bg-sky-500/10 text-sky-600 border-sky-500/30" },
  tweet: { label: "Tweet", icon: AtSign, class: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30" },
  thread: { label: "Thread", icon: ScrollText, class: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30" },
  newsletter: { label: "Newsletter", icon: Mail, class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  article: { label: "Artigo", icon: BookOpen, class: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  email: { label: "Email mkt", icon: Mail, class: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
};

interface ClientReferencesManagerProps {
  clientId: string;
  /**
   * Quando passado, esconde o header interno (search + botão Adicionar)
   * e usa essa string como filtro de busca. Permite controle externo
   * a partir do KaiLibraryTab (search global da Biblioteca).
   */
  externalSearchQuery?: string;
}

const FORMAT_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos formatos" },
  { value: "carousel", label: "Carrossel" },
  { value: "reel", label: "Reel" },
  { value: "static", label: "Imagem única" },
  { value: "tweet", label: "Tweet" },
  { value: "thread", label: "Thread" },
  { value: "newsletter", label: "Newsletter" },
  { value: "article", label: "Artigo" },
  { value: "email", label: "Email mkt" },
];

const REFERENCE_TYPES: { value: ReferenceType; label: string; icon: React.ElementType }[] = [
  { value: "tweet", label: "Tweet/Post", icon: MessageSquare },
  { value: "thread", label: "Thread", icon: ScrollText },
  { value: "article", label: "Artigo", icon: BookOpen },
  { value: "video_script", label: "Roteiro de Vídeo", icon: Video },
  { value: "podcast", label: "Podcast", icon: Mic },
  { value: "newsletter", label: "Newsletter", icon: FileText },
  { value: "other", label: "Outro", icon: FileText },
];

export function ClientReferencesManager({ clientId, externalSearchQuery }: ClientReferencesManagerProps) {
  const { references, isLoading, createReference, updateReference, deleteReference } = useReferenceLibrary(clientId);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const isExternallyControlled = typeof externalSearchQuery === "string";
  const searchQuery = isExternallyControlled ? (externalSearchQuery as string) : internalSearchQuery;
  const setSearchQuery = (v: string) => setInternalSearchQuery(v);

  // Filters
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<ReferenceItem | null>(null);
  const [galleryRef, setGalleryRef] = useState<ReferenceItem | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [referenceType, setReferenceType] = useState<ReferenceType>("article");
  const [sourceUrl, setSourceUrl] = useState("");
  const [format, setFormat] = useState<string>("static");
  const [tagsInput, setTagsInput] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [sourceHandle, setSourceHandle] = useState("");

  // Tags agregadas: top 12 tags únicas das refs (caímos de cardinality alta)
  const availableTags = useMemo(() => {
    const counter = new Map<string, number>();
    for (const ref of references) {
      const meta = (ref.metadata as Record<string, any> | null) ?? {};
      const tags = Array.isArray(meta.tags) ? (meta.tags as unknown[]) : [];
      for (const t of tags) {
        if (typeof t !== "string") continue;
        const norm = t.trim();
        if (!norm) continue;
        // Filtra tags lixo (são chips cosméticos: format/swipe/inspiration)
        if (["swipe", "inspiration", "carousel", "reel", "static", "tweet", "thread", "newsletter", "article", "email"].includes(norm.toLowerCase())) continue;
        counter.set(norm, (counter.get(norm) ?? 0) + 1);
      }
    }
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }));
  }, [references]);

  const filteredReferences = useMemo(() => {
    let result = references;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((ref) => {
        const meta = (ref.metadata as Record<string, any> | null) ?? {};
        const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
        const transcribed = (meta.transcribed_text as string | undefined) ?? "";
        const sourceHandle = (meta.source_handle as string | undefined) ?? "";
        return (
          ref.title.toLowerCase().includes(q) ||
          ref.content.toLowerCase().includes(q) ||
          ref.reference_type.toLowerCase().includes(q) ||
          transcribed.toLowerCase().includes(q) ||
          sourceHandle.toLowerCase().includes(q) ||
          tags.some((t) => typeof t === "string" && t.toLowerCase().includes(q))
        );
      });
    }
    if (formatFilter !== "all") {
      result = result.filter((ref) => {
        const meta = (ref.metadata as Record<string, any> | null) ?? {};
        const fmt = (meta.format as string | undefined) ?? ref.reference_type;
        return fmt === formatFilter;
      });
    }
    if (activeTags.size > 0) {
      result = result.filter((ref) => {
        const meta = (ref.metadata as Record<string, any> | null) ?? {};
        const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
        const norm = new Set(tags.filter((t) => typeof t === "string").map((t) => t.toLowerCase()));
        for (const tag of activeTags) {
          if (!norm.has(tag.toLowerCase())) return false;
        }
        return true;
      });
    }
    return result;
  }, [references, searchQuery, formatFilter, activeTags]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const clearFilters = () => {
    setFormatFilter("all");
    setActiveTags(new Set());
    if (!isExternallyControlled) setInternalSearchQuery("");
  };

  const hasActiveFilters =
    formatFilter !== "all" || activeTags.size > 0 || (searchQuery.trim().length > 0);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setReferenceType("article");
    setSourceUrl("");
    setFormat("static");
    setTagsInput("");
    setThumbnailUrl("");
    setSourceHandle("");
    setEditingRef(null);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    const tagsArr = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const existingMeta = (editingRef?.metadata as Record<string, any> | null) ?? {};
    const newMetadata = {
      ...existingMeta,
      format,
      tags: tagsArr.length > 0 ? tagsArr : existingMeta.tags ?? [],
      ...(sourceHandle ? { source_handle: sourceHandle } : {}),
    };

    if (editingRef) {
      await updateReference.mutateAsync({
        id: editingRef.id,
        data: {
          title,
          content,
          reference_type: referenceType,
          source_url: sourceUrl || null,
          thumbnail_url: thumbnailUrl || null,
          metadata: newMetadata,
        } as any,
      });
    } else {
      await createReference.mutateAsync({
        title,
        content,
        reference_type: referenceType,
        source_url: sourceUrl || null,
        thumbnail_url: thumbnailUrl || null,
        metadata: newMetadata,
      } as any);
    }

    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleEdit = (ref: ReferenceItem) => {
    const meta = (ref.metadata as Record<string, any> | null) ?? {};
    setEditingRef(ref);
    setTitle(ref.title);
    setContent(ref.content);
    setReferenceType(ref.reference_type);
    setSourceUrl(ref.source_url || "");
    setThumbnailUrl(ref.thumbnail_url || "");
    setFormat((meta.format as string) ?? "static");
    setSourceHandle((meta.source_handle as string) ?? "");
    setTagsInput(
      Array.isArray(meta.tags)
        ? (meta.tags as string[]).join(", ")
        : "",
    );
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteReference.mutateAsync(id);
  };

  const getTypeInfo = (type: string) => {
    return REFERENCE_TYPES.find(t => t.value === type) || REFERENCE_TYPES[REFERENCE_TYPES.length - 1];
  };

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Carregando referências"
        className="space-y-4"
      >
        {/* Header skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-28" />
        </div>
        {/* Cards grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
        <span className="sr-only">Carregando referências…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header — escondido quando controlado externamente */}
      {!isExternallyControlled && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar referências..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      )}

      {/* Filters bar — sempre visível */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Format filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              <span className="text-xs">
                {FORMAT_FILTERS.find((f) => f.value === formatFilter)?.label ?? "Formato"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs">Filtrar por formato</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {FORMAT_FILTERS.map((f) => (
              <DropdownMenuItem
                key={f.value}
                onClick={() => setFormatFilter(f.value)}
                className="text-xs"
              >
                {f.label}
                {formatFilter === f.value && (
                  <Badge variant="secondary" className="ml-auto text-[9px]">ativo</Badge>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tags chips inline (top 12) */}
        {availableTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Hash className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            {availableTags.map(({ tag, count }) => {
              const active = activeTags.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                  aria-pressed={active}
                >
                  {tag}
                  <span className="opacity-60 tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 ml-auto"
            onClick={clearFilters}
          >
            <XIcon className="h-3 w-3" />
            Limpar filtros
          </Button>
        )}

        {/* Add button — só aparece quando NÃO é controlado (header dele tem proprio) */}
        {!isExternallyControlled && (
          <div className="ml-auto">
            <Button
              size="sm"
              className="h-8"
              onClick={() => {
                resetForm();
                setIsAddDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        )}
      </div>

      {/* Edit/Add Dialog — controlado por isAddDialogOpen, sem DialogTrigger */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingRef ? "Editar Referência" : "Nova Referência"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Thread sobre produtividade"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={referenceType} onValueChange={(value) => setReferenceType(value as ReferenceType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERENCE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Cole ou escreva o conteúdo da referência..."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label>URL de Origem (opcional)</Label>
                <Input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Formato</Label>
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="carousel">Carrossel</SelectItem>
                      <SelectItem value="reel">Reel</SelectItem>
                      <SelectItem value="static">Imagem única</SelectItem>
                      <SelectItem value="tweet">Tweet</SelectItem>
                      <SelectItem value="thread">Thread</SelectItem>
                      <SelectItem value="newsletter">Newsletter</SelectItem>
                      <SelectItem value="article">Artigo</SelectItem>
                      <SelectItem value="email">Email mkt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Handle origem (opcional)</Label>
                  <Input
                    value={sourceHandle}
                    onChange={(e) => setSourceHandle(e.target.value)}
                    placeholder="@criador"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tags (separadas por vírgula)</Label>
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="ex: viral, hook, marketing"
                />
              </div>

              <div className="space-y-2">
                <Label>URL Thumbnail (opcional)</Label>
                <Input
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://blob.vercel-storage.com/..."
                />
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt="preview"
                    className="w-20 h-20 object-cover rounded-md border mt-2"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    resetForm();
                    setIsAddDialogOpen(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={!title.trim() || !content.trim() || createReference.isPending || updateReference.isPending}
                >
                  {(createReference.isPending || updateReference.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingRef ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* References List */}
      {filteredReferences.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed border-border/60 rounded-lg">
          <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium text-foreground/80">
            {searchQuery ? "Nenhuma referência encontrada" : "Nenhuma referência ainda"}
          </p>
          <p className="text-xs mt-1 max-w-sm mx-auto">
            {searchQuery
              ? "Tente outros termos ou limpe a busca."
              : "Adicione referências (tweets, threads, artigos) para a kAI usar como contexto criativo."}
          </p>
          {!searchQuery && (
            <Button
              size="sm"
              variant="outline"
              className="mt-4 gap-1.5"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Adicionar primeira referência
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[640px] overflow-y-auto pr-1">
          {filteredReferences.map((ref) => {
            const typeInfo = getTypeInfo(ref.reference_type);
            const Icon = typeInfo.icon;
            const refMeta = (ref.metadata as Record<string, any> | null) ?? {};
            const fmtKey = (refMeta.format as string) ?? ref.reference_type;
            const fmt = FORMAT_CHIP[fmtKey] ?? null;
            const FormatIcon = fmt?.icon ?? Icon;
            const imagesCount = Array.isArray(refMeta.images)
              ? (refMeta.images as string[]).length
              : 0;
            const sourceHandle = refMeta.source_handle as string | undefined;
            const hasVisual = !!ref.thumbnail_url;
            const transcribed = (refMeta.transcribed_text as string | undefined) ?? "";
            const briefingForBridge =
              [ref.title, transcribed || ref.content].filter(Boolean).join("\n\n");

            const openItem = () => {
              if (hasVisual || imagesCount > 0) setGalleryRef(ref);
              else handleEdit(ref);
            };

            return (
              <Card
                key={ref.id}
                className="group cursor-pointer overflow-hidden flex flex-col hover:border-primary/40 transition-colors"
              >
                {/* Image cover — ocupa o card todo */}
                <div
                  className="relative aspect-square w-full bg-muted overflow-hidden"
                  onClick={openItem}
                >
                  {hasVisual ? (
                    <img
                      src={ref.thumbnail_url ?? undefined}
                      alt={ref.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = "0";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/60">
                      <FormatIcon className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                  )}

                  {/* Format chip top-left */}
                  {fmt && (
                    <Badge
                      variant="outline"
                      className={`absolute top-2 left-2 text-[10px] gap-1 backdrop-blur-sm bg-background/90 border ${fmt.class}`}
                    >
                      <FormatIcon className="h-2.5 w-2.5" />
                      {fmt.label}
                    </Badge>
                  )}

                  {/* +N images badge top-right */}
                  {imagesCount > 1 && (
                    <Badge
                      variant="secondary"
                      className="absolute top-2 right-2 text-[10px] backdrop-blur-sm bg-background/90"
                    >
                      <Eye className="h-2.5 w-2.5 mr-0.5" />
                      {imagesCount}
                    </Badge>
                  )}

                  {/* Edit + Delete buttons — visible on hover */}
                  <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Editar"
                      aria-label="Editar referência"
                      className="h-7 w-7 p-0 backdrop-blur-sm bg-background/90 hover:bg-primary hover:text-primary-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(ref);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Excluir"
                      aria-label="Excluir referência"
                      className="h-7 w-7 p-0 backdrop-blur-sm bg-background/90 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ref.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Body — title + handle + CrossAppActions */}
                <CardContent className="p-3 flex flex-col gap-2 flex-1">
                  <div className="flex flex-col gap-1 cursor-pointer" onClick={openItem}>
                    <p className="font-medium text-xs leading-snug line-clamp-2">
                      {ref.title}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {sourceHandle && (
                        <Badge variant="secondary" className="text-[9px]">
                          @{sourceHandle}
                        </Badge>
                      )}
                      {Array.isArray(refMeta.tags) &&
                        (refMeta.tags as string[])
                          .filter((t) => !["swipe", "inspiration", fmtKey].includes(t))
                          .slice(0, 3)
                          .map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-[9px] py-0 px-1.5"
                            >
                              {tag}
                            </Badge>
                          ))}
                    </div>
                  </div>

                  {/* CrossAppActions — base pra Carrossel/Reels Viral */}
                  <div className="mt-auto pt-2 border-t border-border/50">
                    <CrossAppActions
                      source="library"
                      topic={ref.title}
                      briefing={briefingForBridge}
                      url={ref.source_url ?? undefined}
                      clientId={clientId}
                      metadata={{
                        ...refMeta,
                        thumbnail_url: ref.thumbnail_url,
                        reference_id: ref.id,
                      }}
                      showIdea={false}
                      showLibrary={false}
                      size="sm"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Gallery viewer pra refs com imagens */}
      <ReferenceGalleryDialog
        reference={galleryRef}
        open={galleryRef !== null}
        onOpenChange={(o) => {
          if (!o) setGalleryRef(null);
        }}
      />
    </div>
  );
}
