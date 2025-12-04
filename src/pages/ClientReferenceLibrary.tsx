import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useReferenceLibrary, ReferenceItem, CreateReferenceData } from "@/hooks/useReferenceLibrary";
import { useClients } from "@/hooks/useClients";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, BookOpen } from "lucide-react";
import { ReferenceCard } from "@/components/references/ReferenceCard";
import { ReferenceDialog } from "@/components/references/ReferenceDialog";
import { ReferenceViewDialog } from "@/components/references/ReferenceViewDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function ClientReferenceLibrary() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { clients } = useClients();
  const { references, isLoading, createReference, updateReference, deleteReference } = useReferenceLibrary(clientId!);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedReference, setSelectedReference] = useState<ReferenceItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [referenceToDelete, setReferenceToDelete] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const client = clients.find((c) => c.id === clientId);

  const handleSave = (data: CreateReferenceData) => {
    if (selectedReference) {
      updateReference.mutate({ id: selectedReference.id, data });
    } else {
      createReference.mutate(data);
    }
    setSelectedReference(null);
  };

  const handleEdit = (reference: ReferenceItem) => {
    setSelectedReference(reference);
    setDialogOpen(true);
  };

  const handleView = (reference: ReferenceItem) => {
    setSelectedReference(reference);
    setViewDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setReferenceToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (referenceToDelete) {
      deleteReference.mutate(referenceToDelete);
      setReferenceToDelete(null);
    }
  };

  const filteredReferences = filterType === "all" 
    ? references 
    : references.filter(r => r.reference_type === filterType);

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
                onClick={() => navigate(`/client/${clientId}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">{client.name}</h1>
                  <p className="text-sm text-muted-foreground">Biblioteca de Referências</p>
                </div>
              </div>
            </div>
            <Button onClick={() => {
              setSelectedReference(null);
              setDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Referência
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
                <SelectItem value="tweet">Tweet</SelectItem>
                <SelectItem value="thread">Thread</SelectItem>
                <SelectItem value="carousel">Carrossel</SelectItem>
                <SelectItem value="stories">Stories</SelectItem>
                <SelectItem value="static_image">Estático Único</SelectItem>
                <SelectItem value="reel">Reel</SelectItem>
                <SelectItem value="short_video">Vídeo Curto</SelectItem>
                <SelectItem value="long_video">Vídeo Longo</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="article">Artigo</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {filteredReferences.length} {filteredReferences.length === 1 ? "referência" : "referências"}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : filteredReferences.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma referência na biblioteca</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Comece adicionando exemplos de conteúdo que você deseja usar como referência
            </p>
            <Button onClick={() => {
              setSelectedReference(null);
              setDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeira Referência
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReferences.map((reference) => (
              <ReferenceCard
                key={reference.id}
                reference={reference}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onView={handleView}
              />
            ))}
          </div>
        )}
      </div>

      <ReferenceDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedReference(null);
        }}
        onSave={handleSave}
        reference={selectedReference || undefined}
      />

      <ReferenceViewDialog
        open={viewDialogOpen}
        onClose={() => {
          setViewDialogOpen(false);
          setSelectedReference(null);
        }}
        reference={selectedReference}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover referência?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A referência será removida permanentemente da biblioteca.
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
