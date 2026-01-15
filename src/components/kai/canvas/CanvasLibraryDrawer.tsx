import { useState, useMemo } from "react";
import { Library, Link2, Image, Search, Plus, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useReferenceLibrary, ReferenceItem } from "@/hooks/useReferenceLibrary";
import { useClientVisualReferences, ClientVisualReference } from "@/hooks/useClientVisualReferences";
import { cn } from "@/lib/utils";

interface CanvasLibraryDrawerProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  onSelectReference: (reference: ReferenceItem) => void;
  onSelectVisualReference: (reference: ClientVisualReference) => void;
}

export function CanvasLibraryDrawer({
  open,
  onClose,
  clientId,
  onSelectReference,
  onSelectVisualReference,
}: CanvasLibraryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("references");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const { references } = useReferenceLibrary(clientId);
  const { references: visualReferences } = useClientVisualReferences(clientId);

  const filteredReferences = useMemo(() => {
    if (!references) return [];
    if (!searchQuery) return references;
    const query = searchQuery.toLowerCase();
    return references.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        r.content.toLowerCase().includes(query)
    );
  }, [references, searchQuery]);

  const filteredVisualRefs = useMemo(() => {
    if (!visualReferences) return [];
    if (!searchQuery) return visualReferences;
    const query = searchQuery.toLowerCase();
    return visualReferences.filter(
      (r) =>
        r.title?.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query)
    );
  }, [visualReferences, searchQuery]);

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
            <SheetTitle className="flex items-center gap-2">
              <Library className="h-5 w-5 text-primary" />
              Biblioteca
            </SheetTitle>
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
                <TabsTrigger
                  value="references"
                  className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                >
                  <Link2 className="h-4 w-4" />
                  Referências
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {filteredReferences.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="visual"
                  className="gap-2 data-[state=active]:bg-accent/10 data-[state=active]:text-accent rounded-none border-b-2 border-transparent data-[state=active]:border-accent"
                >
                  <Image className="h-4 w-4" />
                  Visuais
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {filteredVisualRefs.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
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
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-all",
                          "hover:bg-muted/50 hover:border-primary/30",
                          "focus:outline-none focus:ring-2 focus:ring-primary/20"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{ref.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {ref.content.slice(0, 120)}...
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {ref.reference_type}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(ref.created_at || "").toLocaleDateString("pt-BR")}
                          </span>
                          <Plus className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="visual" className="m-0 p-4">
                {filteredVisualRefs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Image className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Nenhuma referência visual encontrada</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {filteredVisualRefs.map((ref) => (
                      <div
                        key={ref.id}
                        className={cn(
                          "group relative rounded-lg border overflow-hidden cursor-pointer transition-all",
                          "hover:border-primary/50 hover:shadow-md"
                        )}
                      >
                        <div
                          className="aspect-square bg-muted"
                          onClick={() => setPreviewImage(ref.image_url)}
                        >
                          <img
                            src={ref.image_url}
                            alt={ref.title || "Visual reference"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium truncate">
                            {ref.title || "Sem título"}
                          </p>
                          <Badge variant="outline" className="text-[9px] mt-1">
                            {ref.reference_type}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          className="absolute top-2 right-2 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleSelectVisual(ref)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Usar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            {previewImage && (
              <img
                src={previewImage}
                alt="Preview"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
