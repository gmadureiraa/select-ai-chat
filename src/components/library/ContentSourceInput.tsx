import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { transcribeImagesChunked } from "@/lib/transcribeImages";
import { useToast } from "@/hooks/use-toast";
import { usePlanningContentGeneration } from "@/hooks/usePlanningContentGeneration";
import { MentionableInput } from "@/components/planning/MentionableInput";
import { 
  Loader2, 
  Upload, 
  X, 
  Link as LinkIcon, 
  FileText, 
  Image as ImageIcon,
  Video,
  Sparkles,
  Wand2,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AttachedItem {
  id: string;
  type: 'link' | 'youtube' | 'pdf' | 'image' | 'video';
  url: string;
  name?: string;
  thumbnailUrl?: string;
}

interface ExtractedContent {
  text: string;
  metadata?: {
    source_url?: string;
    thumbnail_url?: string;
    title?: string;
    attachments?: AttachedItem[];
  };
}

interface ContentSourceInputProps {
  clientId?: string;
  contentType?: string;
  onExtracted: (result: ExtractedContent) => void;
  onGenerated?: (content: string, images?: string[]) => void;
  showGenerateButton?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  className?: string;
}

export function ContentSourceInput({ 
  clientId,
  contentType = 'tweet',
  onExtracted,
  onGenerated,
  showGenerateButton = true,
  maxFiles = 10,
  maxSizeMB = 20,
  className
}: ContentSourceInputProps) {
  const { toast } = useToast();
  const { generateContent, isGenerating, isFetchingReference } = usePlanningContentGeneration();
  
  const [inputValue, setInputValue] = useState("");
  const [attachedItems, setAttachedItems] = useState<AttachedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingType, setProcessingType] = useState<string | null>(null);

  // Detect content type from URL
  const detectContentType = (url: string): 'youtube' | 'link' | null => {
    if (!url.trim()) return null;
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
        return 'youtube';
      }
      return 'link';
    } catch {
      return null;
    }
  };

  // Add URL
  const handleAddUrl = async () => {
    const url = inputValue.trim();
    if (!url) return;

    // Check if it's a URL or just text
    const type = detectContentType(url);
    if (type) {
      setAttachedItems(prev => [...prev, {
        id: `url-${Date.now()}`,
        type,
        url,
        name: type === 'youtube' ? 'Vídeo do YouTube' : url.substring(0, 40) + '...'
      }]);
      setInputValue("");
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxFiles - attachedItems.filter(i => i.type === 'image').length;
    
    setIsProcessing(true);
    setProcessingType("upload");
    
    try {
      for (const file of Array.from(files).slice(0, remainingSlots)) {
        if (file.size > maxSizeMB * 1024 * 1024) {
          toast({ 
            title: "Arquivo muito grande", 
            description: `${file.name} excede ${maxSizeMB}MB`, 
            variant: "destructive" 
          });
          continue;
        }

        let type: AttachedItem['type'];
        let folder: string;

        if (file.type === 'application/pdf') {
          type = 'pdf';
          folder = 'content-pdfs';
        } else if (file.type.startsWith('image/')) {
          type = 'image';
          folder = 'content-images';
        } else if (file.type.startsWith('video/')) {
          type = 'video';
          folder = 'content-videos';
        } else {
          toast({ title: "Formato não suportado", description: file.name, variant: "destructive" });
          continue;
        }

        const { signedUrl, error } = await uploadAndGetSignedUrl(file, folder);
        if (error || !signedUrl) {
          console.error("Upload error:", error);
          continue;
        }

        setAttachedItems(prev => [...prev, {
          id: `file-${Date.now()}-${Math.random()}`,
          type,
          url: signedUrl,
          name: file.name
        }]);
      }

      toast({ title: "Upload concluído" });
    } catch (error) {
      console.error("Error uploading files:", error);
      toast({ title: "Erro no upload", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setProcessingType(null);
      e.target.value = '';
    }
  };

  // Remove item
  const removeItem = (id: string) => {
    setAttachedItems(prev => prev.filter(item => item.id !== id));
  };

  // Extract content from all attached items
  const handleExtractAll = async () => {
    if (attachedItems.length === 0) return;

    setIsProcessing(true);
    setProcessingType("extract");

    const allTexts: string[] = [];
    let mainThumbnail: string | undefined;
    let mainTitle: string | undefined;
    let mainSourceUrl: string | undefined;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      for (const item of attachedItems) {
        try {
          switch (item.type) {
            case 'link': {
              const { data, error } = await supabase.functions.invoke("scrape-research-link", {
                body: { url: item.url, userId }
              });
              if (error) throw error;
              
              let text = "";
              if (data.title) text += `## ${data.title}\n\n`;
              if (data.description) text += `${data.description}\n\n`;
              if (data.content) text += data.content;
              
              allTexts.push(text.trim());
              mainThumbnail = mainThumbnail || data.ogImage || data.images?.[0];
              mainTitle = mainTitle || data.title;
              mainSourceUrl = mainSourceUrl || item.url;
              break;
            }

            case 'youtube': {
              const { data, error } = await supabase.functions.invoke("extract-youtube", {
                body: { url: item.url, userId }
              });
              if (error) throw error;
              
              const transcript = data?.transcript || data?.transcription;
              if (transcript) {
                allTexts.push(`## Transcrição do Vídeo\n\n${transcript}`);
              }
              mainThumbnail = mainThumbnail || data?.thumbnail;
              mainTitle = mainTitle || data?.title;
              mainSourceUrl = mainSourceUrl || item.url;
              break;
            }

            case 'pdf': {
              const { data, error } = await supabase.functions.invoke("extract-pdf", {
                body: { fileUrl: item.url, fileName: item.name, userId }
              });
              if (error) throw error;
              
              if (data?.extractedText || data?.content) {
                allTexts.push(`## Conteúdo do PDF: ${item.name}\n\n${data.extractedText || data.content}`);
              }
              mainTitle = mainTitle || item.name?.replace(/\.pdf$/i, "");
              break;
            }

            case 'video': {
              const { data, error } = await supabase.functions.invoke("transcribe-video", {
                body: { videoUrl: item.url, userId }
              });
              if (error) throw error;
              
              if (data?.transcription) {
                allTexts.push(`## Transcrição do Vídeo\n\n${data.transcription}`);
              }
              break;
            }

            case 'image': {
              // Images are handled in batch below
              break;
            }
          }
        } catch (err) {
          console.error(`Error processing ${item.type}:`, err);
          toast({ 
            title: "Erro ao processar", 
            description: item.name || item.url.substring(0, 30), 
            variant: "destructive" 
          });
        }
      }

      // Process all images together
      const imageItems = attachedItems.filter(i => i.type === 'image');
      if (imageItems.length > 0) {
        try {
          const transcription = await transcribeImagesChunked(
            imageItems.map(i => i.url),
            { userId, clientId, chunkSize: 1 }
          );
          if (transcription) {
            allTexts.push(`## Transcrição das Imagens\n\n${transcription}`);
          }
        } catch (err) {
          console.error("Error transcribing images:", err);
          toast({ title: "Erro ao transcrever imagens", variant: "destructive" });
        }
      }

      // Combine all extracted text
      const combinedText = allTexts.join("\n\n---\n\n");

      if (combinedText) {
        onExtracted({
          text: combinedText,
          metadata: {
            source_url: mainSourceUrl,
            thumbnail_url: mainThumbnail,
            title: mainTitle,
            attachments: attachedItems
          }
        });
        toast({ title: "Conteúdo extraído com sucesso" });
        setAttachedItems([]);
      } else {
        toast({ title: "Nenhum conteúdo extraído", variant: "destructive" });
      }

    } catch (error) {
      console.error("Error extracting content:", error);
      toast({ title: "Erro na extração", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setProcessingType(null);
    }
  };

  // Generate content with AI
  const handleGenerateContent = async () => {
    if (!clientId || !onGenerated) return;

    // Build reference input from attached items and text input
    let referenceInput = inputValue;
    
    // Add URLs from attached items to reference input
    const urlItems = attachedItems.filter(i => i.type === 'link' || i.type === 'youtube');
    for (const item of urlItems) {
      referenceInput += ` ${item.url}`;
    }

    // For PDFs and images, extract first then generate
    const fileItems = attachedItems.filter(i => i.type === 'pdf' || i.type === 'image' || i.type === 'video');
    if (fileItems.length > 0) {
      // Extract content first
      setIsProcessing(true);
      setProcessingType("extract");
      
      const allTexts: string[] = [];
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      for (const item of fileItems) {
        try {
          if (item.type === 'pdf') {
            const { data } = await supabase.functions.invoke("extract-pdf", {
              body: { fileUrl: item.url, fileName: item.name, userId }
            });
            if (data?.extractedText || data?.content) {
              allTexts.push(data.extractedText || data.content);
            }
          } else if (item.type === 'image') {
            const transcription = await transcribeImagesChunked([item.url], { userId, clientId, chunkSize: 1 });
            if (transcription) allTexts.push(transcription);
          } else if (item.type === 'video') {
            const { data } = await supabase.functions.invoke("transcribe-video", {
              body: { videoUrl: item.url, userId }
            });
            if (data?.transcription) allTexts.push(data.transcription);
          }
        } catch (err) {
          console.error(`Error extracting ${item.type}:`, err);
        }
      }

      if (allTexts.length > 0) {
        referenceInput += `\n\n${allTexts.join('\n\n')}`;
      }
      
      setIsProcessing(false);
      setProcessingType(null);
    }

    // Generate with the combined reference
    const result = await generateContent({
      title: inputValue.substring(0, 100) || 'Conteúdo',
      contentType,
      clientId,
      referenceInput: referenceInput.trim() || undefined
    });

    if (result) {
      onGenerated(result.content, result.images);
      setAttachedItems([]);
      setInputValue("");
    }
  };

  const getItemIcon = (type: AttachedItem['type']) => {
    switch (type) {
      case 'link': return <LinkIcon className="h-3.5 w-3.5" />;
      case 'youtube': return <Video className="h-3.5 w-3.5 text-red-500" />;
      case 'pdf': return <FileText className="h-3.5 w-3.5 text-orange-500" />;
      case 'image': return <ImageIcon className="h-3.5 w-3.5 text-blue-500" />;
      case 'video': return <Video className="h-3.5 w-3.5 text-purple-500" />;
    }
  };

  const hasItems = attachedItems.length > 0;
  const hasInput = inputValue.trim().length > 0;
  const canGenerate = showGenerateButton && clientId && (hasItems || hasInput);
  const isLoading = isProcessing || isGenerating || isFetchingReference;

  return (
    <div className={cn("space-y-3 p-3 rounded-lg border border-dashed bg-muted/30", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Upload className="h-4 w-4" />
        <span>Adicionar Material</span>
        {hasItems && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded ml-auto">
            {attachedItems.length} anexo(s)
          </span>
        )}
      </div>

      {/* Main Input - URL, @mention, or description */}
      <div className="flex gap-2">
        {clientId ? (
          <MentionableInput
            value={inputValue}
            onChange={setInputValue}
            clientId={clientId}
            placeholder="Cole link, use @referência, ou descreva..."
            className="flex-1"
          />
        ) : (
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUrl())}
            placeholder="Cole um link (YouTube, blog, artigo...)"
            className="flex-1 h-9 text-sm"
          />
        )}
        {detectContentType(inputValue) && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddUrl}
            disabled={!inputValue.trim() || isLoading}
            className="h-9 gap-1 shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        )}
      </div>

      {/* File Upload */}
      <div className="flex gap-2 items-center">
        <label className="flex-1">
          <Input
            type="file"
            accept="image/*,video/*,.pdf"
            multiple
            onChange={handleFileUpload}
            disabled={isLoading}
            className="cursor-pointer h-9 text-sm"
          />
        </label>
        {processingType === 'upload' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <p className="text-xs text-muted-foreground">
        PDF, imagens ou vídeos (máx. {maxSizeMB}MB cada)
      </p>

      {/* Attached Items */}
      {hasItems && (
        <div className="space-y-2">
          {attachedItems.map((item) => (
            <div 
              key={item.id} 
              className="flex items-center gap-2 text-xs bg-muted/50 rounded-md p-2"
            >
              {getItemIcon(item.type)}
              <span className="truncate flex-1">{item.name || item.url.substring(0, 40)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => removeItem(item.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {(hasItems || (showGenerateButton && hasInput)) && (
        <div className="flex gap-2">
          {/* Extract Button - only when there are file items */}
          {hasItems && (
            <Button
              type="button"
              variant="outline"
              onClick={handleExtractAll}
              disabled={isLoading}
              className="flex-1 gap-2"
              size="sm"
            >
              {processingType === 'extract' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Extrair Texto
            </Button>
          )}

          {/* Generate Button - when showGenerateButton is true */}
          {canGenerate && (
            <Button
              type="button"
              onClick={handleGenerateContent}
              disabled={isLoading}
              className="flex-1 gap-2"
              size="sm"
            >
              {isGenerating || isFetchingReference ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Gerar Conteúdo com IA
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
