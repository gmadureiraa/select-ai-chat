import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { 
  Paperclip, Link2, FileText, Upload, ImageIcon, 
  Loader2, X, Youtube, FileAudio, Trash2, Star, 
  Code2, Palette, Maximize2, Minimize2, Instagram,
  Eye, FileVideo
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedCallback } from "@/hooks/useDebounce";
import { ImageAnalysisModal } from "../ImageAnalysisModal";
import { ExtractedContentPreview, ContentMetadata } from "../ExtractedContentPreview";
import { ContentViewerModal } from "../ContentViewerModal";
import { ImageMetadata, SourceFile } from "../hooks/useCanvasState";

// Types for attachment node - unified version
export interface AttachmentImage {
  id: string;
  name: string;
  url: string;
  storagePath?: string;
  isProcessing?: boolean;
  processingType?: "json" | "ocr" | null;
  analyzed?: boolean;
  metadata?: ImageMetadata;
}

export interface AttachmentNodeData {
  type: "attachment";
  activeTab: "link" | "text" | "file" | "image";
  // Link tab
  url?: string;
  urlType?: "youtube" | "article" | "instagram";
  extractedContent?: string;
  extractedImages?: string[];
  isExtracting?: boolean;
  title?: string;
  thumbnail?: string;
  contentMetadata?: ContentMetadata;
  // Text tab
  textContent?: string;
  // File tab
  files?: SourceFile[];
  // Image tab
  images?: AttachmentImage[];
}

const MAX_IMAGES = 10;

interface AttachmentNodeProps extends NodeProps<AttachmentNodeData> {
  onExtractUrl?: (nodeId: string, url: string) => void;
  onUpdateData?: (nodeId: string, data: Partial<AttachmentNodeData>) => void;
  onDelete?: (nodeId: string) => void;
  onTranscribeFile?: (nodeId: string, fileId: string) => void;
  onAnalyzeStyle?: (nodeId: string, fileId: string) => void;
  onAnalyzeImage?: (nodeId: string, imageId: string, imageUrl: string) => void;
  onTranscribeImage?: (nodeId: string, imageId: string, imageUrl: string) => void;
}

function isYoutubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function isInstagramUrl(url: string): boolean {
  return url.includes("instagram.com/p/") || url.includes("instagram.com/reel/") || url.includes("instagr.am");
}

function getFileType(file: File): "image" | "audio" | "video" | "document" {
  const ext = file.name.split('.').pop()?.toLowerCase() || "";
  const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma', 'opus', 'webm'];
  const videoExtensions = ['mp4', 'wmv', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'flv', '3gp'];
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'svg', 'tiff'];
  
  if (imageExtensions.includes(ext) || file.type.startsWith("image/")) return "image";
  if (audioExtensions.includes(ext) || file.type.startsWith("audio/")) return "audio";
  if (videoExtensions.includes(ext) || file.type.startsWith("video/")) return "video";
  return "document";
}

function AttachmentNodeComponent({
  id,
  data,
  selected,
  onExtractUrl,
  onUpdateData,
  onDelete,
  onTranscribeFile,
  onAnalyzeStyle,
  onAnalyzeImage,
  onTranscribeImage
}: AttachmentNodeProps) {
  const { toast } = useToast();
  const [localUrl, setLocalUrl] = useState(data.url || "");
  const [localText, setLocalText] = useState(data.textContent || "");
  const [isUploading, setIsUploading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [contentViewerOpen, setContentViewerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  // Image analysis modal
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<AttachmentImage | null>(null);

  const activeTab = data.activeTab || "link";
  const images = data.images || [];
  const files = data.files || [];

  // URL handlers
  const handleExtract = () => {
    if (localUrl.trim() && onExtractUrl) {
      let urlType: "youtube" | "article" | "instagram" = "article";
      if (isYoutubeUrl(localUrl)) urlType = "youtube";
      else if (isInstagramUrl(localUrl)) urlType = "instagram";
      
      onUpdateData?.(id, { url: localUrl.trim(), urlType });
      onExtractUrl(id, localUrl.trim());
    }
  };

  // Debounced text update to avoid excessive re-renders
  const debouncedTextUpdate = useDebouncedCallback(
    (text: string) => {
      onUpdateData?.(id, { textContent: text, extractedContent: text });
    },
    500
  );

  // Text handlers
  const handleTextChange = (text: string) => {
    setLocalText(text);
    debouncedTextUpdate(text);
  };

  // Tab handlers
  const handleTabChange = (tab: string) => {
    onUpdateData?.(id, { activeTab: tab as AttachmentNodeData["activeTab"] });
  };

  // File upload handlers
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
        const { error: uploadError } = await supabase.storage
          .from('content-media')
          .upload(filePath, file);
        
        let url: string;
        if (uploadError) {
          console.error('Upload error:', uploadError);
          url = URL.createObjectURL(file);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('content-media')
            .getPublicUrl(filePath);
          url = publicUrl;
        }

        const newFile: SourceFile = {
          id: fileId,
          name: file.name,
          type: fileType,
          mimeType: file.type,
          size: file.size,
          url,
          storagePath: uploadError ? undefined : filePath,
          isProcessing: false,
        };

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
      onUpdateData?.(id, { files: [...existingFiles, ...newFiles] });

      const audioVideoCount = newFiles.filter(f => f.type === "audio" || f.type === "video").length;
      
      if (audioVideoCount > 0) {
        toast({
          title: `${audioVideoCount} arquivo(s) de mídia adicionado(s)`,
          description: "Iniciando transcrição automática...",
        });
        
        for (const file of newFiles.filter(f => f.type === "audio" || f.type === "video")) {
          setTimeout(() => {
            onTranscribeFile?.(id, file.id);
          }, 500);
        }
      } else {
        toast({
          title: `${newFiles.length} arquivo(s) adicionado(s)`,
        });
      }
    }

    setIsUploading(false);
  };

  // Image upload handlers
  const handleImageSelect = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    
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
    
    const filesToProcess = Array.from(fileList).slice(0, availableSlots);
    
    if (filesToProcess.length < fileList.length) {
      toast({
        title: "Limite de imagens",
        description: `Apenas ${filesToProcess.length} de ${fileList.length} imagens serão adicionadas`,
      });
    }
    
    setIsUploading(true);
    const newImages: AttachmentImage[] = [];

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

        newImages.push({
          id: imageId,
          name: file.name,
          url: imageUrl,
          storagePath: uploadError ? undefined : filePath,
          isProcessing: false,
          analyzed: false,
          metadata: {
            uploadedAt: new Date().toISOString(),
            isPrimary: images.length === 0 && newImages.length === 0,
            dimensions: { width: 0, height: 0 },
            analyzed: false,
          }
        });
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
      onUpdateData?.(id, { images: [...images, ...newImages] });
      toast({
        title: `${newImages.length} imagem(ns) adicionada(s)`,
        description: "Use os botões OCR ou JSON para processar",
      });
    }

    setIsUploading(false);
  };

  const handleRemoveFile = (fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    onUpdateData?.(id, { files: updatedFiles });
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
    });
  };

  const handleViewAnalysis = (image: AttachmentImage) => {
    setSelectedImage(image);
    setAnalysisModalOpen(true);
  };

  const handleAnalyzeJson = (image: AttachmentImage) => {
    if (image.isProcessing) return;
    onAnalyzeImage?.(id, image.id, image.url);
  };

  const handleTranscribeOcr = (image: AttachmentImage) => {
    if (image.isProcessing) return;
    onTranscribeImage?.(id, image.id, image.url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (activeTab === "image") {
      handleImageSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const isYoutube = data.urlType === "youtube" || (localUrl && isYoutubeUrl(localUrl));
  const isInstagram = data.urlType === "instagram" || (localUrl && isInstagramUrl(localUrl));
  
  const cardWidth = isExpanded ? "w-[500px]" : "w-[340px]";
  const analyzedCount = images.filter(img => img.analyzed).length;
  const ocrCount = images.filter(img => img.metadata?.ocrText).length;
  const processingCount = images.filter(img => img.isProcessing).length;

  // Get URL icon
  const getUrlIcon = () => {
    if (isYoutube) return <Youtube className="h-3.5 w-3.5 text-red-500" />;
    if (isInstagram) return <Instagram className="h-3.5 w-3.5 text-pink-500" />;
    return <Link2 className="h-3.5 w-3.5" />;
  };

  return (
    <>
      <Card className={cn(
        cardWidth,
        "shadow-lg transition-all border-2",
        selected ? "border-primary ring-2 ring-primary/20" : "border-blue-500/50",
        isDragging && activeTab === "image" && "border-blue-400 bg-blue-50/50 dark:bg-blue-950/30",
        "bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-background"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      >
        <CardHeader className="pb-2 pt-3 px-3 flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-blue-500 flex items-center justify-center">
              <Paperclip className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-medium text-sm">Anexo</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Minimizar" : "Expandir"}
            >
              {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete?.(id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-3 pb-3 space-y-3">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-8">
              <TabsTrigger value="link" className="text-[10px] gap-1 px-1">
                <Link2 className="h-3 w-3" />
                Link
              </TabsTrigger>
              <TabsTrigger value="text" className="text-[10px] gap-1 px-1">
                <FileText className="h-3 w-3" />
                Texto
              </TabsTrigger>
              <TabsTrigger value="file" className="text-[10px] gap-1 px-1">
                <Upload className="h-3 w-3" />
                Arquivo
              </TabsTrigger>
              <TabsTrigger value="image" className="text-[10px] gap-1 px-1">
                <ImageIcon className="h-3 w-3" />
                Imagem
              </TabsTrigger>
            </TabsList>

            {/* LINK TAB */}
            <TabsContent value="link" className="mt-2 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Cole uma URL (YouTube, Instagram, artigo...)"
                    value={localUrl}
                    onChange={(e) => setLocalUrl(e.target.value)}
                    className="h-8 text-xs pr-8"
                    onKeyDown={(e) => e.key === "Enter" && handleExtract()}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {getUrlIcon()}
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={handleExtract}
                  disabled={!localUrl.trim() || data.isExtracting}
                  className="h-8 px-3 text-xs"
                >
                  {data.isExtracting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Extrair"
                  )}
                </Button>
              </div>

              {/* Extracted content preview */}
              {data.extractedContent && (
                <ExtractedContentPreview
                  content={data.extractedContent}
                  title={data.title}
                  thumbnail={data.thumbnail}
                  urlType={data.urlType}
                  metadata={data.contentMetadata}
                  images={data.extractedImages}
                  isExpanded={isExpanded}
                  onToggleExpand={() => setIsExpanded(!isExpanded)}
                  onOpenFullView={() => setContentViewerOpen(true)}
                />
              )}
            </TabsContent>

            {/* TEXT TAB */}
            <TabsContent value="text" className="mt-2">
              <Textarea
                placeholder="Cole ou digite o texto de referência..."
                value={localText}
                onChange={(e) => handleTextChange(e.target.value)}
                className={cn(
                  "text-xs resize-none",
                  isExpanded ? "min-h-[200px]" : "min-h-[100px]"
                )}
              />
              {localText && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  {localText.split(/\s+/).filter(Boolean).length} palavras
                </div>
              )}
            </TabsContent>

            {/* FILE TAB */}
            <TabsContent value="file" className="mt-2 space-y-2">
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
                  "border-muted-foreground/30 hover:border-blue-400"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.mp3,.wav,.mp4,.mov"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    <span className="text-xs text-muted-foreground">Enviando...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      PDF, DOCX, áudio ou vídeo
                    </span>
                  </div>
                )}
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-1.5">
                  {files.map((file) => (
                    <div key={file.id} className="flex flex-col gap-1 p-2 rounded-md bg-muted/50 text-xs">
                      <div className="flex items-center gap-2">
                        {file.type === "audio" && <FileAudio className="h-4 w-4 text-purple-500" />}
                        {file.type === "video" && <FileVideo className="h-4 w-4 text-red-500" />}
                        {file.type === "document" && <FileText className="h-4 w-4 text-blue-500" />}
                        <span className="flex-1 truncate">{file.name}</span>
                        {file.isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
                        {file.transcription && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => {
                              setContentViewerOpen(true);
                              // Temporarily set extracted content to show transcription
                              onUpdateData?.(id, { 
                                extractedContent: file.transcription,
                                title: `Transcrição: ${file.name}`
                              });
                            }}
                            title="Ver transcrição"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                        {(file.type === "audio" || file.type === "video") && !file.transcription && !file.isProcessing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-[9px] px-2"
                            onClick={() => onTranscribeFile?.(id, file.id)}
                          >
                            Transcrever
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleRemoveFile(file.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {/* Show transcription preview */}
                      {file.transcription && (
                        <div className="text-[10px] text-muted-foreground pl-6 line-clamp-2 bg-muted/50 rounded p-1.5">
                          {file.transcription.substring(0, 200)}...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* IMAGE TAB */}
            <TabsContent value="image" className="mt-2 space-y-2">
              {/* Drop zone */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer",
                  isDragging 
                    ? "border-blue-400 bg-blue-50 dark:bg-blue-950/50" 
                    : "border-muted-foreground/30 hover:border-blue-400"
                )}
                onClick={() => imageInputRef.current?.click()}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImageSelect(e.target.files)}
                />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    <span className="text-xs text-muted-foreground">Enviando...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Arraste ou clique (max {MAX_IMAGES})
                    </span>
                  </div>
                )}
              </div>

              {/* Status badges */}
              {images.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] h-5">
                    {images.length}/{MAX_IMAGES}
                  </Badge>
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

              {/* Image grid */}
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
                        
                        {img.metadata?.isPrimary && (
                          <Badge className="absolute top-0.5 left-0.5 text-[7px] h-3.5 px-1 bg-primary">
                            Principal
                          </Badge>
                        )}
                        
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
                        
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                          <div className="flex gap-1">
                            <Button 
                              size="icon" 
                              variant="secondary" 
                              className="h-6 w-6 nodrag" 
                              onClick={(e) => { e.stopPropagation(); handleTranscribeOcr(img); }}
                              disabled={img.isProcessing}
                              title="Transcrever (OCR)"
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="secondary" 
                              className="h-6 w-6 nodrag" 
                              onClick={(e) => { e.stopPropagation(); handleAnalyzeJson(img); }}
                              disabled={img.isProcessing}
                              title="Analisar (JSON)"
                            >
                              <Code2 className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          <div className="flex gap-1">
                            {(img.analyzed || img.metadata?.ocrText) && (
                              <Button 
                                size="icon" 
                                variant="default" 
                                className="h-6 w-6 nodrag" 
                                onClick={(e) => { e.stopPropagation(); handleViewAnalysis(img); }}
                                title="Ver resultados"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            )}
                            <Button 
                              size="icon" 
                              variant={img.metadata?.isPrimary ? "default" : "secondary"} 
                              className="h-6 w-6 nodrag" 
                              onClick={(e) => { e.stopPropagation(); handleSetPrimary(img.id); }}
                              title="Definir como principal"
                            >
                              <Star className={cn("h-3 w-3", img.metadata?.isPrimary && "fill-current")} />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="destructive" 
                              className="h-6 w-6 nodrag" 
                              onClick={(e) => { e.stopPropagation(); handleRemoveImage(img.id); }}
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
            </TabsContent>
          </Tabs>
        </CardContent>

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
        />
      </Card>

      {/* Modals */}
      {selectedImage && (
        <ImageAnalysisModal
          open={analysisModalOpen}
          onOpenChange={(open) => {
            setAnalysisModalOpen(open);
            if (!open) setSelectedImage(null);
          }}
          imageUrl={selectedImage.url}
          imageName={selectedImage.name}
          analysis={selectedImage.metadata?.imageAnalysis || null}
          ocrText={selectedImage.metadata?.ocrText}
        />
      )}

      {data.extractedContent && (
        <ContentViewerModal
          open={contentViewerOpen}
          onOpenChange={setContentViewerOpen}
          title={data.title || "Conteúdo Extraído"}
          content={data.extractedContent}
          thumbnail={data.thumbnail}
          metadata={data.contentMetadata}
          images={data.extractedImages}
          urlType={data.urlType}
        />
      )}
    </>
  );
}

export const AttachmentNode = memo(AttachmentNodeComponent);
