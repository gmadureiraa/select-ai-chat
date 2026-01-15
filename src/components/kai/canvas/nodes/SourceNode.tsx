import { memo, useState, useRef } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Link2, FileText, Upload, Loader2, Check, X, Youtube, FileAudio, FileImage, Trash2, Eye, Wand2, Star, Palette, Code2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SourceNodeData, SourceFile, ImageMetadata } from "../hooks/useCanvasState";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImageAnalysisModal } from "../ImageAnalysisModal";

interface SourceNodeProps extends NodeProps<SourceNodeData> {
  onExtractUrl?: (nodeId: string, url: string) => void;
  onUpdateData?: (nodeId: string, data: Partial<SourceNodeData>) => void;
  onDelete?: (nodeId: string) => void;
  onTranscribeFile?: (nodeId: string, fileId: string) => void;
  onAnalyzeStyle?: (nodeId: string, fileId: string) => void;
}

function isYoutubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function getFileType(file: File): "image" | "audio" | "video" | "document" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

// Component to display image reference with metadata
function ImageReferenceCard({ 
  file, 
  onAnalyze,
  onViewJson,
  onRemove, 
  onSetPrimary,
  isAnalyzing 
}: {
  file: SourceFile;
  onAnalyze: () => void;
  onViewJson: () => void;
  onRemove: () => void;
  onSetPrimary: () => void;
  isAnalyzing?: boolean;
}) {
  const metadata = file.metadata;
  const isAnalyzed = metadata?.analyzed;
  const isPrimary = metadata?.isPrimary;
  
  return (
    <div className={cn(
      "relative group rounded-lg border overflow-hidden bg-background transition-all",
      isPrimary && "ring-2 ring-primary"
    )}>
      {/* Image preview */}
      <div className="relative aspect-square">
        <img 
          src={file.url} 
          alt={file.name}
          className="w-full h-full object-cover"
        />
        
        {/* Primary badge */}
        {isPrimary && (
          <Badge className="absolute top-1 left-1 text-[8px] h-4 px-1 bg-primary">
            Principal
          </Badge>
        )}
        
        {/* Analyzed badge */}
        {isAnalyzed && (
          <Badge variant="secondary" className="absolute top-1 right-1 text-[8px] h-4 px-1">
            <Palette className="h-2 w-2 mr-0.5" />
            Analisado
          </Badge>
        )}
        
        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
          {!isAnalyzed ? (
            <Button 
              size="icon" 
              variant="secondary" 
              className="h-6 w-6" 
              onClick={onAnalyze}
              disabled={isAnalyzing}
              title="Analisar estilo"
            >
              {isAnalyzing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3" />
              )}
            </Button>
          ) : (
            <Button 
              size="icon" 
              variant="secondary" 
              className="h-6 w-6" 
              onClick={onViewJson}
              title="Ver JSON de Análise"
            >
              <Code2 className="h-3 w-3" />
            </Button>
          )}
          <Button 
            size="icon" 
            variant={isPrimary ? "default" : "secondary"} 
            className="h-6 w-6" 
            onClick={onSetPrimary}
            title={isPrimary ? "Referência principal" : "Definir como principal"}
          >
            <Star className={cn("h-3 w-3", isPrimary && "fill-current")} />
          </Button>
          <Button 
            size="icon" 
            variant="destructive" 
            className="h-6 w-6" 
            onClick={onRemove}
            title="Remover"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {/* Metadata summary */}
      {isAnalyzed && metadata?.styleAnalysis && (
        <div className="p-1.5 space-y-1 border-t">
          {/* Color palette */}
          <div className="flex gap-0.5">
            {metadata.styleAnalysis.dominantColors.slice(0, 5).map((color, i) => (
              <div 
                key={i}
                className="h-3 w-3 rounded-full border border-border"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          
          {/* Style tags */}
          <div className="flex flex-wrap gap-0.5">
            {metadata.styleAnalysis.visualStyle && (
              <Badge variant="outline" className="text-[7px] h-3.5 px-1">
                {metadata.styleAnalysis.visualStyle}
              </Badge>
            )}
            {metadata.styleAnalysis.mood && (
              <Badge variant="outline" className="text-[7px] h-3.5 px-1">
                {metadata.styleAnalysis.mood}
              </Badge>
            )}
          </div>
        </div>
      )}
      
      {/* Loading overlay */}
      {file.isProcessing && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

function SourceNodeComponent({ 
  id, 
  data, 
  selected,
  onExtractUrl,
  onUpdateData,
  onDelete,
  onTranscribeFile,
  onAnalyzeStyle
}: SourceNodeProps) {
  const { toast } = useToast();
  const [localUrl, setLocalUrl] = useState(data.value || "");
  const [localText, setLocalText] = useState(data.value || "");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for image analysis modal
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [selectedFileForAnalysis, setSelectedFileForAnalysis] = useState<SourceFile | null>(null);
  
  const handleViewJson = (file: SourceFile) => {
    setSelectedFileForAnalysis(file);
    setAnalysisModalOpen(true);
  };

  const handleExtract = () => {
    if (localUrl.trim() && onExtractUrl) {
      const urlType = isYoutubeUrl(localUrl) ? "youtube" : "article";
      onUpdateData?.(id, { value: localUrl.trim(), sourceType: "url", urlType });
      onExtractUrl(id, localUrl.trim());
    }
  };

  const handleTextChange = (text: string) => {
    setLocalText(text);
    onUpdateData?.(id, { value: text, sourceType: "text", extractedContent: text });
  };

  const handleTabChange = (tab: string) => {
    onUpdateData?.(id, { sourceType: tab as "url" | "text" | "file" });
  };

  // Upload files to Supabase Storage and create structured metadata
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    const newFiles: SourceFile[] = [];

    for (const file of Array.from(selectedFiles)) {
      const fileId = `canvas-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fileType = getFileType(file);
      const filePath = `canvas-uploads/${fileId}/${file.name}`;
      
      try {
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('content-media')
          .upload(filePath, file);
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          // Fallback to object URL if storage fails
          const url = URL.createObjectURL(file);
          
          const metadata: ImageMetadata = {
            uploadedAt: new Date().toISOString(),
            dimensions: null,
            analyzed: false,
            isPrimary: newFiles.length === 0 && (data.files || []).filter(f => f.type === "image").length === 0,
            referenceType: "general"
          };
          
          newFiles.push({
            id: fileId,
            name: file.name,
            type: fileType,
            mimeType: file.type,
            size: file.size,
            url,
            metadata: fileType === "image" ? metadata : undefined,
            isProcessing: false,
          });
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('content-media')
          .getPublicUrl(filePath);

        // Create structured metadata for images
        const metadata: ImageMetadata = {
          uploadedAt: new Date().toISOString(),
          dimensions: null,
          analyzed: false,
          isPrimary: newFiles.length === 0 && (data.files || []).filter(f => f.type === "image").length === 0,
          referenceType: "general"
        };

        const newFile: SourceFile = {
          id: fileId,
          name: file.name,
          type: fileType,
          mimeType: file.type,
          size: file.size,
          url: publicUrl,
          storagePath: filePath,
          metadata: fileType === "image" ? metadata : undefined,
          isProcessing: false,
        };

        // For images, extract dimensions
        if (fileType === "image") {
          const img = new Image();
          img.onload = () => {
            const existingFiles = data.files || [];
            const updatedFiles = [...existingFiles, ...newFiles].map(f => 
              f.id === fileId 
                ? { 
                    ...f, 
                    metadata: { 
                      ...f.metadata, 
                      dimensions: { width: img.width, height: img.height } 
                    } as ImageMetadata
                  } 
                : f
            );
            onUpdateData?.(id, { files: updatedFiles });
          };
          img.src = publicUrl;
        }

        newFiles.push(newFile);
      } catch (error) {
        console.error('Error processing file:', error);
        toast({
          title: "Erro no upload",
          description: `Não foi possível fazer upload de ${file.name}`,
          variant: "destructive",
        });
      }
    }

    if (newFiles.length > 0) {
      const existingFiles = data.files || [];
      onUpdateData?.(id, { 
        sourceType: "file",
        files: [...existingFiles, ...newFiles] 
      });

      const imageCount = newFiles.filter(f => f.type === "image").length;
      if (imageCount > 0) {
        toast({
          title: `${imageCount} imagem(ns) adicionada(s)`,
          description: "Clique em 'Analisar' para extrair estilos",
        });
      }
    }

    setIsUploading(false);
  };

  const handleRemoveFile = (fileId: string) => {
    const updatedFiles = (data.files || []).filter(f => f.id !== fileId);
    onUpdateData?.(id, { files: updatedFiles });
  };

  const handleSetPrimary = (fileId: string) => {
    const updatedFiles = (data.files || []).map(f => ({
      ...f,
      metadata: f.type === "image" 
        ? { 
            ...f.metadata, 
            isPrimary: f.id === fileId,
            uploadedAt: f.metadata?.uploadedAt || new Date().toISOString(),
            dimensions: f.metadata?.dimensions || null,
            analyzed: f.metadata?.analyzed || false,
          } as ImageMetadata
        : f.metadata
    }));
    onUpdateData?.(id, { files: updatedFiles });
    
    toast({
      title: "Referência principal definida",
      description: "Esta imagem será usada como referência prioritária",
    });
  };

  const handleAnalyzeAll = async () => {
    const imageFiles = (data.files || []).filter(f => f.type === "image" && !f.metadata?.analyzed);
    
    if (imageFiles.length === 0) {
      toast({
        title: "Nenhuma imagem para analisar",
        description: "Todas as imagens já foram analisadas",
      });
      return;
    }

    for (const file of imageFiles) {
      onAnalyzeStyle?.(id, file.id);
    }

    toast({
      title: `Analisando ${imageFiles.length} imagem(ns)`,
      description: "O processo pode levar alguns segundos",
    });
  };

  const handleTranscribe = (fileId: string) => {
    onTranscribeFile?.(id, fileId);
  };

  const handleAnalyzeStyle = (fileId: string) => {
    onAnalyzeStyle?.(id, fileId);
  };

  const isYoutube = data.urlType === "youtube" || (localUrl && isYoutubeUrl(localUrl));
  
  // Separate image files from other files
  const imageFiles = (data.files || []).filter(f => f.type === "image");
  const otherFiles = (data.files || []).filter(f => f.type !== "image");
  const unanalyzedImages = imageFiles.filter(f => !f.metadata?.analyzed);

  return (
    <Card className={cn(
      "w-[340px] shadow-lg transition-all border-2",
      selected ? "border-primary ring-2 ring-primary/20" : "border-blue-500/50",
      "bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-background"
    )}>
      <CardHeader className="pb-2 pt-3 px-3 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-blue-500 flex items-center justify-center">
            <Link2 className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-medium text-sm">Fonte</span>
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
        <Tabs 
          value={data.sourceType} 
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="url" className="text-xs gap-1">
              <Link2 className="h-3 w-3" />
              URL
            </TabsTrigger>
            <TabsTrigger value="text" className="text-xs gap-1">
              <FileText className="h-3 w-3" />
              Texto
            </TabsTrigger>
            <TabsTrigger value="file" className="text-xs gap-1">
              <Upload className="h-3 w-3" />
              Arquivo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="mt-2 space-y-2">
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Input
                  placeholder="Cole a URL aqui..."
                  value={localUrl}
                  onChange={(e) => setLocalUrl(e.target.value)}
                  className={cn(
                    "h-8 text-xs pr-8",
                    isYoutube && "border-red-500/50"
                  )}
                  disabled={data.isExtracting}
                />
                {isYoutube && (
                  <Youtube className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                )}
              </div>
              <Button
                size="sm"
                className="h-8 px-2"
                onClick={handleExtract}
                disabled={!localUrl.trim() || data.isExtracting}
              >
                {data.isExtracting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            
            {data.urlType && (
              <Badge variant="secondary" className="text-[10px]">
                {data.urlType === "youtube" ? "🎬 YouTube - Transcrição" : "📄 Artigo"}
              </Badge>
            )}

            {data.thumbnail && (
              <img 
                src={data.thumbnail} 
                alt="Thumbnail" 
                className="w-full h-20 object-cover rounded-md"
              />
            )}

            {data.extractedContent && (
              <div className="p-2 rounded-md bg-muted/50 max-h-[100px] overflow-y-auto">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">
                  {data.title || "Conteúdo extraído"}
                </p>
                <p className="text-[10px] line-clamp-4">
                  {data.extractedContent.substring(0, 300)}...
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="text" className="mt-2">
            <Textarea
              placeholder="Cole ou digite o texto aqui..."
              value={localText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-[80px] text-xs resize-none"
              rows={4}
            />
          </TabsContent>

          <TabsContent value="file" className="mt-2 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.docx,.doc,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <div 
              className={cn(
                "border-2 border-dashed rounded-md p-3 text-center hover:border-primary/50 transition-colors cursor-pointer",
                isUploading && "opacity-50 pointer-events-none"
              )}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 mx-auto text-primary animate-spin mb-1" />
              ) : (
                <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              )}
              <p className="text-xs text-muted-foreground">
                {isUploading ? "Fazendo upload..." : "Arraste ou clique para upload"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Imagens, áudio, vídeo, PDF, DOCX
              </p>
            </div>

            {/* Image references grid */}
            {imageFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    Referências Visuais ({imageFiles.length})
                  </span>
                  {unanalyzedImages.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 text-[10px] px-2"
                      onClick={handleAnalyzeAll}
                    >
                      <Wand2 className="h-3 w-3 mr-1" />
                      Analisar Todas
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-1.5">
                  {imageFiles.map((file) => (
                    <ImageReferenceCard
                      key={file.id}
                      file={file}
                      onAnalyze={() => handleAnalyzeStyle(file.id)}
                      onViewJson={() => handleViewJson(file)}
                      onRemove={() => handleRemoveFile(file.id)}
                      onSetPrimary={() => handleSetPrimary(file.id)}
                      isAnalyzing={file.isProcessing}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other files list */}
            {otherFiles.length > 0 && (
              <ScrollArea className="max-h-[100px]">
                <div className="space-y-1.5">
                  {otherFiles.map((file) => (
                    <div 
                      key={file.id}
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group"
                    >
                      {file.type === "audio" && (
                        <FileAudio className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                      {file.type === "video" && (
                        <FileAudio className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      {file.type === "document" && (
                        <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] truncate font-medium">{file.name}</p>
                        {file.transcription && (
                          <p className="text-[9px] text-green-600 dark:text-green-400">
                            ✓ Transcrito
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(file.type === "audio" || file.type === "video") && !file.transcription && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => handleTranscribe(file.id)}
                            disabled={file.isProcessing}
                            title="Transcrever"
                          >
                            {file.isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wand2 className="h-3 w-3" />
                            )}
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:text-destructive"
                          onClick={() => handleRemoveFile(file.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
      
      {/* Image Analysis Modal */}
      <ImageAnalysisModal
        open={analysisModalOpen}
        onOpenChange={setAnalysisModalOpen}
        analysis={selectedFileForAnalysis?.metadata?.imageAnalysis || null}
        imageName={selectedFileForAnalysis?.name}
        imageUrl={selectedFileForAnalysis?.url}
      />
    </Card>
  );
}

export const SourceNode = memo(SourceNodeComponent);
