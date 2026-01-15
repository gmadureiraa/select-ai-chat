import { useState, useMemo, useCallback } from "react";
import { Library, Link2, Image, Search, Layers, Instagram, Twitter, Linkedin, Maximize2, Star, LayoutGrid, Grid2X2, Square, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useReferenceLibrary, ReferenceItem } from "@/hooks/useReferenceLibrary";
import { useClientVisualReferences, ClientVisualReference } from "@/hooks/useClientVisualReferences";
import { useUnifiedContent, useToggleFavorite, UnifiedContentItem } from "@/hooks/useUnifiedContent";
import { ContentCard } from "@/components/kai/library/ContentCard";
import { ContentPreviewDialog } from "@/components/kai/library/ContentPreviewDialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface CanvasLibraryDrawerProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  onSelectReference: (reference: ReferenceItem) => void;
  onSelectVisualReference: (reference: ClientVisualReference) => void;
  onSelectContent?: (content: UnifiedContentItem) => void;
}

type CardSize = "compact" | "medium" | "large";

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
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("content");
  const [isExpanded, setIsExpanded] = useState(false);
  const [cardSize, setCardSize] = useState<CardSize>("medium");
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  // Content UX state
  const [contentFilter, setContentFilter] = useState<"all" | "favorites">("all");
  const [previewItem, setPreviewItem] = useState<UnifiedContentItem | null>(null);

  const { references } = useReferenceLibrary(clientId);
  const { references: visualReferences } = useClientVisualReferences(clientId);
  const { data: unifiedContent } = useUnifiedContent(clientId);
  const toggleFavorite = useToggleFavorite(clientId);

  const filteredContent = useMemo(() => {
    if (!unifiedContent) return [];

    const query = searchQuery.trim().toLowerCase();

    return unifiedContent.filter((c) => {
      if (contentFilter === "favorites" && !c.is_favorite) return false;

      if (!query) return true;
      return c.title.toLowerCase().includes(query) || c.content.toLowerCase().includes(query);
    });
  }, [unifiedContent, searchQuery, contentFilter]);

  const filteredReferences = useMemo(() => {
    if (!references) return [];
    if (!searchQuery) return references;
    const query = searchQuery.toLowerCase();
    return references.filter((r) => r.title.toLowerCase().includes(query) || r.content.toLowerCase().includes(query));
  }, [references, searchQuery]);

  const filteredVisualRefs = useMemo(() => {
    if (!visualReferences) return [];
    if (!searchQuery) return visualReferences;
    const query = searchQuery.toLowerCase();
    return visualReferences.filter((r) => r.title?.toLowerCase().includes(query) || r.description?.toLowerCase().includes(query));
  }, [visualReferences, searchQuery]);

  const handleSelectContent = (content: UnifiedContentItem) => {
    onSelectContent?.(content);
    setAddedItems(prev => new Set(prev).add(content.id));
    toast({
      title: "Adicionado ao canvas",
      description: content.title.substring(0, 50) + (content.title.length > 50 ? "..." : ""),
    });
    // NÃO fecha automaticamente - usuário decide quando fechar
  };

  const handleSelectReference = (ref: ReferenceItem) => {
    onSelectReference(ref);
    toast({
      title: "Referência adicionada",
      description: ref.title,
    });
  };

  const handleSelectVisual = (ref: ClientVisualReference) => {
    onSelectVisualReference(ref);
    toast({
      title: "Visual adicionado",
      description: ref.title || "Imagem de referência",
    });
  };

  const handleDragStart = useCallback((e: React.DragEvent, item: UnifiedContentItem) => {
    e.dataTransfer.setData("application/x-kai-unified-content", JSON.stringify(item));
    e.dataTransfer.setData("application/json", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  // Grid classes based on card size
  const getGridClass = (size: CardSize) => {
    switch (size) {
      case "compact": return "grid-cols-3";
      case "medium": return "grid-cols-2";
      case "large": return "grid-cols-1";
    }
  };

  // Visual refs grid
  const getVisualGridClass = (size: CardSize) => {
    switch (size) {
      case "compact": return "grid-cols-4";
      case "medium": return "grid-cols-3";
      case "large": return "grid-cols-2";
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:w-[600px] p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Library className="h-5 w-5 text-primary" />
                Biblioteca
              </SheetTitle>
              <div className="flex items-center gap-2">
                {/* Size controls */}
                <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                  <Button 
                    variant={cardSize === "compact" ? "secondary" : "ghost"} 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => setCardSize("compact")}
                    title="Compacto"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant={cardSize === "medium" ? "secondary" : "ghost"} 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => setCardSize("medium")}
                    title="Médio"
                  >
                    <Grid2X2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant={cardSize === "large" ? "secondary" : "ghost"} 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => setCardSize("large")}
                    title="Grande"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsExpanded(true)} className="h-8">
                  <Maximize2 className="h-4 w-4 mr-1" />
                  Expandir
                </Button>
              </div>
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
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {filteredContent.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="references" className="gap-1 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Link2 className="h-3.5 w-3.5" />
                  Refs
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {filteredReferences.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="visual" className="gap-1 text-xs data-[state=active]:bg-accent/10 data-[state=active]:text-accent">
                  <Image className="h-3.5 w-3.5" />
                  Visuais
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {filteredVisualRefs.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <TabsContent value="content" className="m-0 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Clique para adicionar ao canvas
                  </div>
                  <Button
                    variant={contentFilter === "favorites" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setContentFilter((v) => (v === "favorites" ? "all" : "favorites"))}
                    className="h-8 text-xs"
                  >
                    <Star className={cn("h-3.5 w-3.5 mr-1", contentFilter === "favorites" && "fill-primary-foreground")} />
                    Favoritos
                  </Button>
                </div>

                {filteredContent.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Layers className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Nenhum conteúdo encontrado</p>
                  </div>
                ) : (
                  <div className={cn("grid gap-3", getGridClass(cardSize))}>
                    {filteredContent.slice(0, 50).map((item) => {
                      const isAdded = addedItems.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className="relative"
                          draggable
                          onDragStart={(e) => handleDragStart(e, item)}
                        >
                          <ContentCard
                            item={item}
                            compact={cardSize === "compact"}
                            size={cardSize}
                            draggable
                            selected={isAdded}
                            onSelect={() => handleSelectContent(item)}
                            onPreview={() => setPreviewItem(item)}
                          />
                          {isAdded && (
                            <div className="absolute top-2 right-2 h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "absolute right-2 h-7 w-7",
                              isAdded ? "top-9" : "top-2"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite.mutate({ item });
                            }}
                            aria-label={item.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                          >
                            <Star className={cn("h-4 w-4", item.is_favorite && "fill-primary text-primary")} />
                          </Button>
                        </div>
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
                  <div className={cn("grid gap-3", cardSize === "compact" ? "grid-cols-2" : "grid-cols-1")}>
                    {filteredReferences.map((ref) => (
                      <button
                        key={ref.id}
                        onClick={() => handleSelectReference(ref)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 hover:border-primary/30"
                      >
                        <p className="font-medium text-sm truncate">{ref.title}</p>
                        <p className={cn(
                          "text-xs text-muted-foreground mt-1",
                          cardSize === "large" ? "line-clamp-4" : "line-clamp-2"
                        )}>
                          {ref.content.slice(0, cardSize === "large" ? 300 : 120)}
                        </p>
                        <Badge variant="outline" className="text-[10px] mt-2">
                          {ref.reference_type}
                        </Badge>
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
                  <div className={cn("grid gap-3", getVisualGridClass(cardSize))}>
                    {filteredVisualRefs.map((ref) => (
                      <button
                        key={ref.id}
                        onClick={() => handleSelectVisual(ref)}
                        className="group rounded-lg border overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
                      >
                        <div className={cn(
                          "bg-muted",
                          cardSize === "large" ? "aspect-video" : "aspect-square"
                        )}>
                          <img src={ref.image_url} alt={ref.title || ""} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-2">
                          <p className={cn(
                            "font-medium",
                            cardSize === "compact" ? "text-[10px] truncate" : "text-xs line-clamp-2"
                          )}>
                            {ref.title || "Sem título"}
                          </p>
                          {cardSize === "large" && ref.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {ref.description}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          {/* Footer with close button */}
          <div className="px-4 py-3 border-t">
            <Button variant="outline" onClick={onClose} className="w-full">
              Fechar Biblioteca
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Expanded Modal */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-6xl h-[85vh] p-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Library className="h-5 w-5 text-primary" />
                Biblioteca Completa
              </DialogTitle>
              <div className="flex items-center gap-2">
                {/* Size controls */}
                <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                  <Button 
                    variant={cardSize === "compact" ? "secondary" : "ghost"} 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => setCardSize("compact")}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant={cardSize === "medium" ? "secondary" : "ghost"} 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => setCardSize("medium")}
                  >
                    <Grid2X2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant={cardSize === "large" ? "secondary" : "ghost"} 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => setCardSize("large")}
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 p-6">
            <div className={cn(
              "grid gap-4",
              cardSize === "compact" && "grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
              cardSize === "medium" && "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
              cardSize === "large" && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            )}>
              {filteredContent.map((item) => {
                const Icon = platformIcons[item.platform as keyof typeof platformIcons];
                const isAdded = addedItems.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="relative"
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                  >
                    <button
                      onClick={() => handleSelectContent(item)}
                      className={cn(
                        "text-left rounded-xl border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all w-full",
                        isAdded && "ring-2 ring-green-500"
                      )}
                    >
                      {item.thumbnail_url ? (
                        <div className={cn(
                          "bg-muted overflow-hidden",
                          cardSize === "large" ? "aspect-video" : "aspect-square"
                        )}>
                          <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className={cn(
                          "bg-muted flex items-center justify-center",
                          cardSize === "large" ? "aspect-video" : "aspect-square"
                        )}>
                          {Icon && (
                            <Icon
                              className={cn(
                                "opacity-50",
                                cardSize === "compact" ? "h-6 w-6" : "h-8 w-8",
                                platformColors[item.platform as keyof typeof platformColors]
                              )}
                            />
                          )}
                        </div>
                      )}
                      <div className="p-3">
                        <p className={cn(
                          "font-medium",
                          cardSize === "compact" ? "text-xs line-clamp-1" : "text-sm line-clamp-2"
                        )}>{item.title}</p>
                        {cardSize === "large" && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                            {item.content.substring(0, 200)}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="outline" className="text-[10px]">
                            {item.platform}
                          </Badge>
                          {item.is_favorite && <Star className="h-4 w-4 fill-primary text-primary" />}
                        </div>
                      </div>
                    </button>

                    {isAdded && (
                      <div className="absolute top-2 left-2 h-6 w-6 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-8 w-8 bg-background/70 backdrop-blur"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite.mutate({ item });
                      }}
                      aria-label={item.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                      <Star className={cn("h-4 w-4", item.is_favorite && "fill-primary text-primary")} />
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <ContentPreviewDialog
        item={previewItem}
        open={!!previewItem}
        onOpenChange={(o) => !o && setPreviewItem(null)}
        onToggleFavorite={() => previewItem && toggleFavorite.mutate({ item: previewItem })}
        onAddToCanvas={() => {
          if (!previewItem) return;
          handleSelectContent(previewItem);
          setPreviewItem(null);
        }}
      />
    </>
  );
}
