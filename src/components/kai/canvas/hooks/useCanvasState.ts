import { useState, useCallback, useEffect, useRef } from "react";
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from "reactflow";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTokenError } from "@/hooks/useTokenError";
import { usePlanningItems } from "@/hooks/usePlanningItems";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IMAGE_FORMAT_INSTRUCTIONS } from "@/types/template";

// Helper to convert blob URL to base64 data URL
async function blobUrlToBase64(blobUrl: string): Promise<string> {
  // If already a data URL or http URL, return as-is
  if (blobUrl.startsWith('data:') || blobUrl.startsWith('http')) {
    return blobUrl;
  }
  
  // If it's a blob URL, fetch and convert
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

export type NodeDataType = 
  | "source" 
  | "library" 
  | "prompt" 
  | "generator" 
  | "output"
  | "image-editor"
  | "image-source";

// Structured metadata for each image reference
export interface ImageMetadata {
  uploadedAt: string;
  dimensions: { width: number; height: number } | null;
  analyzed: boolean;
  analyzedAt?: string;
  
  // OCR / Transcription results
  ocrText?: string;
  ocrAt?: string;
  lastError?: string;
  
  // Detailed style analysis (legacy format)
  styleAnalysis?: {
    dominantColors: string[];
    colorMood: string;
    visualStyle: string;
    artDirection: string;
    composition: string;
    hasText: boolean;
    textStyle?: string;
    mood: string;
    lighting: string;
    promptDescription: string;
  };
  
  // Complete image analysis JSON from analyze-image-complete
  imageAnalysis?: {
    description?: string;
    style?: {
      art_style?: string;
      photography_style?: string;
      illustration_technique?: string;
      rendering_quality?: string;
    };
    color_palette?: {
      dominant_colors?: string[];
      accent_colors?: string[];
      color_mood?: string;
      color_harmony?: string;
    };
    composition?: {
      layout?: string;
      focal_point?: string;
      symmetry?: string;
      depth?: string;
      framing?: string;
    };
    lighting?: {
      type?: string;
      direction?: string;
      intensity?: string;
      mood?: string;
    };
    subjects?: Array<{
      type?: string;
      description?: string;
      position?: string;
      prominence?: string;
    }>;
    text_elements?: {
      has_text?: boolean;
      text_style?: string;
      font_characteristics?: string;
      text_content?: string;
    };
    mood_atmosphere?: {
      overall_mood?: string;
      emotional_tone?: string;
      energy_level?: string;
    };
    generation_prompt?: string;
  };
  
  // Additional metadata
  userNotes?: string;
  isPrimary?: boolean;
  referenceType?: "base" | "style" | "composition" | "color" | "general";
}

export interface SourceFile {
  id: string;
  name: string;
  type: "image" | "audio" | "video" | "document";
  mimeType: string;
  size: number;
  url: string;
  storagePath?: string;
  transcription?: string;
  styleAnalysis?: {
    colors?: string[];
    mood?: string;
    style?: string;
    fonts?: string[];
    description?: string;
  };
  metadata?: ImageMetadata;
  isProcessing?: boolean;
}

// Extracted content metadata
export interface ExtractedContentMetadata {
  author?: string;
  publishDate?: string;
  duration?: string;
  wordCount?: number;
  channel?: string;
  source?: string;
  sourceUrl?: string;
  libraryItemId?: string;
  libraryItemType?: string;
  views?: string;
  transcriptUnavailable?: boolean;
}

export interface SourceNodeData {
  type: "source";
  sourceType: "url" | "text" | "file";
  value: string;
  extractedContent?: string;
  extractedImages?: string[];
  isExtracting?: boolean;
  title?: string;
  thumbnail?: string;
  urlType?: "youtube" | "article" | "newsletter" | "library" | "instagram";
  files?: SourceFile[];
  contentMetadata?: ExtractedContentMetadata;
}

export interface LibraryNodeData {
  type: "library";
  itemId?: string;
  itemTitle?: string;
  itemContent?: string;
  itemType?: string;
}

export interface PromptNodeData {
  type: "prompt";
  briefing: string;
}

export type ContentFormat = 
  | "carousel" 
  | "thread" 
  | "reel_script" 
  | "post" 
  | "stories" 
  | "newsletter"
  | "image";

export type Platform = "instagram" | "linkedin" | "twitter" | "youtube" | "tiktok" | "other";

export interface GeneratorNodeData {
  type: "generator";
  format: ContentFormat;
  platform: Platform;
  isGenerating: boolean;
  progress?: number;
  currentStep?: string;
  // Batch generation
  quantity?: number;
  generatedCount?: number;
  // Image generation options
  imageStyle?: string;
  aspectRatio?: string;
  noTextInImage?: boolean;
}

export interface OutputNodeData {
  type: "output";
  content: string;
  format: ContentFormat;
  platform: Platform;
  isEditing: boolean;
  addedToPlanning: boolean;
  isImage?: boolean;
  imageUrl?: string;
}

export interface ImageEditorNodeData {
  type: "image-editor";
  baseImageUrl?: string;
  editInstruction: string;
  aspectRatio?: string;
  isProcessing: boolean;
  progress?: number;
  currentStep?: string;
}

export interface ImageSourceNodeData {
  type: "image-source";
  images: Array<{
    id: string;
    name: string;
    url: string;
    storagePath?: string;
    isProcessing?: boolean;
    analyzed?: boolean;
    metadata?: ImageMetadata;
  }>;
}

export type CanvasNodeData = 
  | SourceNodeData 
  | LibraryNodeData 
  | PromptNodeData 
  | GeneratorNodeData 
  | OutputNodeData
  | ImageEditorNodeData
  | ImageSourceNodeData;

export interface SavedCanvas {
  id: string;
  workspace_id: string;
  client_id: string;
  user_id: string;
  name: string;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  created_at: string;
  updated_at: string;
}

const defaultNodes: Node<CanvasNodeData>[] = [];
const defaultEdges: Edge[] = [];

function isYoutubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

export function useCanvasState(clientId: string, workspaceId?: string) {
  const { toast } = useToast();
  const { handleTokenError } = useTokenError();
  const queryClient = useQueryClient();
  const [nodes, setNodes] = useState<Node<CanvasNodeData>[]>(defaultNodes);
  const [edges, setEdges] = useState<Edge[]>(defaultEdges);
  const [currentCanvasId, setCurrentCanvasId] = useState<string | null>(null);
  const [currentCanvasName, setCurrentCanvasName] = useState<string>("Novo Canvas");
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');
  const { columns, createItem } = usePlanningItems({ clientId });

  // Fetch client data for name
  const { data: clientData } = useQuery({
    queryKey: ['client-for-canvas', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, identity_guide, context_notes')
        .eq('id', clientId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!clientId
  });

  // Fetch saved canvases for this client
  const { data: savedCanvases = [], isLoading: isLoadingCanvases } = useQuery({
    queryKey: ['content-canvas', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_canvas')
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as SavedCanvas[];
    },
    enabled: !!clientId
  });

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds) as Node<CanvasNodeData>[]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
  }, []);

  const addNode = useCallback((
    nodeType: NodeDataType,
    position: { x: number; y: number },
    data?: Partial<CanvasNodeData>
  ) => {
    const id = `${nodeType}-${Date.now()}`;
    
    let nodeData: CanvasNodeData;
    
    switch (nodeType) {
      case "source":
        nodeData = {
          type: "source",
          sourceType: "url",
          value: "",
          files: [],
          ...data
        } as SourceNodeData;
        break;
      case "library":
        nodeData = {
          type: "library",
          ...data
        } as LibraryNodeData;
        break;
      case "prompt":
        nodeData = {
          type: "prompt",
          briefing: "",
          ...data
        } as PromptNodeData;
        break;
      case "generator":
        nodeData = {
          type: "generator",
          format: "carousel",
          platform: "instagram",
          isGenerating: false,
          quantity: 1,
          imageStyle: "photographic",
          aspectRatio: "1:1",
          noTextInImage: false,
          ...data
        } as GeneratorNodeData;
        break;
      case "output":
        nodeData = {
          type: "output",
          content: "",
          format: "carousel",
          platform: "instagram",
          isEditing: false,
          addedToPlanning: false,
          isImage: false,
          ...data
        } as OutputNodeData;
        break;
      case "image-editor":
        nodeData = {
          type: "image-editor",
          editInstruction: "",
          aspectRatio: "1:1",
          isProcessing: false,
          ...data
        } as ImageEditorNodeData;
        break;
      case "image-source":
        nodeData = {
          type: "image-source",
          images: [],
          ...data
        } as ImageSourceNodeData;
        break;
      default:
        throw new Error(`Unknown node type: ${nodeType}`);
    }

    const newNode: Node<CanvasNodeData> = {
      id,
      type: nodeType,
      position,
      data: nodeData,
    };

    setNodes((nds) => [...nds, newNode]);
    return id;
  }, []);

  const updateNodeData = useCallback((nodeId: string, updates: Partial<CanvasNodeData>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...updates } as CanvasNodeData }
          : node
      )
    );
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, []);

  const getConnectedInputs = useCallback((generatorNodeId: string) => {
    const inputEdges = edges.filter((e) => e.target === generatorNodeId);
    const inputNodes = inputEdges
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter(Boolean) as Node<CanvasNodeData>[];
    return inputNodes;
  }, [edges, nodes]);

  // Extract URL content (YouTube, Instagram, or article)
  const extractUrlContent = useCallback(async (nodeId: string, url: string) => {
    updateNodeData(nodeId, { isExtracting: true } as Partial<SourceNodeData>);

    try {
      const isYoutube = isYoutubeUrl(url);
      const isInstagram = url.includes("instagram.com/p/") || url.includes("instagram.com/reel/") || url.includes("instagr.am");
      
      if (isYoutube) {
        // Use extract-youtube for YouTube URLs
        const { data, error } = await supabase.functions.invoke("extract-youtube", {
          body: { url }
        });

        if (error) throw error;

        const transcript = data.content || data.transcript || "";
        const hasTranscript = data.hasTranscript !== false && transcript.length > 0;
        const wordCount = transcript ? transcript.split(/\s+/).length : 0;
        
        updateNodeData(nodeId, {
          extractedContent: transcript,
          title: data.title || url,
          thumbnail: data.thumbnail || "",
          urlType: "youtube",
          isExtracting: false,
          contentMetadata: {
            channel: data.channel || data.author || data.metadata?.author,
            duration: data.duration || data.metadata?.duration,
            views: data.views,
            wordCount,
            sourceUrl: url,
            source: "YouTube",
            transcriptUnavailable: !hasTranscript,
          }
        } as Partial<SourceNodeData>);

        if (hasTranscript) {
          toast({
            title: "YouTube extraído",
            description: `"${data.title || url}" transcrito com sucesso`,
          });
        } else {
          toast({
            title: "Vídeo carregado",
            description: `"${data.title || url}" carregado, mas a transcrição não está disponível para este vídeo.`,
            variant: "default",
          });
        }
      } else if (isInstagram) {
        // Use extract-instagram for Instagram URLs
        toast({
          title: "Extraindo Instagram...",
          description: "Buscando imagens e legenda do post",
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
          throw new Error("Nenhuma imagem encontrada no post");
        }

        toast({
          title: "Transcrevendo imagens...",
          description: `${images.length} imagem(ns) encontrada(s)`,
        });

        // Transcribe images using transcribe-images
        let transcription = "";
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

        // Build full content
        let fullContent = "";
        if (transcription) {
          fullContent += `📝 **Transcrição das Imagens:**\n\n${transcription}`;
        }
        if (caption) {
          fullContent += `\n\n📷 **Legenda Original:**\n\n${caption}`;
        }

        const wordCount = fullContent.split(/\s+/).length;

        updateNodeData(nodeId, {
          extractedContent: fullContent || caption || "Conteúdo extraído do Instagram",
          extractedImages: images,
          title: caption ? caption.substring(0, 60) + (caption.length > 60 ? "..." : "") : "Post do Instagram",
          thumbnail: images[0] || "",
          urlType: "instagram",
          isExtracting: false,
          contentMetadata: {
            wordCount,
            sourceUrl: url,
            source: "Instagram",
          }
        } as Partial<SourceNodeData>);

        toast({
          title: "Instagram importado ✓",
          description: `${images.length} imagem(ns) extraída(s) e transcrita(s)`,
        });
      } else {
        // Use fetch-reference-content for other URLs
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
        
        // Try to extract domain from URL for source
        let sourceDomain = "";
        try {
          sourceDomain = new URL(url).hostname.replace("www.", "");
        } catch {}
        
        updateNodeData(nodeId, {
          extractedContent: extractedText,
          extractedImages: data.images || [],
          title: data.title || url,
          thumbnail: data.thumbnail || "",
          urlType,
          isExtracting: false,
          contentMetadata: {
            author: data.author,
            publishDate: data.publishDate || data.date,
            wordCount,
            sourceUrl: url,
            source: sourceDomain,
          }
        } as Partial<SourceNodeData>);

        toast({
          title: "Conteúdo extraído",
          description: `"${data.title || url}" foi processado com sucesso`,
        });
      }
    } catch (error) {
      console.error("Error extracting URL:", error);
      updateNodeData(nodeId, { isExtracting: false } as Partial<SourceNodeData>);
      toast({
        title: "Erro na extração",
        description: error instanceof Error ? error.message : "Não foi possível extrair o conteúdo da URL",
        variant: "destructive",
      });
    }
  }, [updateNodeData, toast]);

  // Transcribe audio/video file using transcribe-media edge function
  const transcribeFile = useCallback(async (nodeId: string, fileId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.data.type !== "source") return;

    const sourceData = node.data as SourceNodeData;
    const files = sourceData.files || [];
    const fileIndex = files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) return;

    const file = files[fileIndex];
    
    // Verify it's audio or video
    if (file.type !== "audio" && file.type !== "video") {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Apenas arquivos de áudio e vídeo podem ser transcritos",
        variant: "destructive",
      });
      return;
    }

    // Mark file as processing
    const updatedFiles = [...files];
    updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], isProcessing: true };
    updateNodeData(nodeId, { files: updatedFiles } as Partial<SourceNodeData>);

    try {
      console.log("Transcribing file:", file.name, "URL:", file.url, "Type:", file.mimeType);
      
      // Call transcribe-media edge function with the file URL
      const { data, error } = await supabase.functions.invoke("transcribe-media", {
        body: { 
          url: file.url,
          fileName: file.name,
          mimeType: file.mimeType
        }
      });

      if (error) {
        console.error("Transcription error:", error);
        throw error;
      }
      
      if (data?.error) {
        console.error("Transcription API error:", data.error);
        throw new Error(data.error);
      }

      const transcription = data?.text || "Transcrição não disponível";
      console.log("Transcription result:", transcription.substring(0, 100) + "...");

      // Update file with transcription
      const finalFiles = [...files];
      finalFiles[fileIndex] = { 
        ...finalFiles[fileIndex], 
        transcription,
        isProcessing: false 
      };
      updateNodeData(nodeId, { files: finalFiles } as Partial<SourceNodeData>);

      toast({
        title: "Arquivo transcrito",
        description: `"${file.name}" foi transcrito com sucesso (${data?.duration ? Math.round(data.duration) + 's' : ''})`,
      });
    } catch (error) {
      console.error("Error transcribing file:", error);
      const errorFiles = [...files];
      errorFiles[fileIndex] = { ...errorFiles[fileIndex], isProcessing: false };
      updateNodeData(nodeId, { files: errorFiles } as Partial<SourceNodeData>);
      
      const errorMessage = error instanceof Error ? error.message : "Não foi possível transcrever o arquivo";
      toast({
        title: "Erro na transcrição",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [nodes, updateNodeData, toast]);

  // Analyze image style using analyze-image-complete for detailed JSON
  const analyzeImageStyle = useCallback(async (nodeId: string, fileId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.data.type !== "source") return;

    const sourceData = node.data as SourceNodeData;
    const files = sourceData.files || [];
    const fileIndex = files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) return;

    // Mark file as processing
    const updatedFiles = [...files];
    updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], isProcessing: true };
    updateNodeData(nodeId, { files: updatedFiles } as Partial<SourceNodeData>);

    try {
      const file = files[fileIndex];
      
      // Convert blob URL to base64 data URL if needed
      const imageUrl = await blobUrlToBase64(file.url);
      
      // Call analyze-image-complete for detailed JSON analysis
      const { data, error } = await supabase.functions.invoke("analyze-image-complete", {
        body: { imageUrl }
      });

      if (error) throw error;

      const imageAnalysis = data.imageAnalysis || {};
      const generationPrompt = data.generationPrompt || "";
      
      // Extract colors for legacy compatibility
      const dominantColors = imageAnalysis.color_palette?.dominant_colors || [];
      const accentColors = imageAnalysis.color_palette?.accent_colors || [];
      
      // Legacy format for compatibility
      const styleAnalysis = {
        colors: [...dominantColors, ...accentColors],
        mood: imageAnalysis.mood_atmosphere?.overall_mood || "Não identificado",
        style: imageAnalysis.style?.art_style || imageAnalysis.style?.photography_style || "Não identificado",
        fonts: imageAnalysis.text_elements?.font_characteristics ? [imageAnalysis.text_elements.font_characteristics] : [],
        description: generationPrompt || imageAnalysis.description || "Análise de estilo visual"
      };

      // New structured metadata format with COMPLETE image analysis
      const metadata: ImageMetadata = {
        uploadedAt: file.metadata?.uploadedAt || new Date().toISOString(),
        dimensions: file.metadata?.dimensions || null,
        analyzed: true,
        analyzedAt: new Date().toISOString(),
        isPrimary: file.metadata?.isPrimary || false,
        referenceType: file.metadata?.referenceType || "general",
        // Complete JSON from analyze-image-complete
        imageAnalysis: {
          ...imageAnalysis,
          generation_prompt: generationPrompt
        },
        // Legacy styleAnalysis for backwards compatibility
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
        description: `JSON de "${file.name}" gerado. Clique em Ver JSON para visualizar.`,
      });
    } catch (error) {
      console.error("Error analyzing style:", error);
      updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], isProcessing: false };
      updateNodeData(nodeId, { files: updatedFiles } as Partial<SourceNodeData>);
      toast({
        title: "Erro na análise",
        description: "Não foi possível analisar o estilo da imagem",
        variant: "destructive",
      });
    }
  }, [nodes, updateNodeData, toast]);

  // Helper to update a specific image in the ImageSourceNode
  const updateImageInNode = useCallback((nodeId: string, imageId: string, updates: Partial<ImageSourceNodeData['images'][number]>) => {
    setNodes(currentNodes => currentNodes.map(n => {
      if (n.id !== nodeId || n.data.type !== "image-source") return n;
      const sourceData = n.data as ImageSourceNodeData;
      const images = sourceData.images || [];
      const updatedImages = images.map(img => 
        img.id === imageId ? { ...img, ...updates } : img
      );
      return { ...n, data: { ...n.data, images: updatedImages } };
    }));
  }, [setNodes]);

  // Transcribe image text (OCR) in ImageSourceNode
  const transcribeImageSourceImage = useCallback(async (nodeId: string, imageId: string, imageUrl: string) => {
    // Mark image as processing OCR
    updateImageInNode(nodeId, imageId, { isProcessing: true, processingType: "ocr" } as any);

    // Timeout after 90 seconds
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
      
      // Get current image metadata
      const node = nodes.find(n => n.id === nodeId);
      const sourceData = node?.data as ImageSourceNodeData | undefined;
      const image = sourceData?.images?.find(img => img.id === imageId);

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
        description: ocrText ? `Texto extraído com sucesso` : "Nenhum texto encontrado na imagem",
      });
    } catch (error) {
      console.error("Error transcribing image:", error);
      
      const node = nodes.find(n => n.id === nodeId);
      const sourceData = node?.data as ImageSourceNodeData | undefined;
      const image = sourceData?.images?.find(img => img.id === imageId);
      
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

  // Analyze image style (JSON) in ImageSourceNode - receives imageUrl directly to avoid race condition
  const analyzeImageSourceImage = useCallback(async (nodeId: string, imageId: string, imageUrl: string) => {
    // Mark image as processing JSON
    updateImageInNode(nodeId, imageId, { isProcessing: true, processingType: "json" } as any);

    // Timeout after 90 seconds
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
      
      // Get current image metadata
      const node = nodes.find(n => n.id === nodeId);
      const sourceData = node?.data as ImageSourceNodeData | undefined;
      const image = sourceData?.images?.find(img => img.id === imageId);
      
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
      const sourceData = node?.data as ImageSourceNodeData | undefined;
      const image = sourceData?.images?.find(img => img.id === imageId);
      
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
        description: error instanceof Error ? error.message : "Não foi possível analisar a imagem",
        variant: "destructive",
      });
    }
  }, [nodes, updateImageInNode, toast]);

  // Generate content (text or image)
  const generateContent = useCallback(async (generatorNodeId: string) => {
    const generatorNode = nodes.find((n) => n.id === generatorNodeId);
    if (!generatorNode || generatorNode.data.type !== "generator") return;

    const genData = generatorNode.data as GeneratorNodeData;
    const inputNodes = getConnectedInputs(generatorNodeId);

    if (inputNodes.length === 0) {
      toast({
        title: "Conexões necessárias",
        description: "Conecte pelo menos uma fonte ao gerador",
        variant: "destructive",
      });
      return;
    }

    // Build context from connected inputs
    let combinedContext = "";
    let briefing = "";
    let imageReferences: string[] = [];
    let styleContext: string[] = [];

    for (const inputNode of inputNodes) {
      switch (inputNode.data.type) {
        case "source": {
          const sourceData = inputNode.data as SourceNodeData;
          if (sourceData.extractedContent) {
            combinedContext += `\n\n### Conteúdo Extraído:\n${sourceData.extractedContent}`;
          } else if (sourceData.value && sourceData.sourceType === "text") {
            combinedContext += `\n\n### Texto:\n${sourceData.value}`;
          }
          
          // Collect image references and transcriptions from files
          if (sourceData.files) {
            // Sort to prioritize primary images first
            const sortedFiles = [...sourceData.files].sort((a, b) => {
              if (a.metadata?.isPrimary && !b.metadata?.isPrimary) return -1;
              if (!a.metadata?.isPrimary && b.metadata?.isPrimary) return 1;
              return 0;
            });
            
            for (const file of sortedFiles) {
              if (file.type === "image") {
                // Convert blob URL to base64 if needed for edge function compatibility
                try {
                  const imageUrl = await blobUrlToBase64(file.url);
                  imageReferences.push(imageUrl);
                } catch (e) {
                  console.warn('Failed to process image reference:', e);
                }
                
                // Use new structured metadata if available
                if (file.metadata?.styleAnalysis?.promptDescription) {
                  styleContext.push(file.metadata.styleAnalysis.promptDescription);
                } else if (file.styleAnalysis) {
                  styleContext.push(JSON.stringify(file.styleAnalysis));
                }
              }
              if (file.transcription) {
                combinedContext += `\n\n### Transcrição (${file.name}):\n${file.transcription}`;
              }
            }
          }
          break;
        }
        case "library": {
          const libData = inputNode.data as LibraryNodeData;
          if (libData.itemContent) {
            combinedContext += `\n\n### Referência (${libData.itemTitle}):\n${libData.itemContent}`;
          }
          break;
        }
        case "prompt": {
          const promptData = inputNode.data as PromptNodeData;
          briefing = promptData.briefing;
          break;
        }
        // NEW: Support output nodes as input for derivation
        case "output": {
          const outputData = inputNode.data as OutputNodeData;
          if (outputData.isImage && outputData.content) {
            // If it's an image output, use as reference for new image generation
            imageReferences.push(outputData.content);
            styleContext.push("Usar estilo visual desta imagem como referência principal");
          } else if (outputData.content) {
            // If it's text output, use as context for new content
            combinedContext += `\n\n### Conteúdo Gerado Anteriormente:\n${outputData.content}`;
          }
          break;
        }
        // NEW: Support image-source nodes for visual references
        case "image-source": {
          const imgSrcData = inputNode.data as any; // ImageSourceNodeData
          const srcImages = imgSrcData.images || [];
          
          for (const img of srcImages) {
            if (img.url) {
              try {
                const imageUrl = await blobUrlToBase64(img.url);
                imageReferences.push(imageUrl);
              } catch (e) {
                console.warn('Failed to process image-source reference:', e);
              }
            }
            
            // Collect complete imageAnalysis if available
            if (img.metadata?.imageAnalysis) {
              styleContext.push(`Análise completa da referência visual: ${JSON.stringify(img.metadata.imageAnalysis)}`);
              // Use generation_prompt if available
              if (img.metadata.imageAnalysis.generation_prompt) {
                styleContext.push(`Prompt de geração sugerido: ${img.metadata.imageAnalysis.generation_prompt}`);
              }
            } else if (img.metadata?.styleAnalysis?.promptDescription) {
              styleContext.push(img.metadata.styleAnalysis.promptDescription);
            }
          }
          break;
        }
      }
    }

    if (!combinedContext && !briefing) {
      toast({
        title: "Conteúdo necessário",
        description: "Adicione conteúdo ou briefing às fontes conectadas",
        variant: "destructive",
      });
      return;
    }

    updateNodeData(generatorNodeId, { 
      isGenerating: true, 
      progress: 0,
      currentStep: genData.format === "image" ? "Gerando imagem..." : "Pesquisando..." 
    } as Partial<GeneratorNodeData>);

    try {
      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      // Check if generating image
      if (genData.format === "image") {
        // Get visual references from client
        const { data: visualRefs } = await supabase
          .from('client_visual_references')
          .select('*')
          .eq('client_id', clientId)
          .eq('is_primary', true)
          .limit(4);

        const visualRefUrls = (visualRefs || []).map(r => r.image_url);
        const allImageRefs = [...imageReferences, ...visualRefUrls];

        // Build image generation prompt
        let imagePrompt = briefing || `Crie uma imagem baseada em: ${combinedContext.substring(0, 500)}`;
        
        if (styleContext.length > 0) {
          imagePrompt += `\n\nEstilo de referência: ${styleContext.join(", ")}`;
        }
        
        if (genData.noTextInImage) {
          imagePrompt += "\n\nIMPORTANTE: A imagem não deve conter texto.";
        }

        // Collect complete styleAnalysis from analyzed images (source nodes and image-source nodes)
        let collectedStyleAnalysis = null;
        for (const inputNode of inputNodes) {
          if (inputNode.data.type === "source") {
            const srcData = inputNode.data as SourceNodeData;
            for (const f of srcData.files || []) {
              if (f.type === "image" && f.metadata?.imageAnalysis) {
                collectedStyleAnalysis = f.metadata.imageAnalysis;
                break;
              }
            }
            if (collectedStyleAnalysis) break;
          } else if (inputNode.data.type === "image-source") {
            const imgSrcData = inputNode.data as any;
            for (const img of imgSrcData.images || []) {
              if (img.metadata?.imageAnalysis) {
                collectedStyleAnalysis = img.metadata.imageAnalysis;
                break;
              }
            }
            if (collectedStyleAnalysis) break;
          }
        }

        // Map imageType to format instructions and aspect ratio
        const imageTypeToFormatKey: Record<string, string> = {
          "thumbnail": "thumbnail_youtube",
          "social_post": "post_instagram",
          "banner": "banner_linkedin",
          "product": "post_instagram",
          "general": "post_instagram",
          "carousel": "carousel_slide",
          "story": "story_reels",
          "reels": "story_reels",
        };

        const imageType = (genData as any).imageType || "general";
        const formatKey = imageTypeToFormatKey[imageType] || "arte_generica";
        const formatSpec = IMAGE_FORMAT_INSTRUCTIONS[formatKey];
        const formatInstructionsText = formatSpec?.instructions || "";
        
        // Override aspect ratio based on format if not explicitly set
        const effectiveAspectRatio = genData.aspectRatio || formatSpec?.aspectRatio || "1:1";
        
        // Get preservePerson flag
        const preservePerson = (genData as any).preservePerson || false;

        console.log('[generateContent] Image generation params:', {
          imageType,
          formatKey,
          effectiveAspectRatio,
          preservePerson,
          hasFormatInstructions: !!formatInstructionsText,
          hasStyleAnalysis: !!collectedStyleAnalysis,
          imageRefsCount: allImageRefs.length
        });

        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: {
            prompt: imagePrompt,
            clientId,
            aspectRatio: effectiveAspectRatio,
            imageFormat: genData.imageStyle || "photographic",
            imageType,
            preservePerson,
            formatInstructions: formatInstructionsText,
            imageReferences: allImageRefs.slice(0, 2), // Limit to 2 for optimal style matching
            styleAnalysis: collectedStyleAnalysis, // Pass complete JSON analysis
          }
        });

        if (error) throw error;

        updateNodeData(generatorNodeId, { 
          isGenerating: false, 
          progress: 100,
          currentStep: "Concluído" 
        } as Partial<GeneratorNodeData>);

        // Create output node with image
        const outputPosition = {
          x: generatorNode.position.x + 350,
          y: generatorNode.position.y
        };

        const outputId = addNode("output", outputPosition, {
          type: "output",
          content: data.imageUrl || data.url || "",
          format: "image",
          platform: genData.platform,
          isEditing: false,
          addedToPlanning: false,
          isImage: true,
        } as OutputNodeData);

        // Connect generator to output
        setEdges((eds) => addEdge({
          id: `${generatorNodeId}-${outputId}`,
          source: generatorNodeId,
          target: outputId,
          sourceHandle: "output",
          targetHandle: "input"
        }, eds));

        toast({
          title: "Imagem gerada",
          description: "Sua imagem foi criada com sucesso",
        });
      } else {
        // Generate text content with batch support
        const quantity = genData.quantity || 1;
        
        // Get auth session for API call
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) throw new Error("Usuário não autenticado");

        // Generate multiple variations
        for (let i = 0; i < quantity; i++) {
          const variationSuffix = quantity > 1 
            ? `\n\nIMPORTANTE: Esta é a variação ${i + 1} de ${quantity}. Crie uma versão DIFERENTE e ÚNICA, com abordagem, estrutura ou ângulo distintos das outras variações.`
            : "";
          
          const userMessage = briefing 
            ? `${briefing}\n\nMaterial de referência:\n${combinedContext}${variationSuffix}`
            : `Crie conteúdo baseado no seguinte material:\n${combinedContext}${variationSuffix}`;

          // Update progress for batch
          updateNodeData(generatorNodeId, {
            currentStep: quantity > 1 ? `Gerando ${i + 1}/${quantity}...` : "Pesquisando...",
            progress: Math.round((i / quantity) * 100),
            generatedCount: i,
          } as Partial<GeneratorNodeData>);

          // Use fetch with SSE stream processing - using kai-content-agent
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kai-content-agent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
                "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({
                clientId,
                request: userMessage,
                format: genData.format,
                platform: genData.platform,
              }),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            
            // Handle 402 Payment Required - insufficient tokens
            if (response.status === 402) {
              const error = new Error("Créditos insuficientes") as Error & { status: number; code: string };
              error.status = 402;
              error.code = "TOKENS_EXHAUSTED";
              throw error;
            }
            
            throw new Error(`Erro na API: ${response.status} - ${errorText}`);
          }

          // Process SSE stream - kai-content-agent uses OpenAI format
          const reader = response.body?.getReader();
          if (!reader) throw new Error("Não foi possível ler a resposta");

          const decoder = new TextDecoder();
          let buffer = "";
          let finalContent = "";
          let chunkCount = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(":")) continue;

              if (trimmed.startsWith("data: ")) {
                const jsonStr = trimmed.slice(6).trim();
                if (jsonStr === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(jsonStr);
                  
                  // OpenAI streaming format - extract content from delta
                  const deltaContent = parsed.choices?.[0]?.delta?.content;
                  if (deltaContent) {
                    finalContent += deltaContent;
                    chunkCount++;
                    
                    // Update progress based on content chunks
                    if (quantity === 1 && chunkCount % 10 === 0) {
                      const progress = Math.min(90, 20 + Math.floor(chunkCount / 5));
                      updateNodeData(generatorNodeId, {
                        currentStep: "Gerando conteúdo...",
                        progress,
                      } as Partial<GeneratorNodeData>);
                    }
                  }
                } catch {
                  // Ignore JSON parse errors for incomplete chunks
                }
              }
            }
          }

          // Trim final content
          finalContent = finalContent.trim();
          if (!finalContent) continue; // Skip this variation if no content

          // Create output node with offset for batch
          const yOffset = i * 180; // Stack outputs vertically
          const outputPosition = {
            x: generatorNode.position.x + 350,
            y: generatorNode.position.y + yOffset
          };

          const outputId = addNode("output", outputPosition, {
            type: "output",
            content: finalContent,
            format: genData.format,
            platform: genData.platform,
            isEditing: false,
            addedToPlanning: false,
            isImage: false,
          } as OutputNodeData);

          // Connect generator to output
          setEdges((eds) => addEdge({
            id: `${generatorNodeId}-${outputId}-${i}`,
            source: generatorNodeId,
            target: outputId,
            sourceHandle: "output",
            targetHandle: "input"
          }, eds));
        }

        updateNodeData(generatorNodeId, { 
          isGenerating: false, 
          progress: 100,
          currentStep: "Concluído",
          generatedCount: quantity,
        } as Partial<GeneratorNodeData>);

        toast({
          title: quantity > 1 ? "Conteúdos gerados" : "Conteúdo gerado",
          description: quantity > 1 
            ? `${quantity} variações de ${genData.format} criadas com sucesso`
            : `${genData.format} criado com sucesso`,
        });
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      updateNodeData(generatorNodeId, { 
        isGenerating: false,
        currentStep: "Erro",
        generatedCount: 0,
      } as Partial<GeneratorNodeData>);
      
      // Check if it's a token error (402) and show upgrade dialog
      const isTokenError = await handleTokenError(error, error?.status);
      if (!isTokenError) {
        toast({
          title: "Erro na geração",
          description: "Não foi possível gerar o conteúdo",
          variant: "destructive",
        });
      }
    }
  }, [nodes, getConnectedInputs, updateNodeData, addNode, clientId, clientData, toast, handleTokenError]);

  const sendToPlanning = useCallback(async (outputNodeId: string) => {
    const outputNode = nodes.find((n) => n.id === outputNodeId);
    if (!outputNode || outputNode.data.type !== "output") return;

    const outData = outputNode.data as OutputNodeData;
    
    const draftColumn = columns.find(c => c.column_type === "draft") || columns[0];
    if (!draftColumn) {
      toast({
        title: "Erro",
        description: "Nenhuma coluna encontrada para adicionar o conteúdo",
        variant: "destructive",
      });
      return;
    }

    const formatLabels: Record<ContentFormat, string> = {
      carousel: "Carrossel",
      thread: "Thread",
      reel_script: "Roteiro Reel",
      post: "Post",
      stories: "Stories",
      newsletter: "Newsletter",
      image: "Imagem"
    };

    try {
      await createItem.mutateAsync({
        title: `${formatLabels[outData.format]} - ${new Date().toLocaleDateString("pt-BR")}`,
        content: outData.content,
        content_type: outData.format === "image" ? "post" : outData.format,
        platform: outData.platform as any,
        column_id: draftColumn.id,
        client_id: clientId,
        labels: [formatLabels[outData.format]],
        ...(outData.isImage && { image_url: outData.content })
      });

      updateNodeData(outputNodeId, { addedToPlanning: true } as Partial<OutputNodeData>);

      toast({
        title: "Enviado para planejamento",
        description: "Conteúdo adicionado à coluna de rascunhos",
      });
    } catch (error) {
      console.error("Error sending to planning:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar para o planejamento",
        variant: "destructive",
      });
    }
  }, [nodes, columns, clientId, createItem, updateNodeData, toast]);

  // Regenerate content from an output node
  const regenerateContent = useCallback(async (outputNodeId: string) => {
    const outputNode = nodes.find((n) => n.id === outputNodeId);
    if (!outputNode || outputNode.data.type !== "output") return;

    // Find the generator node that created this output
    const connectedEdge = edges.find((e) => e.target === outputNodeId);
    if (!connectedEdge) {
      toast({
        title: "Erro",
        description: "Não foi possível encontrar o gerador conectado",
        variant: "destructive",
      });
      return;
    }

    const generatorNodeId = connectedEdge.source;
    
    // Delete the current output node
    deleteNode(outputNodeId);
    
    // Regenerate from the generator
    await generateContent(generatorNodeId);
  }, [nodes, edges, deleteNode, generateContent, toast]);

  // Edit image using ImageEditorNode
  const editImage = useCallback(async (editorNodeId: string) => {
    const editorNode = nodes.find((n) => n.id === editorNodeId);
    if (!editorNode || editorNode.data.type !== "image-editor") return;

    const editorData = editorNode.data as ImageEditorNodeData;
    
    // Get base image from connected source node
    const inputEdge = edges.find((e) => e.target === editorNodeId);
    let baseImageUrl = editorData.baseImageUrl;
    
    if (!baseImageUrl && inputEdge) {
      const sourceNode = nodes.find((n) => n.id === inputEdge.source);
      if (sourceNode?.data.type === "source") {
        const sourceData = sourceNode.data as SourceNodeData;
        const imageFile = sourceData.files?.find(f => f.type === "image");
        if (imageFile) {
          baseImageUrl = imageFile.url;
          updateNodeData(editorNodeId, { baseImageUrl } as Partial<ImageEditorNodeData>);
        }
      } else if (sourceNode?.data.type === "output" && (sourceNode.data as OutputNodeData).isImage) {
        baseImageUrl = (sourceNode.data as OutputNodeData).content;
        updateNodeData(editorNodeId, { baseImageUrl } as Partial<ImageEditorNodeData>);
      }
    }

    if (!baseImageUrl) {
      toast({
        title: "Imagem necessária",
        description: "Conecte uma fonte com imagem ao editor",
        variant: "destructive",
      });
      return;
    }

    if (!editorData.editInstruction.trim()) {
      toast({
        title: "Instrução necessária",
        description: "Digite uma instrução de edição",
        variant: "destructive",
      });
      return;
    }

    updateNodeData(editorNodeId, { 
      isProcessing: true, 
      progress: 0,
      currentStep: "Editando imagem..." 
    } as Partial<ImageEditorNodeData>);

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: editorData.editInstruction,
          clientId,
          aspectRatio: editorData.aspectRatio || "1:1",
          referenceImages: [{ url: baseImageUrl, isPrimary: true }],
        }
      });

      if (error) throw error;

      updateNodeData(editorNodeId, { 
        isProcessing: false, 
        progress: 100,
        currentStep: "Concluído" 
      } as Partial<ImageEditorNodeData>);

      // Create output node with edited image
      const outputPosition = {
        x: editorNode.position.x + 350,
        y: editorNode.position.y
      };

      const outputId = addNode("output", outputPosition, {
        type: "output",
        content: data.imageUrl || data.url || "",
        format: "image",
        platform: "instagram",
        isEditing: false,
        addedToPlanning: false,
        isImage: true,
      } as OutputNodeData);

      // Connect editor to output
      setEdges((eds) => addEdge({
        id: `${editorNodeId}-${outputId}`,
        source: editorNodeId,
        target: outputId,
        sourceHandle: "output",
        targetHandle: "input"
      }, eds));

      toast({
        title: "Imagem editada",
        description: "Sua imagem foi editada com sucesso",
      });
    } catch (error) {
      console.error("Edit error:", error);
      updateNodeData(editorNodeId, { 
        isProcessing: false,
        currentStep: "Erro" 
      } as Partial<ImageEditorNodeData>);
      toast({
        title: "Erro na edição",
        description: "Não foi possível editar a imagem",
        variant: "destructive",
      });
    }
  }, [nodes, edges, updateNodeData, addNode, clientId, toast]);

  // Save canvas
  const saveCanvas = useCallback(async (name?: string) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: client } = await supabase
        .from("clients")
        .select("workspace_id")
        .eq("id", clientId)
        .single();

      if (!client) throw new Error("Cliente não encontrado");

      const canvasData = {
        id: currentCanvasId || undefined,
        client_id: clientId,
        workspace_id: client.workspace_id,
        user_id: user.id,
        name: name || currentCanvasName || `Canvas ${new Date().toLocaleDateString("pt-BR")}`,
        nodes: nodes as any,
        edges: edges as any,
      };

      const { data, error } = await supabase
        .from('content_canvas')
        .upsert(canvasData)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCurrentCanvasId(data.id);
        setCurrentCanvasName(data.name);
        queryClient.invalidateQueries({ queryKey: ['content-canvas', clientId] });
      }

      toast({
        title: "Canvas salvo",
        description: `"${data?.name}" foi salvo com sucesso`,
      });

      return data as unknown as SavedCanvas;
    } catch (error) {
      console.error("Error saving canvas:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o canvas",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, clientId, currentCanvasId, currentCanvasName, queryClient, toast]);

  // Load canvas
  const loadCanvas = useCallback(async (canvasId: string) => {
    try {
      const { data, error } = await supabase
        .from('content_canvas')
        .select('*')
        .eq('id', canvasId)
        .single();

      if (error) throw error;

      if (data) {
        setNodes((data.nodes as any) || []);
        setEdges((data.edges as any) || []);
        setCurrentCanvasId(data.id);
        setCurrentCanvasName(data.name);
      }

      toast({
        title: "Canvas carregado",
        description: `"${data?.name}" foi carregado`,
      });
    } catch (error) {
      console.error("Error loading canvas:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar o canvas",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Delete canvas
  const deleteCanvas = useCallback(async (canvasId: string) => {
    try {
      const { error } = await supabase
        .from('content_canvas')
        .delete()
        .eq('id', canvasId);

      if (error) throw error;

      if (currentCanvasId === canvasId) {
        setCurrentCanvasId(null);
        setCurrentCanvasName("Novo Canvas");
        setNodes([]);
        setEdges([]);
      }

      queryClient.invalidateQueries({ queryKey: ['content-canvas', clientId] });

      toast({
        title: "Canvas excluído",
        description: "O canvas foi removido",
      });
    } catch (error) {
      console.error("Error deleting canvas:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o canvas",
        variant: "destructive",
      });
    }
  }, [currentCanvasId, clientId, queryClient, toast]);

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setCurrentCanvasId(null);
    setCurrentCanvasName("Novo Canvas");
  }, []);

  const setCanvasName = useCallback((name: string) => {
    setCurrentCanvasName(name);
  }, []);

  // Load template - pre-configured canvas flows
  const loadTemplate = useCallback((templateId: string) => {
    clearCanvas();
    
    const templates: Record<string, { nodes: any[]; edges: any[]; name: string }> = {
      carousel_from_url: {
        name: "Carrossel de URL",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 150 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 350 }, data: { type: "prompt", briefing: "Transforme este conteúdo em um carrossel de 7-10 slides para Instagram" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "carousel", platform: "instagram", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      thread_from_video: {
        name: "Thread de Vídeo",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 200 }, data: { type: "source", sourceType: "file", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 400 }, data: { type: "prompt", briefing: "Crie uma thread viral com os principais insights deste vídeo" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 300 }, data: { type: "generator", format: "thread", platform: "twitter", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      newsletter_curated: {
        name: "Newsletter Curada",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 100 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "source-t2", type: "source", position: { x: 100, y: 300 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 500 }, data: { type: "prompt", briefing: "Compile estas fontes em uma newsletter com curadoria e análise" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 300 }, data: { type: "generator", format: "newsletter", platform: "other", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "source-t2", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
          { id: "e3", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-3" },
        ]
      },
      reel_script: {
        name: "Roteiro de Reel",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 150 }, data: { type: "source", sourceType: "text", value: "", files: [] } },
          { id: "library-t1", type: "library", position: { x: 100, y: 350 }, data: { type: "library" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "reel_script", platform: "instagram", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "library-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      image_series: {
        name: "Série de Imagens",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 150 }, data: { type: "source", sourceType: "text", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 350 }, data: { type: "prompt", briefing: "Descreva o estilo visual desejado" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "image", platform: "instagram", isGenerating: false, imageStyle: "photographic", aspectRatio: "1:1", quantity: 3 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      // New templates
      linkedin_article: {
        name: "Artigo LinkedIn",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 150 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 350 }, data: { type: "prompt", briefing: "Transforme em um artigo profissional para LinkedIn com insights acionáveis" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "post", platform: "linkedin", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      podcast_highlights: {
        name: "Destaques de Podcast",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 150 }, data: { type: "source", sourceType: "file", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 350 }, data: { type: "prompt", briefing: "Extraia os 5 principais insights deste áudio para uma thread" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "thread", platform: "twitter", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      story_sequence: {
        name: "Sequência de Stories",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 150 }, data: { type: "source", sourceType: "text", value: "", files: [] } },
          { id: "library-t1", type: "library", position: { x: 100, y: 350 }, data: { type: "library" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "stories", platform: "instagram", isGenerating: false, quantity: 5 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "library-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      repurpose_blog: {
        name: "Repurpose de Blog",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 200 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 100 }, data: { type: "generator", format: "carousel", platform: "instagram", isGenerating: false, quantity: 1 } },
          { id: "generator-t2", type: "generator", position: { x: 450, y: 300 }, data: { type: "generator", format: "thread", platform: "twitter", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "source-t1", target: "generator-t2", sourceHandle: "output", targetHandle: "input-1" },
        ]
      },
      weekly_summary: {
        name: "Resumo Semanal",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 50 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "source-t2", type: "source", position: { x: 100, y: 200 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "source-t3", type: "source", position: { x: 100, y: 350 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 500 }, data: { type: "prompt", briefing: "Crie um resumo semanal compilando todas essas fontes em uma newsletter" } },
          { id: "generator-t1", type: "generator", position: { x: 500, y: 275 }, data: { type: "generator", format: "newsletter", platform: "other", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "source-t2", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
          { id: "e3", source: "source-t3", target: "generator-t1", sourceHandle: "output", targetHandle: "input-3" },
          { id: "e4", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-4" },
        ]
      },
    };

    const template = templates[templateId];
    if (template) {
      setNodes(template.nodes);
      setEdges(template.edges);
      setCurrentCanvasName(template.name);
    }
  }, [clearCanvas]);

  // Auto-save functionality with debounce
  useEffect(() => {
    // Skip auto-save if canvas is empty or no changes
    if (nodes.length === 0 && edges.length === 0) {
      setAutoSaveStatus('idle');
      return;
    }

    // Create a hash of current state to detect changes
    const currentState = JSON.stringify({ nodes, edges, currentCanvasName });
    
    // Skip if no changes since last save
    if (currentState === lastSavedRef.current) {
      return;
    }

    // Set status to pending (has unsaved changes)
    setAutoSaveStatus('pending');

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (3 seconds debounce)
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving');
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setAutoSaveStatus('error');
          return;
        }

        const { data: client } = await supabase
          .from("clients")
          .select("workspace_id")
          .eq("id", clientId)
          .single();

        if (!client) {
          setAutoSaveStatus('error');
          return;
        }

        const canvasData = {
          id: currentCanvasId || undefined,
          client_id: clientId,
          workspace_id: client.workspace_id,
          user_id: user.id,
          name: currentCanvasName || `Canvas ${new Date().toLocaleDateString("pt-BR")}`,
          nodes: nodes as any,
          edges: edges as any,
        };

        const { data, error } = await supabase
          .from('content_canvas')
          .upsert(canvasData)
          .select()
          .single();

        if (error) {
          console.error("Auto-save error:", error);
          setAutoSaveStatus('error');
          return;
        }

        if (data) {
          // Update refs and state without triggering another save
          lastSavedRef.current = currentState;
          if (!currentCanvasId) {
            setCurrentCanvasId(data.id);
          }
          queryClient.invalidateQueries({ queryKey: ['content-canvas', clientId] });
        }

        setAutoSaveStatus('saved');
        
        // Reset to idle after showing "saved" for 2 seconds
        setTimeout(() => {
          setAutoSaveStatus((prev) => prev === 'saved' ? 'idle' : prev);
        }, 2000);
        
      } catch (error) {
        console.error("Auto-save error:", error);
        setAutoSaveStatus('error');
      }
    }, 3000);

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [nodes, edges, currentCanvasName, currentCanvasId, clientId, queryClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeData,
    deleteNode,
    extractUrlContent,
    transcribeFile,
    analyzeImageStyle,
    analyzeImageSourceImage,
    transcribeImageSourceImage,
    generateContent,
    regenerateContent,
    editImage,
    sendToPlanning,
    clearCanvas,
    getConnectedInputs,
    loadTemplate,
    // Canvas persistence
    savedCanvases,
    isLoadingCanvases,
    isSaving,
    autoSaveStatus,
    currentCanvasId,
    currentCanvasName,
    setCanvasName,
    saveCanvas,
    loadCanvas,
    deleteCanvas,
  };
}
