import { useCallback, useRef, useMemo, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  NodeProps,
  EdgeTypes,
  Node as RFNode,
} from "reactflow";
import "reactflow/dist/style.css";
import { Sparkles, LayoutGrid, MessageSquare, Briefcase, BookOpen, RefreshCw, Image } from "lucide-react";
import { MaterialChatNode } from "./nodes/MaterialChatNode";
import { cn } from "@/lib/utils";

import { AnimatedEdge } from "./components/AnimatedEdge";
import {
  useCanvasState,
  OutputNodeData,
  ContentFormat,
} from "./hooks/useCanvasState";
import { CanvasToolbar, ToolType, ShapeType, QuickTemplate } from "./CanvasToolbar";
import { CanvasLibraryDrawer } from "./CanvasLibraryDrawer";
import { AttachmentNode, AttachmentNodeData } from "./nodes/AttachmentNode";
import { GeneratorNode, GeneratorNodeData } from "./nodes/GeneratorNode";
import { ContentOutputNode } from "./nodes/ContentOutputNode";
import { TextNode, TextNodeData } from "./nodes/TextNode";
import { StickyNode, StickyNodeData } from "./nodes/StickyNode";
import { ShapeNode, ShapeNodeData } from "./nodes/ShapeNode";
import { DrawingLayer, DrawingStroke } from "./components/DrawingLayer";
import { CanvasContextMenu } from "./components/CanvasContextMenu";
import { PlanningItemDialog } from "@/components/planning/PlanningItemDialog";
import { usePlanningItems } from "@/hooks/usePlanningItems";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ContentTypeKey } from "@/types/contentTypes";
import { ReferenceItem } from "@/hooks/useReferenceLibrary";
import { ClientVisualReference } from "@/hooks/useClientVisualReferences";
import type { UnifiedContentItem } from "@/hooks/useUnifiedContent";
import { useCanvasShortcuts } from "./hooks/useCanvasShortcuts";

interface ContentCanvasProps {
  clientId: string;
}

// Map canvas format to content type key
const FORMAT_TO_CONTENT_TYPE: Record<ContentFormat, ContentTypeKey> = {
  carousel: "carousel",
  thread: "thread",
  reel_script: "short_video",
  post: "instagram_post",
  stories: "stories",
  newsletter: "newsletter",
  image: "static_image",
};

// Component version: 6 - Simplified (Attachment + Generator only)
function ContentCanvasInner({ clientId }: ContentCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { zoomIn, zoomOut, fitView, getViewport, project } = useReactFlow();
  const { toast } = useToast();

  // Planning dialog state
  const [planningDialogOpen, setPlanningDialogOpen] = useState(false);
  const [planningOutputNode, setPlanningOutputNode] = useState<OutputNodeData | null>(null);
  const [planningOutputNodeId, setPlanningOutputNodeId] = useState<string | null>(null);

  // Library drawer state
  const [libraryDrawerOpen, setLibraryDrawerOpen] = useState(false);

  // Whiteboard state
  const [activeTool, setActiveTool] = useState<ToolType>("cursor");
  const [brushColor, setBrushColor] = useState("#ef4444");
  const [brushSize, setBrushSize] = useState(4);
  const [selectedShape, setSelectedShape] = useState<ShapeType>("rectangle");
  const [selectedStickyColor, setSelectedStickyColor] = useState("#fef08a");
  const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>([]);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [canvasViewport, setCanvasViewport] = useState({ x: 0, y: 0, zoom: 1 });

  // Keyboard shortcuts
  useCanvasShortcuts({
    activeTool,
    setActiveTool,
    disabled: false,
  });

  const { columns, createItem } = usePlanningItems({ clientId });

  // Fetch client data for header
  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, avatar_url")
        .eq("id", clientId)
        .single();
      return data;
    },
    enabled: !!clientId,
  });

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeData,
    deleteNode,
    regenerateContent,
    clearCanvas,
    saveCanvas,
    loadCanvas,
    deleteCanvas,
    loadTemplate,
    savedCanvases,
    isLoadingCanvases,
    currentCanvasName,
    setCanvasName,
    isSaving,
    autoSaveStatus,
  } = useCanvasState(clientId);

  // Handler to open planning dialog with output data
  const handleOpenPlanningDialog = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node && node.data.type === "output") {
        setPlanningOutputNode(node.data as OutputNodeData);
        setPlanningOutputNodeId(nodeId);
        setPlanningDialogOpen(true);
      }
    },
    [nodes]
  );

  // Handle saving from planning dialog
  const handlePlanningDialogSave = useCallback(
    async (data: any) => {
      try {
        const targetColumn = columns.find((c) => c.column_type === "draft") || columns[0];

        const created = await createItem.mutateAsync({
          ...data,
          column_id: data.column_id || targetColumn?.id,
        });

        if (planningOutputNodeId) {
          updateNodeData(planningOutputNodeId, { addedToPlanning: true } as Partial<OutputNodeData>);
        }

        setPlanningDialogOpen(false);
        setPlanningOutputNode(null);
        setPlanningOutputNodeId(null);

        toast({
          title: "Enviado para planejamento",
          description: "Conteúdo adicionado com sucesso",
        });

        return created?.id ? { id: created.id } : undefined;
      } catch (err: any) {
        console.error("Failed to create planning item from canvas:", err);
        toast({
          title: "Não foi possível enviar para planejamento",
          description: err?.message || "Tente novamente.",
        });
        return;
      }
    },
    [columns, createItem, planningOutputNodeId, toast, updateNodeData]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S to save
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveCanvas();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveCanvas]);

  // Use refs to maintain stable references for handlers
  const handlersRef = useRef<{
    clientId: string;
    updateNodeData: typeof updateNodeData;
    deleteNode: typeof deleteNode;
    regenerateContent: typeof regenerateContent;
    handleOpenPlanningDialog: typeof handleOpenPlanningDialog;
    handleCreateOutput: (generatorNodeId: string, data: { type: 'text' | 'image'; content: string; imageUrl?: string; format: string; platform: string }) => void;
  } | null>(null);

  // Handler to create output node from generator
  const handleCreateOutput = useCallback((generatorNodeId: string, outputData: { type: 'text' | 'image'; content: string; imageUrl?: string; format: string; platform: string }) => {
    const generatorNode = nodes.find(n => n.id === generatorNodeId);
    if (!generatorNode) return;

    const nodeId = `output-${Date.now()}`;
    const newNode: RFNode = {
      id: nodeId,
      type: "output",
      position: { 
        x: generatorNode.position.x + 400, 
        y: generatorNode.position.y 
      },
      data: {
        type: "output",
        content: outputData.type === 'image' ? outputData.imageUrl || outputData.content : outputData.content,
        format: outputData.format as any,
        platform: outputData.platform as any,
        isImage: outputData.type === 'image',
        isEditing: false,
        addedToPlanning: false,
        versions: [],
        comments: [],
        approvalStatus: "draft",
      } as OutputNodeData,
    };
    
    onNodesChange([{ type: "add", item: newNode }] as any);
    
    // Create edge from generator to output
    const newEdge = {
      id: `edge-${generatorNodeId}-${nodeId}`,
      source: generatorNodeId,
      target: nodeId,
      type: 'default',
    };
    onEdgesChange([{ type: "add", item: newEdge }] as any);
  }, [nodes, onNodesChange, onEdgesChange]);

  // Update refs on each render
  handlersRef.current = {
    clientId,
    updateNodeData,
    deleteNode,
    regenerateContent,
    handleOpenPlanningDialog,
    handleCreateOutput,
  };

  // Handle drawing strokes
  const handleAddStroke = useCallback((stroke: DrawingStroke) => {
    setDrawingStrokes(prev => [...prev, stroke]);
  }, []);

  const handleDeleteStroke = useCallback((id: string) => {
    setDrawingStrokes(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleClearDrawings = useCallback(() => {
    setDrawingStrokes([]);
    toast({ title: "Desenhos limpos" });
  }, [toast]);

  // Add whiteboard node at position
  const addWhiteboardNode = useCallback((type: "text" | "sticky" | "shape", position: { x: number; y: number }, extraData?: any) => {
    const nodeId = `${type}-${Date.now()}`;
    const defaultData: Record<string, any> = {
      text: { type: "text", content: "", fontSize: 16, fontWeight: "normal", textAlign: "left", color: "#1f2937" },
      sticky: { type: "sticky", content: "", color: selectedStickyColor, size: "medium" },
      shape: { type: "shape", shapeType: selectedShape, fill: "#ffffff", stroke: "#3b82f6", strokeWidth: 2, width: 100, height: 100 },
    };
    
    const newNode: RFNode = {
      id: nodeId,
      type,
      position,
      data: { ...defaultData[type], ...extraData },
    };
    
    onNodesChange([{ type: "add", item: newNode }] as any);
  }, [selectedStickyColor, selectedShape, onNodesChange]);

  // Handle context menu actions
  const handleContextMenuAction = useCallback((action: string) => {
    if (!contextMenuPosition) return;
    
    const viewport = getViewport();
    const position = {
      x: (contextMenuPosition.x - viewport.x) / viewport.zoom,
      y: (contextMenuPosition.y - viewport.y) / viewport.zoom,
    };
    
    switch (action) {
      case "add-text":
        addWhiteboardNode("text", position);
        break;
      case "add-sticky":
        addWhiteboardNode("sticky", position);
        break;
      case "add-shape":
        addWhiteboardNode("shape", position);
        break;
      case "add-attachment":
        addNode("attachment", position);
        break;
      case "add-generator":
        addNode("generator", position);
        break;
      case "clear-drawings":
        setDrawingStrokes([]);
        toast({ title: "Desenhos limpos" });
        break;
    }
    
    setContextMenuPosition(null);
  }, [contextMenuPosition, getViewport, addWhiteboardNode, addNode, toast]);

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!bounds) return;
    setContextMenuPosition({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    });
  }, []);

  // Track viewport for drawing layer
  const handleMove = useCallback(() => {
    const vp = getViewport();
    setCanvasViewport({ x: vp.x, y: vp.y, zoom: vp.zoom });
  }, [getViewport]);

  // Create nodeTypes only once - SIMPLIFIED
  const nodeTypes = useMemo(
    () => ({
      attachment: (props: NodeProps<AttachmentNodeData>) => (
        <AttachmentNode
          {...props}
          data={{
            ...props.data,
            onUpdateData: (data) => handlersRef.current?.updateNodeData(props.id, data as any),
            onDelete: () => handlersRef.current?.deleteNode(props.id),
          }}
        />
      ),
      generator: (props: NodeProps<GeneratorNodeData>) => (
        <GeneratorNode
          {...props}
          data={{
            ...props.data,
            clientId: clientId,
            onUpdateData: (data) => handlersRef.current?.updateNodeData(props.id, data as any),
            onDelete: () => handlersRef.current?.deleteNode(props.id),
            onCreateOutput: (data) => handlersRef.current?.handleCreateOutput(props.id, data),
          }}
        />
      ),
      output: (props: NodeProps<OutputNodeData>) => (
        <ContentOutputNode
          {...props}
          onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data)}
          onDelete={(id) => handlersRef.current?.deleteNode(id)}
          onSendToPlanning={(id) => handlersRef.current?.handleOpenPlanningDialog(id)}
          onRegenerate={(id) => handlersRef.current?.regenerateContent(id)}
          onCreateRemix={(id) => {
            console.log('Remix requested for output:', id);
          }}
        />
      ),
      // Legacy alias - some saved canvases use "contentOutput" instead of "output"
      contentOutput: (props: NodeProps<OutputNodeData>) => (
        <ContentOutputNode
          {...props}
          onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data)}
          onDelete={(id) => handlersRef.current?.deleteNode(id)}
          onSendToPlanning={(id) => handlersRef.current?.handleOpenPlanningDialog(id)}
          onRegenerate={(id) => handlersRef.current?.regenerateContent(id)}
          onCreateRemix={(id) => {
            console.log('Remix requested for output:', id);
          }}
        />
      ),
      // Legacy alias - some saved canvases use "prompt" for text instructions
      prompt: (props: NodeProps<TextNodeData>) => (
        <TextNode
          {...props}
          onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data as any)}
          onDelete={(id) => handlersRef.current?.deleteNode(id)}
        />
      ),
      text: (props: NodeProps<TextNodeData>) => (
        <TextNode
          {...props}
          onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data as any)}
          onDelete={(id) => handlersRef.current?.deleteNode(id)}
        />
      ),
      sticky: (props: NodeProps<StickyNodeData>) => (
        <StickyNode
          {...props}
          onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data as any)}
          onDelete={(id) => handlersRef.current?.deleteNode(id)}
        />
      ),
      shape: (props: NodeProps<ShapeNodeData>) => (
        <ShapeNode
          {...props}
          onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data as any)}
          onDelete={(id) => handlersRef.current?.deleteNode(id)}
        />
      ),
      chat: (props: NodeProps) => (
        <MaterialChatNode
          {...props}
          data={{
            ...props.data,
            clientId: clientId,
            onUpdateData: (data) => handlersRef.current?.updateNodeData(props.id, data as any),
            onDelete: () => handlersRef.current?.deleteNode(props.id),
            onCreateNode: (content, position) => {
              const nodeId = `result-${Date.now()}`;
              const newNode: RFNode = {
                id: nodeId,
                type: "output",
                position,
                data: {
                  type: "output",
                  label: "Resposta do Chat",
                  content: content,
                  format: "post",
                  platform: "instagram",
                  isImage: false,
                  isEditing: false,
                  addedToPlanning: false,
                } as OutputNodeData,
              };
              onNodesChange([{ type: "add", item: newNode }] as any);
            },
          }}
        />
      ),
    }),
    [clientId, onNodesChange]
  );

  // Edge types
  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      default: AnimatedEdge,
    }),
    []
  );

  const handleAddNode = useCallback(
    (type: "attachment" | "generator" | "chat") => {
      const viewport = getViewport();
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
      const offset = nodes.length * 20;
      
      const nodeId = `${type}-${Date.now()}`;
      let defaultData: Record<string, unknown> = {};
      
      if (type === "attachment") {
        defaultData = { output: undefined };
      } else if (type === "generator") {
        defaultData = { type: "text" as const, format: "post", platform: "instagram" };
      } else if (type === "chat") {
        defaultData = { messages: [], clientId };
      }
      
      const newNode: RFNode = {
        id: nodeId,
        type,
        position: { x: centerX + offset, y: centerY + offset },
        data: defaultData,
      };
      onNodesChange([{ type: "add", item: newNode }] as any);
    },
    [getViewport, nodes.length, onNodesChange, clientId]
  );

  const handleClear = useCallback(() => {
    if (nodes.length === 0) return;
    if (window.confirm("Tem certeza que deseja limpar o canvas?")) {
      clearCanvas();
    }
  }, [nodes.length, clearCanvas]);

  // Handle loading quick template (pre-connected nodes)
  const handleLoadQuickTemplate = useCallback((template: QuickTemplate) => {
    const viewport = getViewport();
    const baseX = (window.innerWidth / 2 - viewport.x) / viewport.zoom - 200;
    const baseY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
    
    const newNodes: RFNode[] = [];
    const newEdges: { id: string; source: string; target: string; type: string }[] = [];
    const timestamp = Date.now();
    
    // Create nodes from template
    template.nodes.forEach((nodeConfig, index) => {
      const nodeId = `${nodeConfig.type}-${timestamp}-${index}`;
      const defaultData = nodeConfig.type === "attachment" 
        ? { output: undefined, ...nodeConfig.data } 
        : { type: "text" as const, format: "post", platform: "instagram", ...nodeConfig.data };
      
      newNodes.push({
        id: nodeId,
        type: nodeConfig.type,
        position: { 
          x: baseX + nodeConfig.offset.x, 
          y: baseY + nodeConfig.offset.y 
        },
        data: defaultData,
      });
    });
    
    // Create edges between consecutive nodes
    for (let i = 0; i < newNodes.length - 1; i++) {
      const sourceNode = newNodes[i];
      const targetNode = newNodes[i + 1];
      
      newEdges.push({
        id: `edge-${sourceNode.id}-${targetNode.id}`,
        source: sourceNode.id,
        target: targetNode.id,
        type: 'default',
      });
    }
    
    // Add all nodes and edges
    onNodesChange(newNodes.map(n => ({ type: "add" as const, item: n })) as any);
    
    // Add edges after a short delay to ensure nodes exist
    setTimeout(() => {
      onEdgesChange(newEdges.map(e => ({ type: "add" as const, item: e })) as any);
    }, 50);
    
    toast({
      title: `Template "${template.label}" criado`,
      description: "Nós já conectados e configurados",
    });
  }, [getViewport, onNodesChange, onEdgesChange, toast]);

  // Handle adding reference from library
  const handleSelectReference = useCallback(
    (ref: ReferenceItem) => {
      const viewport = getViewport();
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
      const offset = nodes.length * 20;

      const nodeId = `attachment-${Date.now()}`;
      const newNode: RFNode = {
        id: nodeId,
        type: "attachment",
        position: { x: centerX + offset, y: centerY + offset },
        data: {
          output: {
            type: "text",
            content: ref.content,
            fileName: ref.title,
          }
        },
      };
      onNodesChange([{ type: "add", item: newNode }] as any);

      toast({
        title: "Referência adicionada",
        description: `"${ref.title}" foi adicionada ao canvas`,
      });
    },
    [getViewport, nodes.length, onNodesChange, toast]
  );

  // Handle adding visual reference from library
  const handleSelectVisualReference = useCallback(
    (ref: ClientVisualReference) => {
      const viewport = getViewport();
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
      const offset = nodes.length * 20;

      const nodeId = `attachment-${Date.now()}`;
      const newNode: RFNode = {
        id: nodeId,
        type: "attachment",
        position: { x: centerX + offset, y: centerY + offset },
        data: {
          output: {
            type: "image",
            content: ref.image_url,
            imageBase64: ref.image_url,
            fileName: ref.title || "Imagem",
          }
        },
      };
      onNodesChange([{ type: "add", item: newNode }] as any);

      toast({
        title: "Referência visual adicionada",
        description: `"${ref.title || "Imagem"}" foi adicionada ao canvas`,
      });
    },
    [getViewport, nodes.length, onNodesChange, toast]
  );

  // Add a library content item as an "attachment" node
  const handleSelectContentFromLibrary = useCallback(
    (item: UnifiedContentItem) => {
      const viewport = getViewport();
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
      const offset = nodes.length * 20;

      const nodeId = `attachment-${Date.now()}`;
      const newNode: RFNode = {
        id: nodeId,
        type: "attachment",
        position: { x: centerX + offset, y: centerY + offset },
        data: {
          output: {
            type: "library",
            content: item.content,
            fileName: item.title,
            libraryTitle: item.title,
            libraryImages: item.images || (item.thumbnail_url ? [item.thumbnail_url] : []),
            libraryId: item.id,
            libraryPlatform: item.platform,
          }
        },
      };
      onNodesChange([{ type: "add", item: newNode }] as any);

      toast({
        title: "Adicionado ao canvas",
        description: item.title,
      });
    },
    [getViewport, nodes.length, onNodesChange, toast]
  );

  // Drag & drop from library into canvas
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      // Check for file drops first
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const files = Array.from(event.dataTransfer.files);
        
        files.forEach((file, index) => {
          const nodeId = `attachment-${Date.now()}-${index}`;
          const isImage = file.type.startsWith('image/');
          const isAudio = file.type.startsWith('audio/');
          const isVideo = file.type.startsWith('video/');
          
          // Create blob URL for preview
          const blobUrl = URL.createObjectURL(file);
          
          const newNode: RFNode = {
            id: nodeId,
            type: "attachment",
            position: { x: position.x + (index * 30), y: position.y + (index * 30) },
            data: {
              output: isImage ? {
                type: "image" as const,
                content: blobUrl,
                imageBase64: blobUrl,
                fileName: file.name,
              } : {
                type: (isAudio ? "audio" : isVideo ? "video" : "text") as any,
                content: file.name,
                fileName: file.name,
              }
            },
          };
          onNodesChange([{ type: "add", item: newNode }] as any);
        });

        toast({
          title: `${files.length} arquivo(s) adicionado(s)`,
          description: "Arraste para conectar ao gerador",
        });
        return;
      }

      // Handle library content drops
      const raw =
        event.dataTransfer.getData("application/x-kai-unified-content") ||
        event.dataTransfer.getData("application/json");
      if (!raw) return;

      let item: UnifiedContentItem | null = null;
      try {
        item = JSON.parse(raw);
      } catch {
        return;
      }
      if (!item?.content) return;

      const nodeId = `attachment-${Date.now()}`;
      const newNode: RFNode = {
        id: nodeId,
        type: "attachment",
        position,
        data: {
          output: {
            type: "library",
            content: item.content,
            fileName: item.title,
            libraryTitle: item.title,
            libraryImages: item.images || (item.thumbnail_url ? [item.thumbnail_url] : []),
            libraryId: item.id,
            libraryPlatform: item.platform,
          }
        },
      };
      onNodesChange([{ type: "add", item: newNode }] as any);

      toast({
        title: "Adicionado ao canvas",
        description: item.title,
      });
    },
    [project, onNodesChange, toast]
  );

  // File drag state for visual feedback
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    // Only reset if leaving the main container
    if (event.currentTarget === event.target) {
      setIsDraggingFile(false);
    }
  }, []);

  return (
    <div
      ref={reactFlowWrapper}
      className={cn(
        "w-full h-full relative transition-all",
        isDraggingFile && "ring-4 ring-primary/50 ring-inset bg-primary/5"
      )}
      onDrop={(e) => { setIsDraggingFile(false); handleDrop(e); }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onContextMenu={handleContextMenu}
    >
      {/* Drag overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm pointer-events-none">
          <div className="bg-background border-2 border-dashed border-primary rounded-xl p-8 text-center">
            <Image className="h-12 w-12 mx-auto mb-3 text-primary" />
            <p className="text-lg font-medium">Solte arquivos aqui</p>
            <p className="text-sm text-muted-foreground">Imagens, áudios ou vídeos</p>
          </div>
        </div>
      )}
      
      {/* Client Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-sm border-b px-4 py-2 flex items-center gap-3">
        <Avatar className="h-8 w-8 rounded-lg">
          <AvatarImage src={client?.avatar_url || ""} alt={client?.name} className="object-cover" />
          <AvatarFallback className="rounded-lg bg-primary/20 text-primary text-sm font-semibold">
            {client?.name?.charAt(0).toUpperCase() || "C"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-medium text-sm">{client?.name || "Cliente"}</h3>
          <p className="text-xs text-muted-foreground">Canvas de Criação</p>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMove={handleMove}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          type: 'default',
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-muted/30 pt-12"
        panOnDrag={activeTool === "cursor"}
        selectionOnDrag={activeTool === "cursor"}
        nodesDraggable={activeTool === "cursor"}
        onClick={(e) => {
          if (contextMenuPosition) {
            setContextMenuPosition(null);
          }
          if (activeTool !== "cursor" && activeTool !== "pencil" && activeTool !== "eraser") {
            const bounds = reactFlowWrapper.current?.getBoundingClientRect();
            if (!bounds) return;
            const viewport = getViewport();
            const position = {
              x: (e.clientX - bounds.left - viewport.x) / viewport.zoom,
              y: (e.clientY - bounds.top - viewport.y) / viewport.zoom,
            };
            
            if (activeTool === "text") {
              addWhiteboardNode("text", position);
              setActiveTool("cursor");
            } else if (activeTool === "sticky") {
              addWhiteboardNode("sticky", position);
              setActiveTool("cursor");
            } else if (activeTool === "shape") {
              addWhiteboardNode("shape", position);
              setActiveTool("cursor");
            } else if (activeTool === "image") {
              // For image tool, just switch to cursor - use Attachment node instead
              setActiveTool("cursor");
            }
          }
        }}
      >
        <Background gap={20} size={1} className="bg-muted/50" />
        <Controls className="bg-background border shadow-lg rounded-lg" showInteractive={false} />
        <MiniMap
          className="bg-background border shadow-lg rounded-lg"
          nodeColor={(node) => {
            switch (node.type) {
              case "attachment":
                return "#06b6d4";
              case "generator":
                return "#3b82f6";
              case "output":
                return "#ec4899";
              case "sticky":
                return "#fbbf24";
              case "text":
                return "#6b7280";
              case "shape":
                return "#8b5cf6";
              default:
                return "#888";
            }
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>

      {/* Drawing Layer - OUTSIDE ReactFlow */}
      <DrawingLayer
        strokes={drawingStrokes}
        isDrawing={activeTool === "pencil"}
        isErasing={activeTool === "eraser"}
        brushColor={brushColor}
        brushSize={brushSize}
        viewport={canvasViewport}
        onAddStroke={handleAddStroke}
        onDeleteStroke={handleDeleteStroke}
        containerRef={reactFlowWrapper}
      />

      {/* Context Menu */}
      {contextMenuPosition && (
        <CanvasContextMenu
          position={contextMenuPosition}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenuPosition(null)}
          hasDrawings={drawingStrokes.length > 0}
        />
      )}

      {/* Unified Toolbar */}
      <CanvasToolbar
        onAddNode={handleAddNode}
        onClear={handleClear}
        onZoomIn={() => zoomIn()}
        onZoomOut={() => zoomOut()}
        onFitView={() => fitView()}
        onSave={saveCanvas}
        onLoad={loadCanvas}
        onDelete={deleteCanvas}
        onLoadTemplate={loadTemplate}
        onLoadQuickTemplate={handleLoadQuickTemplate}
        onOpenLibrary={() => setLibraryDrawerOpen(true)}
        savedCanvases={savedCanvases}
        currentCanvasName={currentCanvasName}
        setCanvasName={setCanvasName}
        isLoadingCanvases={isLoadingCanvases}
        isSaving={isSaving}
        autoSaveStatus={autoSaveStatus}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        brushColor={brushColor}
        brushSize={brushSize}
        onBrushColorChange={setBrushColor}
        onBrushSizeChange={setBrushSize}
        selectedShape={selectedShape}
        onShapeChange={setSelectedShape}
        selectedStickyColor={selectedStickyColor}
        onStickyColorChange={setSelectedStickyColor}
        onClearDrawings={handleClearDrawings}
      />

      {/* Library Drawer */}
      <CanvasLibraryDrawer
        open={libraryDrawerOpen}
        onClose={() => setLibraryDrawerOpen(false)}
        clientId={clientId}
        onSelectReference={handleSelectReference}
        onSelectVisualReference={handleSelectVisualReference}
        onSelectContent={handleSelectContentFromLibrary}
      />

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pt-20">
          <div className="text-center space-y-6 max-w-2xl px-4 pointer-events-auto">
            <div className="space-y-2">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Canvas de Criação</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Use a toolbar para adicionar Anexos e conectá-los ao Gerador
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-left">
              {[
                { id: "carousel_from_url", Icon: LayoutGrid, label: "Carrossel", desc: "URL → Carrossel" },
                { id: "thread_from_video", Icon: MessageSquare, label: "Thread", desc: "Vídeo → Thread" },
                { id: "linkedin_article", Icon: Briefcase, label: "LinkedIn", desc: "URL → Artigo" },
                { id: "story_sequence", Icon: BookOpen, label: "Stories", desc: "Texto → Stories" },
                { id: "repurpose_blog", Icon: RefreshCw, label: "Repurpose", desc: "Blog → Multi" },
                { id: "image_series", Icon: Image, label: "Imagens", desc: "Texto → Imagem" },
              ].map((template) => (
                <button
                  key={template.id}
                  onClick={() => loadTemplate(template.id)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:bg-accent hover:border-primary/50 transition-all group"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <template.Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">{template.label}</p>
                    <p className="text-xs text-muted-foreground">{template.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="pt-2">
              <p className="text-xs text-muted-foreground">
                Fluxo simples:
                <span className="ml-1 inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded bg-cyan-500" /> Anexo
                  <span className="mx-1">→</span>
                  <span className="h-2 w-2 rounded bg-blue-500" /> Gerador
                  <span className="mx-1">→</span>
                  <span className="h-2 w-2 rounded bg-pink-500" /> Resultado
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Planning Item Dialog */}
      {planningOutputNode && (
        <PlanningItemDialog
          open={planningDialogOpen}
          onOpenChange={(open) => {
            setPlanningDialogOpen(open);
            if (!open) {
              setPlanningOutputNode(null);
              setPlanningOutputNodeId(null);
            }
          }}
          columns={columns}
          defaultClientId={clientId}
          defaultColumnId={columns.find((c) => c.column_type === "draft")?.id || columns[0]?.id}
          item={(() => {
            // Parse thread content into individual tweets
            const parseThreadToTweets = (content: string) => {
              const tweets: { id: string; text: string; media_urls: string[] }[] = [];
              
              // Format 1: Tweet X/Y: or Tweet X:
              const tweetPattern = /Tweet\s*\d+(?:\/\d+)?:\s*/gi;
              const parts = content.split(tweetPattern).filter(Boolean);
              
              if (parts.length > 1) {
                parts.forEach((text, i) => {
                  const cleanText = text.trim().replace(/^[\n\r]+|[\n\r]+$/g, '');
                  if (cleanText) {
                    tweets.push({
                      id: `tweet-${i + 1}`,
                      text: cleanText,
                      media_urls: []
                    });
                  }
                });
                return tweets;
              }
              
              // Format 2: Separator ---
              if (content.includes('\n---\n') || content.includes('\n\n---\n\n')) {
                const separated = content.split(/\n+---\n+/).filter(Boolean);
                if (separated.length > 1) {
                  separated.forEach((text, i) => {
                    const cleanText = text.trim();
                    if (cleanText) {
                      tweets.push({
                        id: `tweet-${i + 1}`,
                        text: cleanText,
                        media_urls: []
                      });
                    }
                  });
                  return tweets;
                }
              }
              
              // Format 3: Numbered list 1. 2. 3. (each on new paragraph)
              const numberedPattern = /^\d+\.\s*/gm;
              if (numberedPattern.test(content)) {
                const lines = content.split(/\n\n+/);
                lines.forEach((line, i) => {
                  const cleanText = line.replace(/^\d+\.\s*/, '').trim();
                  if (cleanText && cleanText.length > 10) {
                    tweets.push({
                      id: `tweet-${i + 1}`,
                      text: cleanText,
                      media_urls: []
                    });
                  }
                });
                if (tweets.length > 1) return tweets;
              }
              
              // Fallback: single tweet
              return [{ id: 'tweet-1', text: content.trim(), media_urls: [] }];
            };

            const threadTweets = planningOutputNode.format === 'thread'
              ? parseThreadToTweets(planningOutputNode.content)
              : undefined;

            return {
              id: "",
              title: `${
                planningOutputNode.format === "carousel"
                  ? "Carrossel"
                  : planningOutputNode.format === "thread"
                    ? "Thread"
                    : planningOutputNode.format === "reel_script"
                      ? "Roteiro Reel"
                      : planningOutputNode.format === "post"
                        ? "Post"
                        : planningOutputNode.format === "stories"
                          ? "Stories"
                          : planningOutputNode.format === "newsletter"
                            ? "Newsletter"
                            : planningOutputNode.format === "image"
                              ? "Imagem"
                              : "Conteúdo"
              } - ${new Date().toLocaleDateString("pt-BR")}`,
              content: planningOutputNode.isImage ? "" : planningOutputNode.content,
              client_id: clientId,
              workspace_id: "",
              created_by: "",
              created_at: "",
              updated_at: "",
              status: "draft",
              priority: "medium",
              platform: planningOutputNode.platform as any,
              content_type: FORMAT_TO_CONTENT_TYPE[planningOutputNode.format] || "post",
              media_urls: planningOutputNode.isImage ? [planningOutputNode.content] : [],
              metadata: {
                content_type: FORMAT_TO_CONTENT_TYPE[planningOutputNode.format] || "post",
                from_canvas: true,
                thread_tweets: threadTweets,
              },
            } as any;
          })()}
          onSave={handlePlanningDialogSave}
        />
      )}

    </div>
  );
}

export function ContentCanvas({ clientId }: ContentCanvasProps) {
  return (
    <ReactFlowProvider>
      <ContentCanvasInner clientId={clientId} />
    </ReactFlowProvider>
  );
}
