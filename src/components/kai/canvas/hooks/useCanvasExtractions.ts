import { useCallback } from "react";
import { Node } from "reactflow";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  SourceNodeData, 
  AttachmentNodeData, 
  CanvasNodeData,
  ImageMetadata,
  ImageSourceNodeData
} from "./useCanvasState";

// Cache for transcriptions
const CACHE_KEY = "canvas_transcription_cache";
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  data: any;
  timestamp: number;
  hash: string;
}

// Generate a simple hash for content
function generateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// Cache management functions
function getCache(key: string): any | null {
  try {
    const cacheData = localStorage.getItem(CACHE_KEY);
    if (!cacheData) return null;
    
    const cache: Record<string, CacheEntry> = JSON.parse(cacheData);
    const entry = cache[key];
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > CACHE_DURATION_MS) {
      delete cache[key];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return null;
    }
    
    return entry.data;
  } catch (e) {
    console.warn("Cache read error:", e);
    return null;
  }
}

function setCache(key: string, data: any, hash: string): void {
  try {
    const cacheData = localStorage.getItem(CACHE_KEY);
    const cache: Record<string, CacheEntry> = cacheData ? JSON.parse(cacheData) : {};
    
    // Limit cache size to 50 entries
    const keys = Object.keys(cache);
    if (keys.length >= 50) {
      // Remove oldest entries
      const sorted = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
      for (let i = 0; i < 10; i++) {
        delete cache[sorted[i]];
      }
    }
    
    cache[key] = { data, timestamp: Date.now(), hash };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Cache write error:", e);
  }
}

// Helper to convert blob URL to base64 data URL
export async function blobUrlToBase64(blobUrl: string): Promise<string> {
  if (blobUrl.startsWith('data:') || blobUrl.startsWith('http')) {
    return blobUrl;
  }
  
  if (blobUrl.startsWith('blob:')) {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to convert blob URL to base64:', error);
      throw new Error('Failed to process image');
    }
  }
  
  return blobUrl;
}

function isYoutubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

interface UseCanvasExtractionsProps {
  nodes: Node<CanvasNodeData>[];
  updateNodeData: (nodeId: string, updates: Partial<CanvasNodeData>) => void;
  updateImageInNode: (nodeId: string, imageId: string, updates: any) => void;
}

export function useCanvasExtractions({
  nodes,
  updateNodeData,
  updateImageInNode
}: UseCanvasExtractionsProps) {
  const { toast } = useToast();

  // Extract URL content (YouTube, Instagram, or article)
  const extractUrlContent = useCallback(async (nodeId: string, url: string) => {
    updateNodeData(nodeId, { isExtracting: true } as Partial<SourceNodeData>);

    // Check cache first
    const cacheKey = `url_${generateHash(url)}`;
    const cached = getCache(cacheKey);
    if (cached) {
      console.log("[extractUrlContent] Using cached content for:", url);
      updateNodeData(nodeId, {
        ...cached,
        isExtracting: false
      } as Partial<SourceNodeData>);
      toast({
        title: "Conteúdo carregado do cache",
        description: cached.title || url,
      });
      return;
    }

    try {
      const isYoutube = isYoutubeUrl(url);
      const isInstagram = url.includes("instagram.com/p/") || url.includes("instagram.com/reel/") || url.includes("instagr.am");
      
      if (isYoutube) {
        const { data, error } = await supabase.functions.invoke("extract-youtube", {
          body: { url }
        });

        if (error) throw error;

        const transcript = data.content || data.transcript || "";
        const hasTranscript = data.hasTranscript !== false && transcript.length > 0;
        const wordCount = transcript ? transcript.split(/\s+/).length : 0;
        
        const extractedData = {
          extractedContent: transcript,
          title: data.title || url,
          thumbnail: data.thumbnail || "",
          urlType: "youtube" as const,
          contentMetadata: {
            channel: data.channel || data.author || data.metadata?.author,
            duration: data.duration || data.metadata?.duration,
            views: data.views,
            wordCount,
            sourceUrl: url,
            source: "YouTube",
            transcriptUnavailable: !hasTranscript,
          }
        };

        // Cache the result
        setCache(cacheKey, extractedData, generateHash(url));
        
        updateNodeData(nodeId, {
          ...extractedData,
          isExtracting: false,
        } as Partial<SourceNodeData>);

        if (hasTranscript) {
          toast({
            title: "YouTube extraído",
            description: `"${data.title || url}" transcrito com sucesso`,
          });
        } else {
          toast({
            title: "Vídeo carregado",
            description: `"${data.title || url}" carregado, mas a transcrição não está disponível.`,
          });
        }
      } else if (isInstagram) {
        const isReels = url.includes("/reel/");
        
        toast({
          title: isReels ? "Extraindo Reels..." : "Extraindo Instagram...",
          description: isReels ? "Baixando vídeo para transcrição" : "Buscando imagens e legenda do post",
        });

        const { data: extractData, error: extractError } = await supabase.functions.invoke(
          "extract-instagram",
          { body: { url } }
        );

        if (extractError) throw extractError;
        if (extractData?.error) throw new Error(extractData.error);

        const images: string[] = extractData.images || [];
        const caption: string = extractData.caption || "";

        if (images.length === 0) {
          throw new Error("Nenhuma mídia encontrada no post");
        }

        let transcription = "";
        
        if (isReels) {
          try {
            const videoUrl = images[0];
            const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke(
              "transcribe-media",
              { body: { url: videoUrl, fileName: "reels.mp4" } }
            );

            if (!transcribeError && transcribeData?.text) {
              transcription = transcribeData.text;
            }
          } catch (transcribeErr) {
            console.warn("Failed to transcribe Reels audio:", transcribeErr);
          }
        }
        
        if (!transcription && !isReels) {
          try {
            const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke(
              "transcribe-images",
              { body: { imageUrls: images, startIndex: 1 } }
            );

            if (!transcribeError && transcribeData?.transcription) {
              transcription = transcribeData.transcription;
            }
          } catch (transcribeErr) {
            console.warn("Failed to transcribe Instagram images:", transcribeErr);
          }
        }

        let fullContent = "";
        if (transcription) {
          const transcriptionLabel = isReels ? "🎬 **Transcrição do Vídeo:**" : "📝 **Transcrição das Imagens:**";
          fullContent += `${transcriptionLabel}\n\n${transcription}`;
        }
        if (caption) {
          fullContent += `\n\n📷 **Legenda Original:**\n\n${caption}`;
        }

        const wordCount = fullContent.split(/\s+/).length;
        const contentType = isReels ? "Reels" : (images.length > 1 ? "Carrossel" : "Post");

        const extractedData = {
          extractedContent: fullContent || caption || "Conteúdo extraído do Instagram",
          extractedImages: images,
          title: caption ? caption.substring(0, 60) + (caption.length > 60 ? "..." : "") : `${contentType} do Instagram`,
          thumbnail: images[0] || "",
          urlType: "instagram" as const,
          contentMetadata: {
            wordCount,
            sourceUrl: url,
            source: `Instagram ${contentType}`,
          }
        };

        setCache(cacheKey, extractedData, generateHash(url));
        
        updateNodeData(nodeId, {
          ...extractedData,
          isExtracting: false,
        } as Partial<SourceNodeData>);

        toast({
          title: `${contentType} importado ✓`,
          description: isReels 
            ? "Áudio transcrito com sucesso" 
            : `${images.length} imagem(ns) extraída(s)`,
        });
      } else {
        const { data, error } = await supabase.functions.invoke("fetch-reference-content", {
          body: { url }
        });

        if (error) throw error;
        
        if (!data.success) {
          throw new Error(data.error || "Falha ao extrair conteúdo");
        }

        const extractedText = data.content || data.markdown || "";
        const wordCount = extractedText.split(/\s+/).length;
        const urlType = data.type === "newsletter" ? "newsletter" : "article";
        
        let sourceDomain = "";
        try {
          sourceDomain = new URL(url).hostname.replace("www.", "");
        } catch {}
        
        const extractedData = {
          extractedContent: extractedText,
          extractedImages: data.images || [],
          title: data.title || url,
          thumbnail: data.thumbnail || "",
          urlType,
          contentMetadata: {
            author: data.author,
            publishDate: data.publishDate || data.date,
            wordCount,
            sourceUrl: url,
            source: sourceDomain,
          }
        };

        setCache(cacheKey, extractedData, generateHash(url));
        
        updateNodeData(nodeId, {
          ...extractedData,
          isExtracting: false,
        } as Partial<SourceNodeData>);

        toast({
          title: "Conteúdo extraído",
          description: `"${data.title || url}" foi processado`,
        });
      }
    } catch (error) {
      console.error("Error extracting URL:", error);
      updateNodeData(nodeId, { isExtracting: false } as Partial<SourceNodeData>);
      toast({
        title: "Erro na extração",
        description: error instanceof Error ? error.message : "Não foi possível extrair o conteúdo",
        variant: "destructive",
      });
    }
  }, [updateNodeData, toast]);

  // Transcribe audio/video file
  const transcribeFile = useCallback(async (nodeId: string, fileId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || (node.data.type !== "source" && node.data.type !== "attachment")) return;

    const nodeData = node.data as SourceNodeData | AttachmentNodeData;
    const files = nodeData.files || [];
    const fileIndex = files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) return;

    const file = files[fileIndex];
    
    if (file.type !== "audio" && file.type !== "video") {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Apenas arquivos de áudio e vídeo podem ser transcritos",
        variant: "destructive",
      });
      return;
    }

    // Check cache
    const cacheKey = `file_${file.name}_${file.size}`;
    const cached = getCache(cacheKey);
    if (cached?.transcription) {
      console.log("[transcribeFile] Using cached transcription for:", file.name);
      const finalFiles = [...files];
      finalFiles[fileIndex] = { ...finalFiles[fileIndex], transcription: cached.transcription };
      updateNodeData(nodeId, { files: finalFiles } as Partial<SourceNodeData | AttachmentNodeData>);
      toast({
        title: "Transcrição carregada do cache",
        description: file.name,
      });
      return;
    }

    // Mark file as processing
    const updatedFiles = [...files];
    updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], isProcessing: true };
    updateNodeData(nodeId, { files: updatedFiles } as Partial<SourceNodeData | AttachmentNodeData>);

    try {
      let requestBody: { url?: string; base64?: string; fileName: string; mimeType?: string };
      
      if (file.url.startsWith('blob:')) {
        const response = await fetch(file.url);
        const blob = await response.blob();
        
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        requestBody = {
          base64,
          fileName: file.name,
          mimeType: file.mimeType || blob.type
        };
      } else {
        requestBody = { 
          url: file.url,
          fileName: file.name,
          mimeType: file.mimeType
        };
      }
      
      const { data, error } = await supabase.functions.invoke("transcribe-media", {
        body: requestBody
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const transcription = data?.text || "Transcrição não disponível";

      // Cache the result
      setCache(cacheKey, { transcription }, generateHash(`${file.name}_${file.size}`));

      const finalFiles = [...files];
      finalFiles[fileIndex] = { 
        ...finalFiles[fileIndex], 
        transcription,
        isProcessing: false 
      };
      updateNodeData(nodeId, { files: finalFiles } as Partial<SourceNodeData | AttachmentNodeData>);

      toast({
        title: "Arquivo transcrito",
        description: `"${file.name}" transcrito com sucesso`,
      });
    } catch (error) {
      console.error("Error transcribing file:", error);
      const errorFiles = [...files];
      errorFiles[fileIndex] = { ...errorFiles[fileIndex], isProcessing: false };
      updateNodeData(nodeId, { files: errorFiles } as Partial<SourceNodeData | AttachmentNodeData>);
      
      toast({
        title: "Erro na transcrição",
        description: error instanceof Error ? error.message : "Não foi possível transcrever",
        variant: "destructive",
      });
    }
  }, [nodes, updateNodeData, toast]);

  // Analyze image style (JSON)
  const analyzeImageStyle = useCallback(async (nodeId: string, fileId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.data.type !== "source") return;

    const sourceData = node.data as SourceNodeData;
    const files = sourceData.files || [];
    const fileIndex = files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) return;

    const updatedFiles = [...files];
    updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], isProcessing: true };
    updateNodeData(nodeId, { files: updatedFiles } as Partial<SourceNodeData>);

    try {
      const file = files[fileIndex];
      const imageUrl = await blobUrlToBase64(file.url);
      
      const { data, error } = await supabase.functions.invoke("analyze-image-complete", {
        body: { imageUrl }
      });

      if (error) throw error;

      const imageAnalysis = data.imageAnalysis || {};
      const generationPrompt = data.generationPrompt || "";
      
      const dominantColors = imageAnalysis.color_palette?.dominant_colors || [];
      const accentColors = imageAnalysis.color_palette?.accent_colors || [];
      
      const styleAnalysis = {
        colors: [...dominantColors, ...accentColors],
        mood: imageAnalysis.mood_atmosphere?.overall_mood || "Não identificado",
        style: imageAnalysis.style?.art_style || imageAnalysis.style?.photography_style || "Não identificado",
        fonts: imageAnalysis.text_elements?.font_characteristics ? [imageAnalysis.text_elements.font_characteristics] : [],
        description: generationPrompt || imageAnalysis.description || "Análise de estilo visual"
      };

      const metadata: ImageMetadata = {
        uploadedAt: file.metadata?.uploadedAt || new Date().toISOString(),
        dimensions: file.metadata?.dimensions || null,
        analyzed: true,
        analyzedAt: new Date().toISOString(),
        isPrimary: file.metadata?.isPrimary || false,
        referenceType: file.metadata?.referenceType || "general",
        imageAnalysis: {
          ...imageAnalysis,
          generation_prompt: generationPrompt
        },
        styleAnalysis: {
          dominantColors,
          colorMood: imageAnalysis.color_palette?.color_mood || "neutral",
          visualStyle: imageAnalysis.style?.art_style || imageAnalysis.style?.photography_style || "general",
          artDirection: imageAnalysis.style?.illustration_technique || "mixed",
          composition: imageAnalysis.composition?.layout || "centered",
          hasText: imageAnalysis.text_elements?.has_text || false,
          textStyle: imageAnalysis.text_elements?.text_style,
          mood: imageAnalysis.mood_atmosphere?.overall_mood || "neutral",
          lighting: imageAnalysis.lighting?.type || "natural",
          promptDescription: generationPrompt
        }
      };

      updatedFiles[fileIndex] = { 
        ...updatedFiles[fileIndex], 
        styleAnalysis,
        metadata,
        isProcessing: false 
      };
      updateNodeData(nodeId, { files: updatedFiles } as Partial<SourceNodeData>);

      toast({
        title: "Análise completa ✓",
        description: `JSON de "${file.name}" gerado`,
      });
    } catch (error) {
      console.error("Error analyzing style:", error);
      updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], isProcessing: false };
      updateNodeData(nodeId, { files: updatedFiles } as Partial<SourceNodeData>);
      toast({
        title: "Erro na análise",
        description: error instanceof Error ? error.message : "Não foi possível analisar",
        variant: "destructive",
      });
    }
  }, [nodes, updateNodeData, toast]);

  // OCR for ImageSourceNode/AttachmentNode
  const transcribeImageSourceImage = useCallback(async (nodeId: string, imageId: string, imageUrl: string) => {
    updateImageInNode(nodeId, imageId, { isProcessing: true, processingType: "ocr" } as any);

    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Timeout: OCR demorou demais")), 90000)
    );

    try {
      const base64Url = await blobUrlToBase64(imageUrl);
      
      const ocrPromise = supabase.functions.invoke("transcribe-images", {
        body: { imageUrls: [base64Url], startIndex: 1 }
      });

      const { data, error } = await Promise.race([ocrPromise, timeoutPromise]);

      if (error) throw error;

      const ocrText = data?.transcription || data?.transcriptions?.[0] || "";
      
      const node = nodes.find(n => n.id === nodeId);
      const nodeData = node?.data as (ImageSourceNodeData | AttachmentNodeData) | undefined;
      const image = nodeData?.images?.find(img => img.id === imageId);

      updateImageInNode(nodeId, imageId, { 
        isProcessing: false,
        processingType: null,
        metadata: {
          ...image?.metadata,
          uploadedAt: image?.metadata?.uploadedAt || new Date().toISOString(),
          dimensions: image?.metadata?.dimensions || null,
          analyzed: image?.metadata?.analyzed || false,
          isPrimary: image?.metadata?.isPrimary || false,
          ocrText,
          ocrAt: new Date().toISOString(),
          lastError: undefined,
        }
      } as any);

      toast({
        title: "OCR completo ✓",
        description: ocrText ? `Texto extraído com sucesso` : "Nenhum texto encontrado",
      });
    } catch (error) {
      console.error("Error transcribing image:", error);
      
      const node = nodes.find(n => n.id === nodeId);
      const nodeData = node?.data as (ImageSourceNodeData | AttachmentNodeData) | undefined;
      const image = nodeData?.images?.find(img => img.id === imageId);
      
      updateImageInNode(nodeId, imageId, { 
        isProcessing: false,
        processingType: null,
        metadata: {
          ...image?.metadata,
          uploadedAt: image?.metadata?.uploadedAt || new Date().toISOString(),
          dimensions: image?.metadata?.dimensions || null,
          analyzed: image?.metadata?.analyzed || false,
          isPrimary: image?.metadata?.isPrimary || false,
          lastError: error instanceof Error ? error.message : "Erro desconhecido",
        }
      } as any);
      
      toast({
        title: "Erro no OCR",
        description: error instanceof Error ? error.message : "Não foi possível extrair texto",
        variant: "destructive",
      });
    }
  }, [nodes, updateImageInNode, toast]);

  // Analyze image for JSON in ImageSourceNode/AttachmentNode
  const analyzeImageSourceImage = useCallback(async (nodeId: string, imageId: string, imageUrl: string) => {
    updateImageInNode(nodeId, imageId, { isProcessing: true, processingType: "json" } as any);

    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Timeout: Análise demorou demais")), 90000)
    );

    try {
      const base64Url = await blobUrlToBase64(imageUrl);
      
      const analyzePromise = supabase.functions.invoke("analyze-image-complete", {
        body: { imageUrl: base64Url }
      });

      const { data, error } = await Promise.race([analyzePromise, timeoutPromise]);

      if (error) throw error;

      const imageAnalysis = data.imageAnalysis || {};
      const generationPrompt = data.generationPrompt || "";
      
      const dominantColors = imageAnalysis.colors?.dominant || imageAnalysis.color_palette?.dominant_colors || [];
      
      const node = nodes.find(n => n.id === nodeId);
      const nodeData = node?.data as (ImageSourceNodeData | AttachmentNodeData) | undefined;
      const image = nodeData?.images?.find(img => img.id === imageId);
      
      const metadata: ImageMetadata = {
        ...image?.metadata,
        uploadedAt: image?.metadata?.uploadedAt || new Date().toISOString(),
        dimensions: image?.metadata?.dimensions || null,
        analyzed: true,
        analyzedAt: new Date().toISOString(),
        isPrimary: image?.metadata?.isPrimary || false,
        lastError: undefined,
        imageAnalysis: { ...imageAnalysis, generation_prompt: generationPrompt },
        styleAnalysis: {
          dominantColors,
          colorMood: imageAnalysis.colors?.mood_from_colors || "neutral",
          visualStyle: imageAnalysis.style?.art_style || "general",
          artDirection: imageAnalysis.style?.visual_treatment || "mixed",
          composition: imageAnalysis.composition?.layout || "centered",
          hasText: imageAnalysis.text_elements?.has_text || false,
          textStyle: imageAnalysis.text_elements?.typography_style,
          mood: imageAnalysis.mood_atmosphere?.primary_mood || "neutral",
          lighting: imageAnalysis.lighting?.type || "natural",
          promptDescription: generationPrompt
        }
      };

      updateImageInNode(nodeId, imageId, { 
        analyzed: true,
        isProcessing: false,
        processingType: null,
        metadata
      } as any);

      toast({
        title: "Análise completa ✓",
        description: `JSON gerado com sucesso`,
      });
    } catch (error) {
      console.error("Error analyzing image:", error);
      
      const node = nodes.find(n => n.id === nodeId);
      const nodeData = node?.data as (ImageSourceNodeData | AttachmentNodeData) | undefined;
      const image = nodeData?.images?.find(img => img.id === imageId);
      
      updateImageInNode(nodeId, imageId, { 
        isProcessing: false,
        processingType: null,
        metadata: {
          ...image?.metadata,
          uploadedAt: image?.metadata?.uploadedAt || new Date().toISOString(),
          dimensions: image?.metadata?.dimensions || null,
          analyzed: image?.metadata?.analyzed || false,
          isPrimary: image?.metadata?.isPrimary || false,
          lastError: error instanceof Error ? error.message : "Erro desconhecido",
        }
      } as any);
      
      toast({
        title: "Erro na análise",
        description: error instanceof Error ? error.message : "Não foi possível analisar",
        variant: "destructive",
      });
    }
  }, [nodes, updateImageInNode, toast]);

  // Batch analyze multiple images in parallel
  const analyzeImagesInParallel = useCallback(async (
    images: Array<{ nodeId: string; imageId: string; url: string }>,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> => {
    const BATCH_SIZE = 3; // Process 3 images at a time
    const total = images.length;
    let completed = 0;

    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      
      await Promise.allSettled(
        batch.map(async ({ nodeId, imageId, url }) => {
          try {
            await analyzeImageSourceImage(nodeId, imageId, url);
          } catch (e) {
            console.warn(`Failed to analyze image ${imageId}:`, e);
          }
          completed++;
          onProgress?.(completed, total);
        })
      );
    }
  }, [analyzeImageSourceImage]);

  return {
    extractUrlContent,
    transcribeFile,
    analyzeImageStyle,
    analyzeImageSourceImage,
    transcribeImageSourceImage,
    analyzeImagesInParallel,
    blobUrlToBase64
  };
}
