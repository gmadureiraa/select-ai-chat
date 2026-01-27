import { useState, useCallback } from "react";
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from "reactflow";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlanningItems } from "@/hooks/usePlanningItems";
import { useToast } from "@/hooks/use-toast";

// Import node data types from node components
import type { TextNodeData } from "../nodes/TextNode";
import type { StickyNodeData } from "../nodes/StickyNode";
import type { ShapeNodeData } from "../nodes/ShapeNode";

// Re-export for use in other hooks
export type { TextNodeData, StickyNodeData, ShapeNodeData };

// Import specialized hooks
import { useCanvasExtractions } from "./useCanvasExtractions";
import { useCanvasGeneration } from "./useCanvasGeneration";
import { useCanvasPersistence } from "./useCanvasPersistence";

// ============================================
// TYPE DEFINITIONS (shared across all hooks)
// ============================================

export type NodeDataType = 
  | "source" 
  | "library" 
  | "generator" 
  | "output"
  | "image-editor"
  | "image-source"
  | "attachment"
  | "text"
  | "sticky"
  | "shape";

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

// NOTE: PromptNodeData removed - legacy type replaced by TextNode
// Legacy "prompt" nodes in saved canvases are rendered as TextNodes via alias in nodeTypes

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
  imagePrompt?: string;
  imageType?: string;
  preservePerson?: boolean;
}

export interface ContentVersion {
  id: string;
  content: string;
  createdAt: string;
  label?: string;
}

export interface NodeComment {
  id: string;
  text: string;
  createdAt: string;
  resolved?: boolean;
}

export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected";

export interface OutputNodeData {
  type: "output";
  content: string;
  format: ContentFormat;
  platform: Platform;
  isEditing: boolean;
  addedToPlanning: boolean;
  isImage?: boolean;
  imageUrl?: string;
  // Phase 3 & 4: Version history, comments, approval
  versions?: ContentVersion[];
  comments?: NodeComment[];
  approvalStatus?: ApprovalStatus;
  isStreaming?: boolean;
  streamProgress?: number;
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
  contentMetadata?: ExtractedContentMetadata;
  // Text tab
  textContent?: string;
  // File tab
  files?: SourceFile[];
  // Image tab
  images?: Array<{
    id: string;
    name: string;
    url: string;
    storagePath?: string;
    isProcessing?: boolean;
    processingType?: "json" | "ocr" | null;
    analyzed?: boolean;
    metadata?: ImageMetadata;
  }>;
}

export type CanvasNodeData = 
  | SourceNodeData 
  | LibraryNodeData 
  | GeneratorNodeData 
  | OutputNodeData
  | ImageEditorNodeData
  | ImageSourceNodeData
  | AttachmentNodeData
  | TextNodeData
  | StickyNodeData
  | ShapeNodeData;

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

// ============================================
// MAIN ORCHESTRATOR HOOK
// ============================================

const defaultNodes: Node<CanvasNodeData>[] = [];
const defaultEdges: Edge[] = [];

export function useCanvasState(clientId: string, workspaceId?: string) {
  const { toast } = useToast();
  const [nodes, setNodes] = useState<Node<CanvasNodeData>[]>(defaultNodes);
  const [edges, setEdges] = useState<Edge[]>(defaultEdges);
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

  // ============================================
  // CORE NODE/EDGE OPERATIONS
  // ============================================

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
      case "text":
        nodeData = {
          type: "text",
          content: "",
          fontSize: 16,
          ...data
        } as TextNodeData;
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
          versions: [],
          comments: [],
          approvalStatus: "draft",
          isStreaming: false,
          streamProgress: 0,
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
      case "attachment":
        nodeData = {
          type: "attachment",
          activeTab: "link",
          files: [],
          images: [],
          ...data
        } as AttachmentNodeData;
        break;
      case "sticky":
        nodeData = {
          type: "sticky",
          content: "",
          color: "#fef08a",
          size: "medium",
          ...data
        } as StickyNodeData;
        break;
      case "shape":
        nodeData = {
          type: "shape",
          shapeType: "rectangle",
          fill: "#3b82f6",
          stroke: "#1d4ed8",
          strokeWidth: 2,
          width: 100,
          height: 100,
          ...data
        } as ShapeNodeData;
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

  const updateImageInNode = useCallback((nodeId: string, imageId: string, updates: Partial<ImageSourceNodeData['images'][number]>) => {
    setNodes(currentNodes => currentNodes.map(n => {
      if (n.id !== nodeId || (n.data.type !== "image-source" && n.data.type !== "attachment")) return n;
      const nodeData = n.data as ImageSourceNodeData | AttachmentNodeData;
      const images = nodeData.images || [];
      const updatedImages = images.map(img => 
        img.id === imageId ? { ...img, ...updates } : img
      );
      return { ...n, data: { ...n.data, images: updatedImages } };
    }));
  }, [setNodes]);

  // ============================================
  // DELEGATED HOOKS
  // ============================================

  // Extraction operations (YouTube, Instagram, OCR, Style Analysis)
  const extractions = useCanvasExtractions({
    nodes,
    updateNodeData,
    updateImageInNode
  });

  // Generation operations (Text, Image)
  const generation = useCanvasGeneration({
    nodes,
    edges,
    clientId,
    updateNodeData,
    addNode,
    deleteNode,
    setEdges,
    analyzeImageSourceImage: extractions.analyzeImageSourceImage
  });

  // Persistence operations (Save, Load, Auto-save)
  const persistence = useCanvasPersistence({
    clientId,
    nodes,
    edges,
    setNodes,
    setEdges
  });

  // ============================================
  // PLANNING INTEGRATION
  // ============================================

  const sendToPlanning = useCallback(async (outputNodeId: string, columnId?: string) => {
    const node = nodes.find((n) => n.id === outputNodeId);
    if (!node || node.data.type !== "output") return;

    const outputData = node.data as OutputNodeData;

    // Get the first column if no columnId specified
    const targetColumnId = columnId || columns[0]?.id;
    if (!targetColumnId) {
      toast({
        title: "Erro",
        description: "Nenhuma coluna de planejamento encontrada",
        variant: "destructive",
      });
      return;
    }

    try {
      await createItem.mutateAsync({
        title: outputData.isImage ? "Nova Imagem" : `Novo ${outputData.format}`,
        description: outputData.isImage ? undefined : outputData.content.substring(0, 200),
        column_id: targetColumnId,
        client_id: clientId,
        platform: outputData.platform,
        content_type: outputData.format,
        content: outputData.content,
        media_urls: outputData.isImage ? [outputData.content] : undefined,
      });

      updateNodeData(outputNodeId, { addedToPlanning: true } as Partial<OutputNodeData>);

      toast({
        title: "Enviado para planejamento",
        description: "O conteúdo foi adicionado ao seu planejamento",
      });
    } catch (error) {
      console.error("Error sending to planning:", error);
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível adicionar ao planejamento",
        variant: "destructive",
      });
    }
  }, [nodes, columns, createItem, clientId, updateNodeData, toast]);

  // ============================================
  // TEMPLATES
  // ============================================

  const loadTemplate = useCallback((templateId: string) => {
    persistence.clearCanvas();

    const templates: Record<string, { name: string; nodes: Node<CanvasNodeData>[]; edges: Edge[] }> = {
      "carousel-basic": {
        name: "Carrossel Básico",
        nodes: [
          {
            id: "attachment-t1",
            type: "attachment",
            position: { x: 100, y: 100 },
            data: { type: "attachment", activeTab: "link", files: [], images: [] } as AttachmentNodeData,
          },
          {
            id: "generator-t1",
            type: "generator",
            position: { x: 500, y: 150 },
            data: { type: "generator", format: "carousel", platform: "instagram", isGenerating: false, quantity: 1 } as GeneratorNodeData,
          },
        ],
        edges: [
          { id: "e1", source: "attachment-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
        ]
      },
      "multi-source": {
        name: "Múltiplas Fontes",
        nodes: [
          {
            id: "attachment-t1",
            type: "attachment",
            position: { x: 100, y: 50 },
            data: { type: "attachment", activeTab: "link", files: [], images: [] } as AttachmentNodeData,
          },
          {
            id: "attachment-t2",
            type: "attachment",
            position: { x: 100, y: 250 },
            data: { type: "attachment", activeTab: "text", files: [], images: [] } as AttachmentNodeData,
          },
          {
            id: "attachment-t3",
            type: "attachment",
            position: { x: 100, y: 450 },
            data: { type: "attachment", activeTab: "image", files: [], images: [] } as AttachmentNodeData,
          },
          {
            id: "generator-t1",
            type: "generator",
            position: { x: 500, y: 200 },
            data: { type: "generator", format: "carousel", platform: "instagram", isGenerating: false, quantity: 1 } as GeneratorNodeData,
          },
        ],
        edges: [
          { id: "e1", source: "attachment-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "attachment-t2", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
          { id: "e3", source: "attachment-t3", target: "generator-t1", sourceHandle: "output", targetHandle: "input-3" },
        ]
      },
    };

    const template = templates[templateId];
    if (template) {
      setNodes(template.nodes);
      setEdges(template.edges);
      persistence.setCanvasName(template.name);
    }
  }, [persistence, setNodes, setEdges]);

  // ============================================
  // RETURN COMBINED API
  // ============================================

  return {
    // Core state
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    
    // Node operations
    addNode,
    updateNodeData,
    deleteNode,
    
    // Extraction operations (delegated)
    extractUrlContent: extractions.extractUrlContent,
    transcribeFile: extractions.transcribeFile,
    analyzeImageStyle: extractions.analyzeImageStyle,
    analyzeImageSourceImage: extractions.analyzeImageSourceImage,
    transcribeImageSourceImage: extractions.transcribeImageSourceImage,
    analyzeImagesInParallel: extractions.analyzeImagesInParallel,
    
    // Generation operations (delegated)
    generateContent: generation.generateContent,
    regenerateContent: generation.regenerateContent,
    editImage: generation.editImage,
    getConnectedInputs: generation.getConnectedInputs,
    
    // Planning
    sendToPlanning,
    
    // Templates
    loadTemplate,
    
    // Persistence operations (delegated)
    savedCanvases: persistence.savedCanvases,
    isLoadingCanvases: persistence.isLoadingCanvases,
    isSaving: persistence.isSaving,
    autoSaveStatus: persistence.autoSaveStatus,
    currentCanvasId: persistence.currentCanvasId,
    currentCanvasName: persistence.currentCanvasName,
    setCanvasName: persistence.setCanvasName,
    saveCanvas: persistence.saveCanvas,
    loadCanvas: persistence.loadCanvas,
    deleteCanvas: persistence.deleteCanvas,
    clearCanvas: persistence.clearCanvas,
  };
}
