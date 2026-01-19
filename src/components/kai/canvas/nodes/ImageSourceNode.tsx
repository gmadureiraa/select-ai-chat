import { memo, useState, useRef } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { ImageIcon, Upload, Loader2, X, Trash2, Star, Code2, Palette, FileText, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImageAnalysisModal } from "../ImageAnalysisModal";
import { ImageMetadata } from "../hooks/useCanvasState";

// Types for image source node
export interface ImageSourceFile {
  id: string;
  name: string;
  url: string;
  storagePath?: string;
  isProcessing?: boolean;
  processingType?: "json" | "ocr" | null;
  analyzed?: boolean;
  metadata?: ImageMetadata;
}

export interface ImageSourceNodeData {
  type: "image-source";
  images: ImageSourceFile[];
}

const MAX_IMAGES = 10;

interface ImageSourceNodeProps extends NodeProps<ImageSourceNodeData> {
  onUpdateData?: (nodeId: string, data: Partial<ImageSourceNodeData>) => void;
  onDelete?: (nodeId: string) => void;
  onAnalyzeImage?: (nodeId: string, imageId: string, imageUrl: string) => void;
  onTranscribeImage?: (nodeId: string, imageId: string, imageUrl: string) => void;
}

function ImageSourceNodeComponent({
  id,
  data,
  selected,
  onUpdateData,
  onDelete,
  onAnalyzeImage,
  onTranscribeImage
}: ImageSourceNodeProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modal state
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageSourceFile | null>(null);

  const images = data.images || [];

  // Handle file upload
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const currentCount = images.length;
    const availableSlots = MAX_IMAGES - currentCount;
    
    if (availableSlots <= 0) {
      toast({
        title: "Limite atingido",
        description: `Máximo de ${MAX_IMAGES} imagens permitido`,
        variant: "destructive",
      });
      return;
    }
    
    const filesToProcess = Array.from(files).slice(0, availableSlots);
    
    if (filesToProcess.length < files.length) {
      toast({
        title: "Limite de imagens",
        description: `Apenas ${filesToProcess.length} de ${files.length} imagens serão adicionadas (limite: ${MAX_IMAGES})`,
        variant: "default",
      });
    }
    
    setIsUploading(true);
    const newImages: ImageSourceFile[] = [];

    for (const file of filesToProcess) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Arquivo inválido",
          description: `${file.name} não é uma imagem`,
          variant: "destructive",
        });
        continue;
      }

      const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const filePath = `canvas-images/${imageId}/${file.name}`;

      try {
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('content-media')
          .upload(filePath, file);

        let imageUrl: string;
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          imageUrl = URL.createObjectURL(file);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('content-media')
            .getPublicUrl(filePath);
          imageUrl = publicUrl;
        }

        const newImage: ImageSourceFile = {
          id: imageId,
          name: file.name,
          url: imageUrl,
          storagePath: uploadError ? undefined : filePath,
          isProcessing: false, // NOT auto-processing
          processingType: null,
          analyzed: false,
          metadata: {
            uploadedAt: new Date().toISOString(),
            isPrimary: images.length === 0 && newImages.length === 0,
            dimensions: { width: 0, height: 0 },
            analyzed: false,
          }
        };

        newImages.push(newImage);
      } catch (error) {
        console.error('Error uploading:', error);
        toast({
          title: "Erro no upload",
          description: `Falha ao enviar ${file.name}`,
          variant: "destructive",
        });
      }
    }

    if (newImages.length > 0) {
      const updatedImages = [...images, ...newImages];
      onUpdateData?.(id, { images: updatedImages });

      toast({
        title: `${newImages.length} imagem(ns) adicionada(s)`,
        description: "Use os botões OCR ou JSON para processar",
      });
    }

    setIsUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemoveImage = (imageId: string) => {
    const updatedImages = images.filter(img => img.id !== imageId);
    onUpdateData?.(id, { images: updatedImages });
  };

  const handleSetPrimary = (imageId: string) => {
    const updatedImages = images.map(img => ({
      ...img,
      metadata: {
        ...img.metadata,
        uploadedAt: img.metadata?.uploadedAt || new Date().toISOString(),
        isPrimary: img.id === imageId
      }
    }));
    onUpdateData?.(id, { images: updatedImages });
    
    toast({
      title: "Referência principal definida",
      description: "Esta imagem será usada como referência prioritária",
    });
  };

  const handleViewAnalysis = (image: ImageSourceFile) => {
    setSelectedImage(image);
    setAnalysisModalOpen(true);
  };

  const handleAnalyzeJson = (image: ImageSourceFile) => {
    if (image.isProcessing) return;
    onAnalyzeImage?.(id, image.id, image.url);
  };

  const handleTranscribeOcr = (image: ImageSourceFile) => {
    if (image.isProcessing) return;
    onTranscribeImage?.(id, image.id, image.url);
  };

  // Get first analyzed image's style summary for display
  const primaryImage = images.find(img => img.metadata?.isPrimary) || images[0];
  const styleAnalysis = primaryImage?.metadata?.styleAnalysis;
  const analyzedCount = images.filter(img => img.analyzed).length;
  const ocrCount = images.filter(img => img.metadata?.ocrText).length;
  const processingCount = images.filter(img => img.isProcessing).length;

  return (
    <>
      <Card className={cn(
        "w-[320px] shadow-lg transition-all border-2",
        selected ? "border-primary ring-2 ring-primary/20" : "border-cyan-500/50",
        isDragging && "border-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/30",
        "bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/30 dark:to-background"
      )}>
        <CardHeader className="pb-2 pt-3 px-3 flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-cyan-500 flex items-center justify-center">
              <ImageIcon className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-medium text-sm">Imagem</span>
            {images.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {images.length}/{MAX_IMAGES}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete?.(id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>

        <CardContent className="px-3 pb-3 space-y-3">
          {/* Drop zone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer",
              isDragging 
                ? "border-cyan-400 bg-cyan-50 dark:bg-cyan-950/50" 
                : "border-muted-foreground/30 hover:border-cyan-400"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
                <span className="text-xs text-muted-foreground">Enviando...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Arraste ou clique (max {MAX_IMAGES})
                </span>
              </div>
            )}
          </div>

          {/* Status badges */}
          {images.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {processingCount > 0 && (
                <Badge variant="outline" className="text-[10px] h-5 gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Processando {processingCount}...
                </Badge>
              )}
              {analyzedCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5 gap-1 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                  <Code2 className="h-2.5 w-2.5" />
                  {analyzedCount} JSON
                </Badge>
              )}
              {ocrCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5 gap-1 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <FileText className="h-2.5 w-2.5" />
                  {ocrCount} OCR
                </Badge>
              )}
            </div>
          )}

          {/* Image grid - supports up to 10 images */}
          {images.length > 0 && (
            <div className={cn(
              "grid gap-2",
              images.length <= 2 ? "grid-cols-2" : 
              images.length <= 6 ? "grid-cols-3" : "grid-cols-4"
            )}>
              {images.map((img) => (
                <div 
                  key={img.id}
                  className={cn(
                    "relative group rounded-lg border overflow-hidden bg-background transition-all",
                    img.metadata?.isPrimary && "ring-2 ring-primary"
                  )}
                >
                  <div className="relative aspect-square">
                    <img 
                      src={img.url} 
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Primary badge */}
                    {img.metadata?.isPrimary && (
                      <Badge className="absolute top-0.5 left-0.5 text-[7px] h-3.5 px-1 bg-primary">
                        Principal
                      </Badge>
                    )}
                    
                    {/* Status badge */}
                    {img.isProcessing ? (
                      <Badge variant="outline" className="absolute top-0.5 right-0.5 text-[7px] h-3.5 px-1 bg-background/90 gap-0.5">
                        <Loader2 className="h-2 w-2 animate-spin" />
                        {img.processingType === "ocr" ? "OCR" : "JSON"}
                      </Badge>
                    ) : (
                      <div className="absolute top-0.5 right-0.5 flex gap-0.5">
                        {img.analyzed && (
                          <Badge variant="secondary" className="text-[7px] h-3.5 px-1 bg-green-500/90 text-white">
                            <Code2 className="h-2 w-2" />
                          </Badge>
                        )}
                        {img.metadata?.ocrText && (
                          <Badge variant="secondary" className="text-[7px] h-3.5 px-1 bg-blue-500/90 text-white">
                            <FileText className="h-2 w-2" />
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Hover overlay with actions */}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                      {/* Action buttons row 1 */}
                      <div className="flex gap-1">
                        <Button 
                          size="icon" 
                          variant="secondary" 
                          className="h-6 w-6" 
                          onClick={() => handleTranscribeOcr(img)}
                          disabled={img.isProcessing}
                          title="Transcrever texto (OCR)"
                        >
                          <FileText className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="secondary" 
                          className="h-6 w-6" 
                          onClick={() => handleAnalyzeJson(img)}
                          disabled={img.isProcessing}
                          title="Analisar estilo (JSON)"
                        >
                          <Code2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* Action buttons row 2 */}
                      <div className="flex gap-1">
                        {(img.analyzed || img.metadata?.ocrText) && (
                          <Button 
                            size="icon" 
                            variant="default" 
                            className="h-6 w-6" 
                            onClick={() => handleViewAnalysis(img)}
                            title="Ver resultados"
                          >
                            <Palette className="h-3 w-3" />
                          </Button>
                        )}
                        <Button 
                          size="icon" 
                          variant={img.metadata?.isPrimary ? "default" : "secondary"} 
                          className="h-6 w-6" 
                          onClick={() => handleSetPrimary(img.id)}
                          title="Definir como principal"
                        >
                          <Star className={cn("h-3 w-3", img.metadata?.isPrimary && "fill-current")} />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="destructive" 
                          className="h-6 w-6" 
                          onClick={() => handleRemoveImage(img.id)}
                          title="Remover"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Style summary from primary image */}
          {styleAnalysis && (
            <div className="p-2 rounded-md bg-muted/50 space-y-1.5">
              {/* Color palette */}
              {styleAnalysis.dominantColors?.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Cores:</span>
                  <div className="flex gap-0.5">
                    {styleAnalysis.dominantColors.slice(0, 5).map((color: string, i: number) => (
                      <div 
                        key={i}
                        className="h-4 w-4 rounded-full border border-border"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Style tags */}
              <div className="flex flex-wrap gap-1">
                {styleAnalysis.visualStyle && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1">
                    {styleAnalysis.visualStyle}
                  </Badge>
                )}
                {styleAnalysis.mood && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1">
                    {styleAnalysis.mood}
                  </Badge>
                )}
                {styleAnalysis.lighting && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1">
                    {styleAnalysis.lighting}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white"
        />
      </Card>

      {/* Analysis Modal */}
      <ImageAnalysisModal
        open={analysisModalOpen}
        onOpenChange={setAnalysisModalOpen}
        analysis={selectedImage?.metadata?.imageAnalysis || null}
        ocrText={selectedImage?.metadata?.ocrText}
        imageName={selectedImage?.name}
        imageUrl={selectedImage?.url}
      />
    </>
  );
}

export const ImageSourceNode = memo(ImageSourceNodeComponent);
