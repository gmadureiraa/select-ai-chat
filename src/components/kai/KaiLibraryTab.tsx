import { useState, useMemo, Suspense } from "react";
import { Library, Link2, Plus, Search, Layers } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useReferenceLibrary, CreateReferenceData, ReferenceItem } from "@/hooks/useReferenceLibrary";
import { useUnifiedContent } from "@/hooks/useUnifiedContent";
import { ClientReferencesManager } from "@/components/clients/ClientReferencesManager";
import { UnifiedContentGrid } from "@/components/kai/library/UnifiedContentGrid";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// 2026-05-17 — dialogs lazy. ReferenceDialog/ReferenceViewDialog vêm com
// editor RichContent. AddContentDialog tem preview + form. Só montam quando
// o user abre.
const ReferenceDialog = lazyWithRetry(() =>
  import("@/components/references/ReferenceDialog").then((m) => ({
    default: m.ReferenceDialog,
  })),
);
const ReferenceViewDialog = lazyWithRetry(() =>
  import("@/components/references/ReferenceViewDialog").then((m) => ({
    default: m.ReferenceViewDialog,
  })),
);
const AddContentDialog = lazyWithRetry(() =>
  import("@/components/kai/library/AddContentDialog").then((m) => ({
    default: m.AddContentDialog,
  })),
);
import { Client } from "@/hooks/useClients";
import { toast } from "sonner";
import { TabHeader } from "@/components/kai/TabHeader";

interface KaiLibraryTabProps {
  clientId: string;
  client: Client;
}

export const KaiLibraryTab = ({ clientId, client }: KaiLibraryTabProps) => {
  const [activeTab, setActiveTab] = useState("content");
  const [searchQuery, setSearchQuery] = useState("");

  // Reference Library — usado pra count + dialog Add no header (refs tab)
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  const [selectedReference, setSelectedReference] = useState<ReferenceItem | null>(null);
  const [referenceViewOpen, setReferenceViewOpen] = useState(false);
  const { references, createReference, updateReference } = useReferenceLibrary(clientId);

  // Add Content Dialog (aba Conteúdo)
  const [showAddContentDialog, setShowAddContentDialog] = useState(false);
  const [addContentType, setAddContentType] = useState<string | undefined>(undefined);

  // Unified Content (Instagram, Twitter, LinkedIn posts)
  const { data: unifiedContent } = useUnifiedContent(clientId);

  const filteredUnifiedCount = useMemo(() => {
    if (!unifiedContent) return 0;
    return unifiedContent.length;
  }, [unifiedContent]);

  const handleSaveReference = (data: CreateReferenceData) => {
    if (selectedReference) {
      updateReference.mutate({ id: selectedReference.id, data });
    } else {
      createReference.mutate(data);
    }
    setReferenceDialogOpen(false);
    setSelectedReference(null);
  };

  const handleAddButtonClick = () => {
    if (activeTab === "content") {
      setAddContentType(undefined);
      setShowAddContentDialog(true);
    } else if (activeTab === "references") {
      setSelectedReference(null);
      setReferenceDialogOpen(true);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TabHeader
        eyebrow="Biblioteca do cliente"
        icon={Library}
        title="Biblioteca"
        breadcrumb={client?.name}
        description="Conteúdos publicados e referências salvas pro cliente."
        actions={
          <>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar na biblioteca..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-56 lg:w-64 h-9"
                aria-label="Buscar na biblioteca"
              />
            </div>
            <Button onClick={handleAddButtonClick} className="shrink-0 h-9 kai-btn-rec">
              <Plus aria-hidden="true" className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Adicionar</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="flex-1 flex flex-col overflow-hidden mt-4">
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
        </TabsList>

        {/* Unified Content Library - with internal platform filters */}
        <TabsContent value="content" className="mt-4 flex-1 overflow-y-auto">
          <UnifiedContentGrid
            clientId={clientId}
            externalSearchQuery={searchQuery}
            onSelectContent={(item) => {
              toast.success(`Conteúdo selecionado: ${item.title}`);
            }}
          />
        </TabsContent>

        {/* Reference Library — usa ClientReferencesManager (rico) */}
        <TabsContent value="references" className="mt-4 flex-1 overflow-y-auto">
          <ClientReferencesManager clientId={clientId} externalSearchQuery={searchQuery} />
        </TabsContent>
      </Tabs>

      {/* Dialogs — conditional render + Suspense pra baixar o chunk só quando abre. */}
      {referenceDialogOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {referenceViewOpen && (
        <Suspense fallback={null}>
          <ReferenceViewDialog
            open={referenceViewOpen}
            onClose={() => {
              setReferenceViewOpen(false);
              setSelectedReference(null);
            }}
            reference={selectedReference || undefined}
          />
        </Suspense>
      )}

      {/* Add Content Dialog */}
      {showAddContentDialog && (
        <Suspense fallback={null}>
          <AddContentDialog
            open={showAddContentDialog}
            onOpenChange={setShowAddContentDialog}
            clientId={clientId}
            defaultContentType={addContentType}
          />
        </Suspense>
      )}
    </div>
  );
};
