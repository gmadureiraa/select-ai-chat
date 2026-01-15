import { memo, useState, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { ImageIcon, Upload, Loader2, X, Trash2, Star, Code2, Palette } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImageAnalysisModal } from "../ImageAnalysisModal";
import { ImageMetadata } from "../hooks/useCanvasState";

// Types for image source node - re-export from useCanvasState
export interface ImageSourceFile {
  id: string;
  name: string;
  url: string;
  storagePath?: string;
  isProcessing?: boolean;
  analyzed?: boolean;
  metadata?: ImageMetadata;
}

export interface ImageSourceNodeData {
  type: "image-source";
  images: ImageSourceFile[];
}

export interface ImageSourceNodeData {
  type: "image-source";
  images: ImageSourceFile[];
}

interface ImageSourceNodeProps extends NodeProps<ImageSourceNodeData> {
  onUpdateData?: (nodeId: string, data: Partial<ImageSourceNodeData>) => void;
  onDelete?: (nodeId: string) => void;
  onAnalyzeImage?: (nodeId: string, imageId: string) => void;
}

function ImageSourceNodeComponent({
  id,
  data,
  selected,
  onUpdateData,
  onDelete,
  onAnalyzeImage
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
    
    setIsUploading(true);
    const newImages: ImageSourceFile[] = [];

    for (const file of Array.from(files)) {
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
          isProcessing: true, // Start processing immediately
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

      // Trigger automatic analysis for each new image
      for (const img of newImages) {
        onAnalyzeImage?.(id, img.id);
      }

      toast({
        title: `${newImages.length} imagem(ns) adicionada(s)`,
        description: "Analisando automaticamente...",
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

  const handleViewJson = (image: ImageSourceFile) => {
    setSelectedImage(image);
    setAnalysisModalOpen(true);
  };

  // Get first analyzed image's style summary for display
  const primaryImage = images.find(img => img.metadata?.isPrimary) || images[0];
  const styleAnalysis = primaryImage?.metadata?.styleAnalysis;
  const analyzedCount = images.filter(img => img.analyzed).length;
  const processingCount = images.filter(img => img.isProcessing).length;

  return (
    <>
      <Card className={cn(
        "w-[300px] shadow-lg transition-all border-2",
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
                {images.length} {images.length === 1 ? 'imagem' : 'imagens'}
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
              "relative border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
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
                <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
                <span className="text-xs text-muted-foreground">Enviando...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Arraste ou clique (max 2)
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
                  Analisando {processingCount}...
                </Badge>
              )}
              {analyzedCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5 gap-1 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                  <Palette className="h-2.5 w-2.5" />
                  {analyzedCount} analisada(s)
                </Badge>
              )}
            </div>
          )}

          {/* Image grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {images.slice(0, 2).map((img) => (
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
                      <Badge className="absolute top-1 left-1 text-[8px] h-4 px-1 bg-primary">
                        Principal
                      </Badge>
                    )}
                    
                    {/* Status badge */}
                    {img.isProcessing ? (
                      <Badge variant="outline" className="absolute top-1 right-1 text-[8px] h-4 px-1 bg-background/80">
                        <Loader2 className="h-2 w-2 animate-spin" />
                      </Badge>
                    ) : img.analyzed ? (
                      <Badge variant="secondary" className="absolute top-1 right-1 text-[8px] h-4 px-1">
                        <Palette className="h-2 w-2" />
                      </Badge>
                    ) : null}
                    
                    {/* Hover overlay with actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      {img.analyzed && (
                        <Button 
                          size="icon" 
                          variant="secondary" 
                          className="h-6 w-6" 
                          onClick={() => handleViewJson(img)}
                          title="Ver JSON"
                        >
                          <Code2 className="h-3 w-3" />
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
        imageName={selectedImage?.name}
        imageUrl={selectedImage?.url}
      />
    </>
  );
}

export const ImageSourceNode = memo(ImageSourceNodeComponent);
