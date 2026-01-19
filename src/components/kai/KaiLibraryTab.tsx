import { useState, useMemo } from "react";
import { Library, Link2, Plus, Search, Image, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useReferenceLibrary, ReferenceItem, CreateReferenceData } from "@/hooks/useReferenceLibrary";
import { useClientVisualReferences } from "@/hooks/useClientVisualReferences";
import { useUnifiedContent } from "@/hooks/useUnifiedContent";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ReferenceCard } from "@/components/references/ReferenceCard";
import { ReferenceDialog } from "@/components/references/ReferenceDialog";
import { ReferenceViewDialog } from "@/components/references/ReferenceViewDialog";
import { VisualReferencesManager, REFERENCE_TYPES } from "@/components/clients/VisualReferencesManager";
import { UnifiedContentGrid } from "@/components/kai/library/UnifiedContentGrid";
import { AddContentDialog } from "@/components/kai/library/AddContentDialog";
import { LibraryFilters, ContentTypeFilter, SortOption, ViewMode } from "@/components/kai/LibraryFilters";
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
  const [visualRefTypeFilter, setVisualRefTypeFilter] = useState<string>("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Workspace permissions
  const { canDeleteFromLibrary, canEditInLibrary } = useWorkspace();

  // Reference Library
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  const [selectedReference, setSelectedReference] = useState<ReferenceItem | null>(null);
  const [referenceViewOpen, setReferenceViewOpen] = useState(false);
  const { references, createReference, updateReference, deleteReference } = useReferenceLibrary(clientId);

  // Visual References
  const { references: visualReferences, deleteReference: deleteVisualRef } = useClientVisualReferences(clientId);
  const [showVisualUploadForm, setShowVisualUploadForm] = useState(false);

  // Add Content Dialog (for content tab)
  const [showAddContentDialog, setShowAddContentDialog] = useState(false);

  // Unified Content (Instagram, Twitter, LinkedIn posts)
  const { data: unifiedContent } = useUnifiedContent(clientId);

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
    
    // Type filter - reference_type uses same values as content_type
    if (typeFilter !== "all") {
      result = result.filter(r => r.reference_type === typeFilter);
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
  }, [references, searchQuery, typeFilter, sortOption]);

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
        if (activeTab === "references") {
          return deleteReference.mutateAsync(id);
        } else if (activeTab === "visual-refs") {
          return deleteVisualRef.mutateAsync(id);
        }
        return Promise.resolve();
      });
      
      await Promise.all(deletePromises);
      setSelectedItems(new Set());
      toast.success(`${selectedItems.size} item(s) excluído(s)`);
    } catch (error) {
      toast.error("Erro ao excluir itens");
    }
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
          canDelete={canDeleteFromLibrary}
          canEdit={canEditInLibrary}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
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
            onClick={() => {
              if (activeTab === "content") {
                setShowAddContentDialog(true);
              } else if (activeTab === "references") {
                setSelectedReference(null);
                setReferenceDialogOpen(true);
              } else if (activeTab === "visual-refs") {
                setShowVisualUploadForm(true);
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
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedItems(new Set()); }} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList>
            <TabsTrigger value="content" className="gap-2 data-[state=active]:bg-green-500/10 data-[state=active]:text-green-600">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Conteúdo</span>
              <Badge variant="secondary" className="ml-1 bg-green-500/20 text-green-600 font-bold">{unifiedContent?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="references" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Referências</span>
              <Badge variant="secondary" className="ml-1 bg-primary/20 text-primary font-bold">{references?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="visual-refs" className="gap-2 data-[state=active]:bg-accent/10 data-[state=active]:text-accent">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Refs Visuais</span>
              <Badge variant="secondary" className="ml-1 bg-accent/20 text-accent font-bold">{visualReferences?.length || 0}</Badge>
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            {/* Visual Refs Type Filter */}
            {activeTab === "visual-refs" && (
              <Select value={visualRefTypeFilter} onValueChange={setVisualRefTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {REFERENCE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
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
              canDelete={canDeleteFromLibrary}
            />
          </div>
        </div>

        {/* Unified Content Library */}
        <TabsContent value="content" className="mt-4 flex-1 overflow-y-auto">
          <UnifiedContentGrid
            clientId={clientId}
            onSelectContent={(item) => {
              toast.success(`Conteúdo selecionado: ${item.title}`);
            }}
          />
        </TabsContent>

        {/* Reference Library */}
        <TabsContent value="references" className="mt-4 flex-1 overflow-y-auto">
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

        {/* Visual References Library */}
        <TabsContent value="visual-refs" className="mt-4 flex-1 overflow-y-auto">
          <VisualReferencesManager
            clientId={clientId}
            variant="expanded"
            searchQuery={searchQuery}
            typeFilter={visualRefTypeFilter}
            viewMode={viewMode}
            selectedItems={selectedItems}
            onToggleSelection={toggleSelection}
            showUploadForm={showVisualUploadForm}
            onShowUploadFormChange={setShowVisualUploadForm}
          />
        </TabsContent>

      </Tabs>

      {/* Dialogs */}
      <ReferenceDialog
        open={referenceDialogOpen}
        onClose={() => {
          setReferenceDialogOpen(false);
          setSelectedReference(null);
        }}
        onSave={handleSaveReference}
        reference={selectedReference || undefined}
        clientId={clientId}
      />

      <ReferenceViewDialog
        open={referenceViewOpen}
        onClose={() => {
          setReferenceViewOpen(false);
          setSelectedReference(null);
        }}
        reference={selectedReference || undefined}
      />

      {/* Add Content Dialog */}
      <AddContentDialog
        open={showAddContentDialog}
        onOpenChange={setShowAddContentDialog}
        clientId={clientId}
      />
    </div>
  );
};
