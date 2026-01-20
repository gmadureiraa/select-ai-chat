import { useCallback, useRef, useMemo, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  NodeProps,
  EdgeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import { Sparkles, LayoutGrid, MessageSquare, Briefcase, BookOpen, RefreshCw, Image } from "lucide-react";
import { AnimatedEdge } from "./components/AnimatedEdge";
import {
  useCanvasState,
  NodeDataType,
  SourceNodeData,
  PromptNodeData,
  GeneratorNodeData,
  OutputNodeData,
  ContentFormat,
  ImageSourceNodeData,
  AttachmentNodeData,
} from "./hooks/useCanvasState";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasSideToolbar, ToolType, ShapeType } from "./CanvasSideToolbar";
import { CanvasLibraryDrawer } from "./CanvasLibraryDrawer";
import { SourceNode } from "./nodes/SourceNode";
import { PromptNode } from "./nodes/PromptNode";
import { GeneratorNode } from "./nodes/GeneratorNode";
import { ContentOutputNode } from "./nodes/ContentOutputNode";
import { ImageSourceNode } from "./nodes/ImageSourceNode";
import { AttachmentNode } from "./nodes/AttachmentNode";
import { TextNode, TextNodeData } from "./nodes/TextNode";
import { StickyNode, StickyNodeData } from "./nodes/StickyNode";
import { ShapeNode, ShapeNodeData } from "./nodes/ShapeNode";
import { QuickImageNode, QuickImageNodeData } from "./nodes/QuickImageNode";
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

// Component version: 4 - Whiteboard features
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
    extractUrlContent,
    transcribeFile,
    analyzeImageStyle,
    analyzeImageSourceImage,
    transcribeImageSourceImage,
    generateContent,
    regenerateContent,
    editImage,
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

        // PlanningItemDialog can use this for downstream actions (ex: agendamento)
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

  // Use refs to maintain stable references for handlers - initialized once with null-safe defaults
  const handlersRef = useRef<{
    clientId: string;
    extractUrlContent: typeof extractUrlContent;
    transcribeFile: typeof transcribeFile;
    analyzeImageStyle: typeof analyzeImageStyle;
    analyzeImageSourceImage: typeof analyzeImageSourceImage;
    transcribeImageSourceImage: typeof transcribeImageSourceImage;
    updateNodeData: typeof updateNodeData;
    deleteNode: typeof deleteNode;
    generateContent: typeof generateContent;
    regenerateContent: typeof regenerateContent;
    editImage: typeof editImage;
    handleOpenPlanningDialog: typeof handleOpenPlanningDialog;
  } | null>(null);

  // Update refs on each render so they always have latest values
  handlersRef.current = {
    clientId,
    extractUrlContent,
    transcribeFile,
    analyzeImageStyle,
    analyzeImageSourceImage,
    transcribeImageSourceImage,
    updateNodeData,
    deleteNode,
    generateContent,
    regenerateContent,
    editImage,
    handleOpenPlanningDialog,
  };

  // Create nodeTypes only once - handlers are accessed via ref
  const nodeTypes = useMemo(
    () => ({
      source: (props: NodeProps<SourceNodeData>) => (
        <SourceNode
          {...props}
          onExtractUrl={(id, url) => handlersRef.current?.extractUrlContent(id, url)}
          onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data)}
          onDelete={(id) => handlersRef.current?.deleteNode(id)}
          onTranscribeFile={(id, fileId) => handlersRef.current?.transcribeFile(id, fileId)}
          onAnalyzeStyle={(id, fileId) => handlersRef.current?.analyzeImageStyle(id, fileId)}
        />
      ),
      prompt: (props: NodeProps<PromptNodeData>) => (
        <PromptNode
          {...props}
          onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data)}
          onDelete={(id) => handlersRef.current?.deleteNode(id)}
        />
      ),
      generator: (props: NodeProps<GeneratorNodeData>) => (
        <GeneratorNode
          {...props}
          onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data)}
          onDelete={(id) => handlersRef.current?.deleteNode(id)}
          onGenerate={(id) => handlersRef.current?.generateContent(id)}
          onGenerateMore={(id) => handlersRef.current?.generateContent(id)}
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
            // Create a new generator node connected to this output for remixing
            const node = props;
            if (node.xPos !== undefined && node.yPos !== undefined) {
              const newGenId = handlersRef.current?.updateNodeData ? 
                (() => {
                  // This will be handled by the remix logic in useCanvasState
                  console.log('Remix requested for output:', id);
                })() : undefined;
            }
          }}
        />
      ),
      "image-source": (props: NodeProps<ImageSourceNodeData>) => (
        <ImageSourceNode
          {...props}
          onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data)}
          onDelete={(id) => handlersRef.current?.deleteNode(id)}
          onAnalyzeImage={(id, imageId, imageUrl) => handlersRef.current?.analyzeImageSourceImage(id, imageId, imageUrl)}
          onTranscribeImage={(id, imageId, imageUrl) => handlersRef.current?.transcribeImageSourceImage(id, imageId, imageUrl)}
        />
      ),
      attachment: (props: NodeProps<AttachmentNodeData>) => (
        <AttachmentNode
          {...props}
          onExtractUrl={(id, url) => handlersRef.current?.extractUrlContent(id, url)}
          onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data)}
          onDelete={(id) => handlersRef.current?.deleteNode(id)}
          onTranscribeFile={(id, fileId) => handlersRef.current?.transcribeFile(id, fileId)}
          onAnalyzeStyle={(id, fileId) => handlersRef.current?.analyzeImageStyle(id, fileId)}
          onAnalyzeImage={(id, imageId, imageUrl) => handlersRef.current?.analyzeImageSourceImage(id, imageId, imageUrl)}
          onTranscribeImage={(id, imageId, imageUrl) => handlersRef.current?.transcribeImageSourceImage(id, imageId, imageUrl)}
        />
      ),
    }),
    []
  );

  // Edge types with animated edges for generation
  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      default: AnimatedEdge,
    }),
    []
  );

  const handleAddNode = useCallback(
    (type: "attachment" | "prompt" | "generator") => {
      const viewport = getViewport();
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;

      // Offset based on existing nodes to avoid overlap
      const offset = nodes.length * 20;

      addNode(type, { x: centerX + offset, y: centerY + offset });
    },
    [addNode, getViewport, nodes.length]
  );

  const handleClear = useCallback(() => {
    if (nodes.length === 0) return;
    if (window.confirm("Tem certeza que deseja limpar o canvas?")) {
      clearCanvas();
    }
  }, [nodes.length, clearCanvas]);

  // Handle adding reference from library
  const handleSelectReference = useCallback(
    (ref: ReferenceItem) => {
      const viewport = getViewport();
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
      const offset = nodes.length * 20;

      addNode("attachment", { x: centerX + offset, y: centerY + offset }, {
        type: "attachment",
        activeTab: "text",
        textContent: ref.content,
      } as Partial<AttachmentNodeData>);

      toast({
        title: "Referência adicionada",
        description: `"${ref.title}" foi adicionada ao canvas`,
      });
    },
    [addNode, getViewport, nodes.length, toast]
  );

  // Handle adding visual reference from library
  const handleSelectVisualReference = useCallback(
    (ref: ClientVisualReference) => {
      const viewport = getViewport();
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
      const offset = nodes.length * 20;

      addNode("attachment", { x: centerX + offset, y: centerY + offset }, {
        type: "attachment",
        activeTab: "image",
        images: [{ id: crypto.randomUUID(), url: ref.image_url, name: ref.title || "Imagem" }],
      } as Partial<AttachmentNodeData>);

      toast({
        title: "Referência visual adicionada",
        description: `"${ref.title || "Imagem"}" foi adicionada ao canvas`,
      });
    },
    [addNode, getViewport, nodes.length, toast]
  );

  // Add a library content item as an "attachment" node
  const handleSelectContentFromLibrary = useCallback(
    (item: UnifiedContentItem) => {
      const viewport = getViewport();
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
      const offset = nodes.length * 20;

      addNode(
        "attachment",
        { x: centerX + offset, y: centerY + offset },
        {
          type: "attachment",
          activeTab: "text",
          textContent: item.content,
          title: item.title,
          thumbnail: item.thumbnail_url,
        } as Partial<AttachmentNodeData>
      );

      toast({
        title: "Adicionado ao canvas",
        description: item.title,
      });
    },
    [addNode, getViewport, nodes.length, toast]
  );

  // Drag & drop from library into canvas
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

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

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      // Use platform as content type label
      const contentTypeLabel = item.platform || "conteúdo";
      
      // Use the new unified "attachment" node instead of legacy "source"
      addNode(
        "attachment",
        position,
        {
          type: "attachment",
          activeTab: "text",
          textContent: item.content,
          extractedContent: item.content,
          title: item.title,
          thumbnail: item.thumbnail_url,
          files: [],
          images: [],
          contentMetadata: {
            libraryItemId: item.id,
            libraryItemType: contentTypeLabel,
            wordCount: item.content?.split(/\s+/).length || 0,
          },
        } as Partial<AttachmentNodeData>
      );

      toast({
        title: "Adicionado ao canvas",
        description: item.title,
      });
    },
    [addNode, project, toast]
  );

  return (
    <div
      ref={reactFlowWrapper}
      className="w-full h-full relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
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
      >
        <Background gap={20} size={1} className="bg-muted/50" />
        <Controls className="bg-background border shadow-lg rounded-lg" showInteractive={false} />
        <MiniMap
          className="bg-background border shadow-lg rounded-lg"
          nodeColor={(node) => {
            switch (node.type) {
              case "source":
                return "#3b82f6";
              case "attachment":
                return "#3b82f6";
              case "prompt":
                return "#eab308";
              case "generator":
                return "#22c55e";
              case "output":
                return "#ec4899";
              case "image-source":
                return "#06b6d4";
              default:
                return "#888";
            }
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>

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
        onOpenLibrary={() => setLibraryDrawerOpen(true)}
        savedCanvases={savedCanvases}
        currentCanvasName={currentCanvasName}
        setCanvasName={setCanvasName}
        isLoadingCanvases={isLoadingCanvases}
        isSaving={isSaving}
        autoSaveStatus={autoSaveStatus}
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

      {/* Empty state with template quick actions */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pt-20">
          <div className="text-center space-y-6 max-w-2xl px-4 pointer-events-auto">
            <div className="space-y-2">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Canvas de Criação</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Escolha um template para começar rapidamente ou adicione nós manualmente
              </p>
            </div>

            {/* Quick template cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-left">
              {[
                { id: "carousel_from_url", Icon: LayoutGrid, label: "Carrossel", desc: "URL → Carrossel" },
                { id: "thread_from_video", Icon: MessageSquare, label: "Thread", desc: "Vídeo → Thread" },
                { id: "linkedin_article", Icon: Briefcase, label: "LinkedIn", desc: "URL → Artigo" },
                { id: "story_sequence", Icon: BookOpen, label: "Stories", desc: "Texto → Stories" },
                { id: "repurpose_blog", Icon: RefreshCw, label: "Repurpose", desc: "Blog → Multi" },
                { id: "image_series", Icon: Image, label: "Imagens", desc: "Texto → 3 imgs" },
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
                Ou use a toolbar acima para criar do zero •
                <span className="ml-1 inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded bg-blue-500" /> Anexo
                  <span className="h-2 w-2 rounded bg-yellow-500 ml-2" /> Instruções
                  <span className="h-2 w-2 rounded bg-green-500 ml-2" /> Gerador
                  <span className="h-2 w-2 rounded bg-pink-500 ml-2" /> Resultado
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
          item={{
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
            },
          } as any}
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
