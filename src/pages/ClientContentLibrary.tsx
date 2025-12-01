import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useContentLibrary, ContentItem, CreateContentData } from "@/hooks/useContentLibrary";
import { useClients } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Library } from "lucide-react";
import { ContentCard } from "@/components/content/ContentCard";
import { ContentDialog } from "@/components/content/ContentDialog";
import { ContentViewDialog } from "@/components/content/ContentViewDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function ClientContentLibrary() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { clients } = useClients();
  const { contents, isLoading, createContent, updateContent, deleteContent } = useContentLibrary(clientId!);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contentToDelete, setContentToDelete] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const client = clients.find((c) => c.id === clientId);

  const handleSave = (data: CreateContentData) => {
    if (selectedContent) {
      updateContent.mutate({ id: selectedContent.id, data });
    } else {
      createContent.mutate(data);
    }
    setSelectedContent(null);
  };

  const handleEdit = (content: ContentItem) => {
    setSelectedContent(content);
    setDialogOpen(true);
  };

  const handleView = (content: ContentItem) => {
    setSelectedContent(content);
    setViewDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setContentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (contentToDelete) {
      deleteContent.mutate(contentToDelete);
      setContentToDelete(null);
    }
  };

  const filteredContents = filterType === "all" 
    ? contents 
    : contents.filter(c => c.content_type === filterType);

  if (!client) {
    return <div>Cliente não encontrado</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/clients/${clientId}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-3">
                <Library className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">{client.name}</h1>
                  <p className="text-sm text-muted-foreground">Biblioteca de Conteúdos</p>
                </div>
              </div>
            </div>
            <Button onClick={() => {
              setSelectedContent(null);
              setDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Conteúdo
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="newsletter">Newsletter</SelectItem>
                <SelectItem value="carousel">Carrossel</SelectItem>
                <SelectItem value="reel_script">Roteiro Reels</SelectItem>
                <SelectItem value="video_script">Roteiro Vídeo</SelectItem>
                <SelectItem value="blog_post">Post Blog</SelectItem>
                <SelectItem value="social_post">Post Social</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {filteredContents.length} {filteredContents.length === 1 ? "conteúdo" : "conteúdos"}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : filteredContents.length === 0 ? (
          <div className="text-center py-12">
            <Library className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum conteúdo na biblioteca</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Comece adicionando conteúdos que você criou para este cliente
            </p>
            <Button onClick={() => {
              setSelectedContent(null);
              setDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Conteúdo
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContents.map((content) => (
              <ContentCard
                key={content.id}
                content={content}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onView={handleView}
              />
            ))}
          </div>
        )}
      </div>

      <ContentDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedContent(null);
        }}
        onSave={handleSave}
        content={selectedContent || undefined}
      />

      <ContentViewDialog
        open={viewDialogOpen}
        onClose={() => {
          setViewDialogOpen(false);
          setSelectedContent(null);
        }}
        content={selectedContent}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conteúdo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O conteúdo será removido permanentemente da biblioteca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
