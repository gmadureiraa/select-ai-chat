import { useState, useMemo } from "react";
import { Library, Link2, Plus, Search, Image, Layers, BookOpen, FileBarChart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useReferenceLibrary, ReferenceItem, CreateReferenceData } from "@/hooks/useReferenceLibrary";
import { useClientVisualReferences } from "@/hooks/useClientVisualReferences";
import { useUnifiedContent } from "@/hooks/useUnifiedContent";
import { useContentLibrary } from "@/hooks/useContentLibrary";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ReferenceCard } from "@/components/references/ReferenceCard";
import { ReferenceDialog } from "@/components/references/ReferenceDialog";
import { ReferenceViewDialog } from "@/components/references/ReferenceViewDialog";
import { UnifiedContentGrid } from "@/components/kai/library/UnifiedContentGrid";
import { CaseStudyGrid } from "@/components/kai/library/CaseStudyGrid";
import { AddContentDialog } from "@/components/kai/library/AddContentDialog";
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
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Workspace permissions
  const { canDeleteFromLibrary, canEditInLibrary } = useWorkspace();

  // Reference Library
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  const [selectedReference, setSelectedReference] = useState<ReferenceItem | null>(null);
  const [referenceViewOpen, setReferenceViewOpen] = useState(false);
  const { references, createReference, updateReference, deleteReference } = useReferenceLibrary(clientId);

  // Add Content Dialog (for content tab and case studies/reports)
  const [showAddContentDialog, setShowAddContentDialog] = useState(false);
  const [addContentType, setAddContentType] = useState<string | undefined>(undefined);

  // Unified Content (Instagram, Twitter, LinkedIn posts) - excludes case_study and report
  const { data: unifiedContent } = useUnifiedContent(clientId);
  
  // Content library for counting case studies and reports
  const { contents: libraryContent } = useContentLibrary(clientId);

  // Count case studies and reports
  const caseStudiesCount = useMemo(() => 
    libraryContent?.filter(item => item.content_type === 'case_study').length || 0
  , [libraryContent]);

  const reportsCount = useMemo(() => 
    libraryContent?.filter(item => item.content_type === 'report').length || 0
  , [libraryContent]);

  // Filter unified content to exclude case_study and report (they have their own tabs)
  const filteredUnifiedCount = useMemo(() => {
    if (!unifiedContent) return 0;
    return unifiedContent.filter(item => 
      item.content_type !== 'case_study' && item.content_type !== 'report'
    ).length;
  }, [unifiedContent]);

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
    
    // Sort by newest
    result = [...result].sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    
    return result;
  }, [references, searchQuery]);

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

  const handleAddButtonClick = () => {
    if (activeTab === "content") {
      setAddContentType(undefined);
      setShowAddContentDialog(true);
    } else if (activeTab === "references") {
      setSelectedReference(null);
      setReferenceDialogOpen(true);
    } else if (activeTab === "case-studies") {
      setAddContentType("case_study");
      setShowAddContentDialog(true);
    } else if (activeTab === "reports") {
      setAddContentType("report");
      setShowAddContentDialog(true);
    }
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
          {/* Search only for references tab */}
          {activeTab === "references" && (
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar referências..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-56 lg:w-64"
              />
            </div>
          )}
          
          <Button onClick={handleAddButtonClick} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Adicionar</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedItems(new Set()); }} className="flex-1 flex flex-col overflow-hidden mt-4">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="content" className="gap-2 data-[state=active]:bg-green-500/10 data-[state=active]:text-green-600">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Conteúdo</span>
            <Badge variant="secondary" className="ml-1 bg-green-500/20 text-green-600 font-bold">{filteredUnifiedCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="references" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Refs</span>
            <Badge variant="secondary" className="ml-1 bg-primary/20 text-primary font-bold">{references?.length || 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="case-studies" className="gap-2 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Estudos de Caso</span>
            <Badge variant="secondary" className="ml-1 bg-blue-500/20 text-blue-600 font-bold">{caseStudiesCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2 data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-600">
            <FileBarChart className="h-4 w-4" />
            <span className="hidden sm:inline">Relatórios</span>
            <Badge variant="secondary" className="ml-1 bg-orange-500/20 text-orange-600 font-bold">{reportsCount}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Unified Content Library - with internal platform filters */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredReferences.map(renderReferenceItem)}
            </div>
          )}
        </TabsContent>

        {/* Case Studies */}
        <TabsContent value="case-studies" className="mt-4 flex-1 overflow-y-auto">
          <CaseStudyGrid
            clientId={clientId}
            type="case_study"
            onAddNew={() => {
              setAddContentType("case_study");
              setShowAddContentDialog(true);
            }}
          />
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className="mt-4 flex-1 overflow-y-auto">
          <CaseStudyGrid
            clientId={clientId}
            type="report"
            onAddNew={() => {
              setAddContentType("report");
              setShowAddContentDialog(true);
            }}
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
        defaultContentType={addContentType}
      />
    </div>
  );
};
