import { useState, useMemo } from "react";
import { Library, FileText, Link2, Plus, Search, Instagram, Trash2, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useContentLibrary, ContentItem, CreateContentData } from "@/hooks/useContentLibrary";
import { useReferenceLibrary, ReferenceItem, CreateReferenceData } from "@/hooks/useReferenceLibrary";
import { useImageGenerations } from "@/hooks/useImageGenerations";
import { ContentCard } from "@/components/content/ContentCard";
import { ContentDialog } from "@/components/content/ContentDialog";
import { ContentViewDialog } from "@/components/content/ContentViewDialog";
import { ReferenceCard } from "@/components/references/ReferenceCard";
import { ReferenceDialog } from "@/components/references/ReferenceDialog";
import { ReferenceViewDialog } from "@/components/references/ReferenceViewDialog";
import { InstagramCarouselImporter } from "@/components/images/InstagramCarouselImporter";
import { ImageGallery } from "@/components/posts/ImageGallery";
import { LibraryFilters, ContentTypeFilter, SortOption, ViewMode } from "@/components/kai2/LibraryFilters";
import { Client } from "@/hooks/useClients";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface KaiLibraryTabProps {
  clientId: string;
  client: Client;
}

export const KaiLibraryTab = ({ clientId, client }: KaiLibraryTabProps) => {
  const [activeTab, setActiveTab] = useState("content");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filters state
  const [typeFilter, setTypeFilter] = useState<ContentTypeFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Content Library
  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [contentViewOpen, setContentViewOpen] = useState(false);
  const { contents, createContent, updateContent, deleteContent } = useContentLibrary(clientId);

  // Reference Library
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  const [selectedReference, setSelectedReference] = useState<ReferenceItem | null>(null);
  const [referenceViewOpen, setReferenceViewOpen] = useState(false);

  // Instagram Importer
  const [instagramImporterOpen, setInstagramImporterOpen] = useState(false);
  const { references, createReference, updateReference, deleteReference } = useReferenceLibrary(clientId);

  // Image Gallery
  const { generations } = useImageGenerations(clientId);

  // Filter and sort content
  const filteredContents = useMemo(() => {
    let result = contents || [];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.title.toLowerCase().includes(query) ||
        c.content.toLowerCase().includes(query)
      );
    }
    
    // Type filter
    if (typeFilter !== "all") {
      result = result.filter(c => c.content_type === typeFilter);
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case "newest":
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case "oldest":
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        case "a-z":
          return a.title.localeCompare(b.title);
        case "z-a":
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });
    
    return result;
  }, [contents, searchQuery, typeFilter, sortOption]);

  const filteredReferences = useMemo(() => {
    let result = references || [];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.title.toLowerCase().includes(query) ||
        r.content.toLowerCase().includes(query)
      );
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case "newest":
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case "oldest":
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        case "a-z":
          return a.title.localeCompare(b.title);
        case "z-a":
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });
    
    return result;
  }, [references, searchQuery, sortOption]);

  const handleSaveContent = (data: CreateContentData) => {
    if (selectedContent) {
      updateContent.mutate({ id: selectedContent.id, data });
    } else {
      createContent.mutate(data);
    }
    setContentDialogOpen(false);
    setSelectedContent(null);
  };

  const handleSaveReference = (data: CreateReferenceData) => {
    if (selectedReference) {
      updateReference.mutate({ id: selectedReference.id, data });
    } else {
      createReference.mutate(data);
    }
    setReferenceDialogOpen(false);
    setSelectedReference(null);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleClearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return;
    
    const confirmDelete = window.confirm(`Excluir ${selectedItems.size} item(s) selecionado(s)?`);
    if (!confirmDelete) return;

    try {
      const deletePromises = Array.from(selectedItems).map(id => {
        if (activeTab === "content") {
          return deleteContent.mutateAsync(id);
        } else {
          return deleteReference.mutateAsync(id);
        }
      });
      
      await Promise.all(deletePromises);
      setSelectedItems(new Set());
      toast.success(`${selectedItems.size} item(s) excluído(s)`);
    } catch (error) {
      toast.error("Erro ao excluir itens");
    }
  };

  const renderContentItem = (content: ContentItem) => {
    const isSelected = selectedItems.has(content.id);
    
    if (viewMode === "list") {
      return (
        <div
          key={content.id}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border transition-colors",
            isSelected ? "bg-primary/5 border-primary/30" : "bg-card hover:bg-muted/50"
          )}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelection(content.id)}
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{content.title}</p>
            <p className="text-xs text-muted-foreground truncate">{content.content.slice(0, 100)}...</p>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {content.content_type}
          </Badge>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedContent(content);
                setContentViewOpen(true);
              }}
            >
              Ver
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedContent(content);
                setContentDialogOpen(true);
              }}
            >
              Editar
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div key={content.id} className="relative group">
        <div className={cn(
          "absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity",
          isSelected && "opacity-100"
        )}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelection(content.id)}
            className="bg-background"
          />
        </div>
        <ContentCard
          content={content}
          onView={() => {
            setSelectedContent(content);
            setContentViewOpen(true);
          }}
          onEdit={() => {
            setSelectedContent(content);
            setContentDialogOpen(true);
          }}
          onDelete={() => deleteContent.mutate(content.id)}
        />
      </div>
    );
  };

  const renderReferenceItem = (reference: ReferenceItem) => {
    const isSelected = selectedItems.has(reference.id);
    
    if (viewMode === "list") {
      return (
        <div
          key={reference.id}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border transition-colors",
            isSelected ? "bg-primary/5 border-primary/30" : "bg-card hover:bg-muted/50"
          )}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelection(reference.id)}
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{reference.title}</p>
            <p className="text-xs text-muted-foreground truncate">{reference.content.slice(0, 100)}...</p>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {reference.reference_type}
          </Badge>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedReference(reference);
                setReferenceViewOpen(true);
              }}
            >
              Ver
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedReference(reference);
                setReferenceDialogOpen(true);
              }}
            >
              Editar
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div key={reference.id} className="relative group">
        <div className={cn(
          "absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity",
          isSelected && "opacity-100"
        )}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelection(reference.id)}
            className="bg-background"
          />
        </div>
        <ReferenceCard
          reference={reference}
          onView={() => {
            setSelectedReference(reference);
            setReferenceViewOpen(true);
          }}
          onEdit={() => {
            setSelectedReference(reference);
            setReferenceDialogOpen(true);
          }}
          onDelete={() => deleteReference.mutate(reference.id)}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Library className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Biblioteca</h2>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full sm:w-56 lg:w-64"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setInstagramImporterOpen(true)}
            className="shrink-0"
          >
            <Instagram className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Importar Instagram</span>
            <span className="sm:hidden">Instagram</span>
          </Button>
          <Button
            onClick={() => {
              if (activeTab === "content") {
                setSelectedContent(null);
                setContentDialogOpen(true);
              } else {
                setSelectedReference(null);
                setReferenceDialogOpen(true);
              }
            }}
            className="shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Adicionar</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedItems(new Set()); }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList>
            <TabsTrigger value="content" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Conteúdo</span>
              <Badge variant="secondary" className="ml-1">{contents?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="references" className="gap-2">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Referências</span>
              <Badge variant="secondary" className="ml-1">{references?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Imagens IA</span>
              <Badge variant="secondary" className="ml-1">{generations?.length || 0}</Badge>
            </TabsTrigger>
          </TabsList>
          
          <LibraryFilters
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            sortOption={sortOption}
            onSortChange={setSortOption}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            selectedCount={selectedItems.size}
            onClearSelection={handleClearSelection}
            onDeleteSelected={handleDeleteSelected}
          />
        </div>

        {/* Content Library */}
        <TabsContent value="content" className="mt-4">
          {filteredContents.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{searchQuery || typeFilter !== "all" ? "Nenhum resultado encontrado" : "Nenhum conteúdo na biblioteca"}</p>
                  {!searchQuery && typeFilter === "all" && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setSelectedContent(null);
                        setContentDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Conteúdo
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className={cn(
              viewMode === "grid" 
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                : "space-y-2"
            )}>
              {filteredContents.map(renderContentItem)}
            </div>
          )}
        </TabsContent>

        {/* Reference Library */}
        <TabsContent value="references" className="mt-4">
          {filteredReferences.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{searchQuery ? "Nenhum resultado encontrado" : "Nenhuma referência na biblioteca"}</p>
                  {!searchQuery && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setSelectedReference(null);
                        setReferenceDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Referência
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className={cn(
              viewMode === "grid" 
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                : "space-y-2"
            )}>
              {filteredReferences.map(renderReferenceItem)}
            </div>
          )}
        </TabsContent>

        {/* Image Gallery */}
        <TabsContent value="images" className="mt-4">
          <ImageGallery 
            clientId={clientId}
            onSelectImage={(url) => {
              navigator.clipboard.writeText(url);
              toast.success("URL da imagem copiada!");
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ContentDialog
        open={contentDialogOpen}
        onClose={() => {
          setContentDialogOpen(false);
          setSelectedContent(null);
        }}
        onSave={handleSaveContent}
        content={selectedContent || undefined}
      />

      <ContentViewDialog
        open={contentViewOpen}
        onClose={() => {
          setContentViewOpen(false);
          setSelectedContent(null);
        }}
        content={selectedContent || undefined}
      />

      <ReferenceDialog
        open={referenceDialogOpen}
        onClose={() => {
          setReferenceDialogOpen(false);
          setSelectedReference(null);
        }}
        onSave={handleSaveReference}
        reference={selectedReference || undefined}
      />

      <ReferenceViewDialog
        open={referenceViewOpen}
        onClose={() => {
          setReferenceViewOpen(false);
          setSelectedReference(null);
        }}
        reference={selectedReference || undefined}
      />

      <InstagramCarouselImporter
        open={instagramImporterOpen}
        onOpenChange={setInstagramImporterOpen}
        clientId={clientId}
      />
    </div>
  );
};
