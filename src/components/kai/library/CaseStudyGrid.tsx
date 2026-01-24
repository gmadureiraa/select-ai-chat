import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BookOpen, FileBarChart, Plus, Search, Edit, Trash2, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { useContentLibrary } from "@/hooks/useContentLibrary";
import { ContentPreviewDialog } from "./ContentPreviewDialog";
import { ContentEditDialog } from "./ContentEditDialog";
import { useUpdateUnifiedContent, UnifiedContentItem } from "@/hooks/useUnifiedContent";
import { ContentItem } from "@/hooks/useContentLibrary";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CaseStudyGridProps {
  clientId: string;
  type: 'case_study' | 'report';
  onAddNew: () => void;
}

export function CaseStudyGrid({ clientId, type, onAddNew }: CaseStudyGridProps) {
  const { contents: content, isLoading, deleteContent } = useContentLibrary(clientId);
  const updateContent = useUpdateUnifiedContent(clientId);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewItem, setPreviewItem] = useState<UnifiedContentItem | null>(null);
  const [editItem, setEditItem] = useState<UnifiedContentItem | null>(null);

  // Filter content by type
  const filteredContent = content
    ?.filter(item => item.content_type === type)
    .filter(item => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query)
      );
    }) || [];

  const typeLabel = type === 'case_study' ? 'Estudo de Caso' : 'Relatório';
  const TypeIcon = type === 'case_study' ? BookOpen : FileBarChart;
  const emptyMessage = type === 'case_study' 
    ? 'Nenhum estudo de caso cadastrado' 
    : 'Nenhum relatório cadastrado';

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Excluir este ${typeLabel.toLowerCase()}?`)) return;
    try {
      await deleteContent.mutateAsync(id);
      toast.success(`${typeLabel} excluído`);
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  // Convert to UnifiedContentItem for preview
  const toUnifiedItem = (item: ContentItem): UnifiedContentItem => ({
    id: item.id,
    platform: 'content',
    title: item.title,
    content: item.content,
    thumbnail_url: item.thumbnail_url || undefined,
    posted_at: item.created_at || new Date().toISOString(),
    is_favorite: false,
    content_type: item.content_type,
    metrics: { likes: 0, comments: 0, shares: 0 },
    _source: 'client_content_library',
  });

  const handleEditSave = async (data: { title?: string; content?: string; content_url?: string }) => {
    if (!editItem) return;
    await updateContent.mutateAsync({ item: editItem, data });
    setEditItem(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Search & Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Buscar ${typeLabel.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={onAddNew} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Novo {typeLabel}
        </Button>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-y-auto">
        {filteredContent.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <TypeIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm">{emptyMessage}</p>
            <Button variant="outline" className="mt-4" onClick={onAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Criar {typeLabel}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContent.map((item) => (
              <Card 
                key={item.id} 
                className="group hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                onClick={() => setPreviewItem(toUnifiedItem(item))}
              >
                {/* Cover image if exists */}
                {item.thumbnail_url && (
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img 
                      src={item.thumbnail_url} 
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm line-clamp-2">{item.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.created_at && format(new Date(item.created_at), "dd MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      <TypeIcon className="h-3 w-3 mr-1" />
                      {type === 'case_study' ? 'Case' : 'Report'}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  {/* Content preview */}
                  <div className="prose prose-sm dark:prose-invert max-w-none line-clamp-3 text-xs text-muted-foreground">
                    <ReactMarkdown>{item.content.substring(0, 200)}</ReactMarkdown>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewItem(toUnifiedItem(item));
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Ver
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditItem(toUnifiedItem(item));
                      }}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <ContentPreviewDialog
        item={previewItem}
        open={!!previewItem}
        onOpenChange={(open) => !open && setPreviewItem(null)}
        onEdit={() => {
          if (previewItem) {
            setEditItem(previewItem);
            setPreviewItem(null);
          }
        }}
      />

      {/* Edit Dialog */}
      <ContentEditDialog
        item={editItem}
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
        onSave={handleEditSave}
        isLoading={updateContent.isPending}
      />
    </div>
  );
}
