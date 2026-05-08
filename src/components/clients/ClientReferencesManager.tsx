import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Plus, Search, Trash2, ExternalLink, Loader2,
  FileText, Video, Mic, BookOpen, MessageSquare, ScrollText,
  Layers, Film, Image as ImageIcon, Mail, AtSign, Eye
} from "lucide-react";
import { useReferenceLibrary, ReferenceItem, ReferenceType } from "@/hooks/useReferenceLibrary";
import { ReferenceGalleryDialog } from "./ReferenceGalleryDialog";

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
}

const REFERENCE_TYPES: { value: ReferenceType; label: string; icon: React.ElementType }[] = [
  { value: "tweet", label: "Tweet/Post", icon: MessageSquare },
  { value: "thread", label: "Thread", icon: ScrollText },
  { value: "article", label: "Artigo", icon: BookOpen },
  { value: "video_script", label: "Roteiro de Vídeo", icon: Video },
  { value: "podcast", label: "Podcast", icon: Mic },
  { value: "newsletter", label: "Newsletter", icon: FileText },
  { value: "other", label: "Outro", icon: FileText },
];

export function ClientReferencesManager({ clientId }: ClientReferencesManagerProps) {
  const { references, isLoading, createReference, updateReference, deleteReference } = useReferenceLibrary(clientId);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<ReferenceItem | null>(null);
  const [galleryRef, setGalleryRef] = useState<ReferenceItem | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [referenceType, setReferenceType] = useState<ReferenceType>("article");
  const [sourceUrl, setSourceUrl] = useState("");

  const filteredReferences = useMemo(() => {
    if (!searchQuery.trim()) return references;
    const query = searchQuery.toLowerCase();
    return references.filter(ref => 
      ref.title.toLowerCase().includes(query) ||
      ref.content.toLowerCase().includes(query) ||
      ref.reference_type.toLowerCase().includes(query)
    );
  }, [references, searchQuery]);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setReferenceType("article");
    setSourceUrl("");
    setEditingRef(null);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;

    if (editingRef) {
      await updateReference.mutateAsync({
        id: editingRef.id,
        data: {
          title,
          content,
          reference_type: referenceType,
          source_url: sourceUrl || null,
        }
      });
    } else {
      await createReference.mutateAsync({
        title,
        content,
        reference_type: referenceType,
        source_url: sourceUrl || null,
      });
    }

    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleEdit = (ref: ReferenceItem) => {
    setEditingRef(ref);
    setTitle(ref.title);
    setContent(ref.content);
    setReferenceType(ref.reference_type);
    setSourceUrl(ref.source_url || "");
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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
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
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogTrigger>
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
      </div>

      {/* References List */}
      {filteredReferences.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma referência encontrada</p>
          <p className="text-xs mt-1">Adicione referências para usar como contexto</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
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

            const openItem = () => {
              if (hasVisual || imagesCount > 0) setGalleryRef(ref);
              else handleEdit(ref);
            };

            return (
              <Card
                key={ref.id}
                className="group cursor-pointer hover:bg-muted/30 transition-colors overflow-hidden"
                onClick={openItem}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail OR icon */}
                    {hasVisual ? (
                      <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted/50 shrink-0">
                        <img
                          src={ref.thumbnail_url ?? undefined}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        {imagesCount > 1 && (
                          <div className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] font-bold px-1 rounded">
                            +{imagesCount}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-muted/50 shrink-0">
                        <FormatIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {fmt ? (
                          <Badge
                            variant="outline"
                            className={`text-[9px] gap-1 ${fmt.class}`}
                          >
                            <FormatIcon className="h-2.5 w-2.5" />
                            {fmt.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px]">
                            {typeInfo.label}
                          </Badge>
                        )}
                        {sourceHandle && (
                          <Badge variant="secondary" className="text-[9px]">
                            @{sourceHandle}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm truncate mt-1">{ref.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {ref.content}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        {(hasVisual || imagesCount > 0) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setGalleryRef(ref);
                            }}
                            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            Ver galeria
                          </button>
                        )}
                        {ref.source_url && (
                          <a
                            href={ref.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Original
                          </a>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ref.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
