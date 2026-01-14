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
  FileText, Video, Mic, BookOpen, MessageSquare, ScrollText
} from "lucide-react";
import { useReferenceLibrary, ReferenceItem, ReferenceType } from "@/hooks/useReferenceLibrary";

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
            
            return (
              <Card 
                key={ref.id} 
                className="group cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => handleEdit(ref)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted/50 shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{ref.title}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {typeInfo.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {ref.content}
                      </p>
                      {ref.source_url && (
                        <a
                          href={ref.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver original
                        </a>
                      )}
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
    </div>
  );
}
