import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Trash2,
  Download,
  Copy,
  Sparkles,
  Search,
  Grid3X3,
  LayoutList,
  ZoomIn,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";
import { useImageGenerations, ImageGeneration } from "@/hooks/useImageGenerations";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ImageGalleryProps {
  clientId: string;
  templateId?: string;
  onSelectImage?: (imageUrl: string) => void;
  onGenerateVariation?: (imageUrl: string, prompt: string) => void;
  className?: string;
}

export const ImageGallery = ({
  clientId,
  templateId,
  onSelectImage,
  onGenerateVariation,
  className,
}: ImageGalleryProps) => {
  const { generations, isLoading, deleteGeneration } = useImageGenerations(clientId, templateId);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [lightboxImage, setLightboxImage] = useState<ImageGeneration | null>(null);
  const [variationPrompt, setVariationPrompt] = useState("");
  const [isGeneratingVariation, setIsGeneratingVariation] = useState(false);
  const { toast } = useToast();

  const filteredGenerations = generations.filter((g) =>
    g.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ description: "URL copiada!" });
  };

  const handleDownload = (image: ImageGeneration) => {
    const link = document.createElement("a");
    link.href = image.image_url;
    link.download = `imagem-${image.id}.png`;
    link.click();
  };

  const handleDelete = async (id: string) => {
    await deleteGeneration.mutateAsync(id);
  };

  const handleGenerateVariation = async () => {
    if (!lightboxImage || !variationPrompt.trim()) return;

    setIsGeneratingVariation(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          prompt: variationPrompt,
          referenceImages: [{ url: lightboxImage.image_url }],
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        onGenerateVariation?.(data.imageUrl, variationPrompt);
        toast({ description: "Variação gerada com sucesso!" });
        setVariationPrompt("");
        setLightboxImage(null);
      }
    } catch (error) {
      toast({ description: "Erro ao gerar variação", variant: "destructive" });
    } finally {
      setIsGeneratingVariation(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-8 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Carregando galeria...</div>
        </CardContent>
      </Card>
    );
  }

  if (generations.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium text-foreground mb-1">Nenhuma imagem gerada</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            As imagens que você gerar com IA aparecerão aqui para reutilização
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">Galeria de Imagens</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {generations.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por prompt..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-48 pl-8 text-xs"
                />
              </div>
              <div className="flex items-center border rounded-md">
                <Button
                  size="sm"
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  className="h-8 w-8 p-0 rounded-r-none"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  className="h-8 w-8 p-0 rounded-l-none"
                  onClick={() => setViewMode("list")}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="popLayout">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredGenerations.map((image) => (
                  <motion.div
                    key={image.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted cursor-pointer"
                    onClick={() => setLightboxImage(image)}
                  >
                    <img
                      src={image.image_url}
                      alt={image.prompt}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-[10px] text-white line-clamp-2">{image.prompt}</p>
                      </div>
                      <div className="absolute top-1 right-1 flex items-center gap-1">
                        <Badge variant="secondary" className="h-5 text-[9px] bg-black/50 text-white border-0">
                          <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                          IA
                        </Badge>
                      </div>
                    </div>
                    <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn className="h-4 w-4 text-white drop-shadow-lg" />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredGenerations.map((image) => (
                  <motion.div
                    key={image.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                  >
                    <div
                      className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 cursor-pointer"
                      onClick={() => setLightboxImage(image)}
                    >
                      <img
                        src={image.image_url}
                        alt={image.prompt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground line-clamp-2">{image.prompt}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(image.created_at), "d 'de' MMM, HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectImage?.(image.image_url);
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(image);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(image.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Lightbox with variation generator */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-3xl p-4 bg-background/95 backdrop-blur-lg border-border/50">
          <DialogTitle className="sr-only">Visualização da imagem</DialogTitle>
          {lightboxImage && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg overflow-hidden border border-border">
                <img
                  src={lightboxImage.image_url}
                  alt={lightboxImage.prompt}
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground mb-2">Prompt Original</h3>
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                    {lightboxImage.prompt}
                  </p>

                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Gerar Variação
                    </h3>
                    <Input
                      placeholder="Descreva a variação desejada..."
                      value={variationPrompt}
                      onChange={(e) => setVariationPrompt(e.target.value)}
                      className="mb-2"
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleGenerateVariation}
                      disabled={!variationPrompt.trim() || isGeneratingVariation}
                    >
                      {isGeneratingVariation ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 mr-1" />
                          Gerar Variação
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onSelectImage?.(lightboxImage.image_url)}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Usar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleDownload(lightboxImage)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Baixar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:text-destructive hover:border-destructive"
                    onClick={() => {
                      handleDelete(lightboxImage.id);
                      setLightboxImage(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
