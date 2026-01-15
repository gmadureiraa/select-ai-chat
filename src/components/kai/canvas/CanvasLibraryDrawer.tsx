import { useState, useMemo } from "react";
import { Library, Link2, Image, Search, Plus, X, Layers, Instagram, Twitter, Linkedin, Maximize2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useReferenceLibrary, ReferenceItem } from "@/hooks/useReferenceLibrary";
import { useClientVisualReferences, ClientVisualReference } from "@/hooks/useClientVisualReferences";
import { useUnifiedContent, UnifiedContentItem } from "@/hooks/useUnifiedContent";
import { cn } from "@/lib/utils";

interface CanvasLibraryDrawerProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  onSelectReference: (reference: ReferenceItem) => void;
  onSelectVisualReference: (reference: ClientVisualReference) => void;
  onSelectContent?: (content: UnifiedContentItem) => void;
}

const platformIcons = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
};

const platformColors = {
  instagram: "text-pink-500",
  twitter: "text-blue-400",
  linkedin: "text-blue-600",
};

export function CanvasLibraryDrawer({
  open,
  onClose,
  clientId,
  onSelectReference,
  onSelectVisualReference,
  onSelectContent,
}: CanvasLibraryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("content");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const { references } = useReferenceLibrary(clientId);
  const { references: visualReferences } = useClientVisualReferences(clientId);
  const { data: unifiedContent } = useUnifiedContent(clientId);

  const filteredContent = useMemo(() => {
    if (!unifiedContent) return [];
    if (!searchQuery) return unifiedContent;
    const query = searchQuery.toLowerCase();
    return unifiedContent.filter(
      (c) => c.title.toLowerCase().includes(query) || c.content.toLowerCase().includes(query)
    );
  }, [unifiedContent, searchQuery]);

  const filteredReferences = useMemo(() => {
    if (!references) return [];
    if (!searchQuery) return references;
    const query = searchQuery.toLowerCase();
    return references.filter(
      (r) => r.title.toLowerCase().includes(query) || r.content.toLowerCase().includes(query)
    );
  }, [references, searchQuery]);

  const filteredVisualRefs = useMemo(() => {
    if (!visualReferences) return [];
    if (!searchQuery) return visualReferences;
    const query = searchQuery.toLowerCase();
    return visualReferences.filter(
      (r) => r.title?.toLowerCase().includes(query) || r.description?.toLowerCase().includes(query)
    );
  }, [visualReferences, searchQuery]);

  const handleSelectContent = (content: UnifiedContentItem) => {
    onSelectContent?.(content);
    onClose();
  };

  const handleSelectReference = (ref: ReferenceItem) => {
    onSelectReference(ref);
    onClose();
  };

  const handleSelectVisual = (ref: ClientVisualReference) => {
    onSelectVisualReference(ref);
    onClose();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:w-[500px] p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Library className="h-5 w-5 text-primary" />
                Biblioteca
              </SheetTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsExpanded(true)} className="h-8">
                <Maximize2 className="h-4 w-4 mr-1" />
                Expandir
              </Button>
            </div>
          </SheetHeader>

          <div className="px-4 py-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar na biblioteca..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-4 border-b">
              <TabsList className="h-10 w-full justify-start bg-transparent p-0">
                <TabsTrigger value="content" className="gap-1 text-xs data-[state=active]:bg-green-500/10 data-[state=active]:text-green-600">
                  <Layers className="h-3.5 w-3.5" />
                  Conteúdo
                  <Badge variant="secondary" className="ml-1 text-[10px]">{filteredContent.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="references" className="gap-1 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Link2 className="h-3.5 w-3.5" />
                  Refs
                  <Badge variant="secondary" className="ml-1 text-[10px]">{filteredReferences.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="visual" className="gap-1 text-xs data-[state=active]:bg-accent/10 data-[state=active]:text-accent">
                  <Image className="h-3.5 w-3.5" />
                  Visuais
                  <Badge variant="secondary" className="ml-1 text-[10px]">{filteredVisualRefs.length}</Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <TabsContent value="content" className="m-0 p-4">
                {filteredContent.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Layers className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Nenhum conteúdo encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredContent.slice(0, 30).map((item) => {
                      const Icon = platformIcons[item.platform as keyof typeof platformIcons];
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectContent(item)}
                          className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 hover:border-primary/30 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            {Icon && (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                                <Icon className={cn("h-4 w-4", platformColors[item.platform as keyof typeof platformColors])} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[9px]">{item.platform}</Badge>
                                {item.engagement_rate && (
                                  <span className="text-[10px] text-green-600">{item.engagement_rate.toFixed(1)}%</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="references" className="m-0 p-4">
                {filteredReferences.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Link2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Nenhuma referência encontrada</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredReferences.map((ref) => (
                      <button
                        key={ref.id}
                        onClick={() => handleSelectReference(ref)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 hover:border-primary/30"
                      >
                        <p className="font-medium text-sm truncate">{ref.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{ref.content.slice(0, 120)}</p>
                        <Badge variant="outline" className="text-[10px] mt-2">{ref.reference_type}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="visual" className="m-0 p-4">
                {filteredVisualRefs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Image className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Nenhuma referência visual</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {filteredVisualRefs.map((ref) => (
                      <button
                        key={ref.id}
                        onClick={() => handleSelectVisual(ref)}
                        className="group rounded-lg border overflow-hidden hover:border-primary/50"
                      >
                        <div className="aspect-square bg-muted">
                          <img src={ref.image_url} alt={ref.title || ""} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium truncate">{ref.title || "Sem título"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Expanded Modal */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-4xl h-[80vh] p-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Library className="h-5 w-5 text-primary" />
              Biblioteca Completa
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredContent.map((item) => {
                const Icon = platformIcons[item.platform as keyof typeof platformIcons];
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectContent(item)}
                    className="text-left rounded-xl border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all"
                  >
                    {item.thumbnail_url ? (
                      <div className="aspect-square bg-muted overflow-hidden">
                        <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-square bg-muted flex items-center justify-center">
                        {Icon && <Icon className={cn("h-8 w-8 opacity-50", platformColors[item.platform as keyof typeof platformColors])} />}
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                      <Badge variant="outline" className="text-[10px] mt-2">{item.platform}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
