import { useState } from "react";
import { Library, FileText, Link2, Plus, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useContentLibrary, ContentItem, CreateContentData } from "@/hooks/useContentLibrary";
import { useReferenceLibrary, ReferenceItem, CreateReferenceData } from "@/hooks/useReferenceLibrary";
import { ContentCard } from "@/components/content/ContentCard";
import { ContentDialog } from "@/components/content/ContentDialog";
import { ContentViewDialog } from "@/components/content/ContentViewDialog";
import { ReferenceCard } from "@/components/references/ReferenceCard";
import { ReferenceDialog } from "@/components/references/ReferenceDialog";
import { ReferenceViewDialog } from "@/components/references/ReferenceViewDialog";
import { Client } from "@/hooks/useClients";

interface KaiLibraryTabProps {
  clientId: string;
  client: Client;
}

export const KaiLibraryTab = ({ clientId, client }: KaiLibraryTabProps) => {
  const [activeTab, setActiveTab] = useState("content");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Content Library
  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [contentViewOpen, setContentViewOpen] = useState(false);
  const { contents, createContent, updateContent, deleteContent } = useContentLibrary(clientId);

  // Reference Library
  const [referenceDialogOpen, setReferenceDialogOpen] = useState(false);
  const [selectedReference, setSelectedReference] = useState<ReferenceItem | null>(null);
  const [referenceViewOpen, setReferenceViewOpen] = useState(false);
  const { references, createReference, updateReference, deleteReference } = useReferenceLibrary(clientId);

  // Filter content
  const filteredContents = contents?.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.content.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredReferences = references?.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.content.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Library className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Biblioteca</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
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
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="content" className="gap-2">
            <FileText className="h-4 w-4" />
            Conteúdo Produzido
            <Badge variant="secondary" className="ml-1">{contents?.length || 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="references" className="gap-2">
            <Link2 className="h-4 w-4" />
            Referências
            <Badge variant="secondary" className="ml-1">{references?.length || 0}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Content Library */}
        <TabsContent value="content" className="mt-4">
          {filteredContents.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum conteúdo na biblioteca</p>
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
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContents.map((content) => (
                <ContentCard
                  key={content.id}
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
              ))}
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
                  <p>Nenhuma referência na biblioteca</p>
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
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReferences.map((reference) => (
                <ReferenceCard
                  key={reference.id}
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
              ))}
            </div>
          )}
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
    </div>
  );
};
