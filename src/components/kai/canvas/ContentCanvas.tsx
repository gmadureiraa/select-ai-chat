import { useCallback, useRef, useMemo, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";

import { useCanvasState, NodeDataType, CanvasNodeData, SourceNodeData, LibraryNodeData, PromptNodeData, GeneratorNodeData, OutputNodeData, ContentFormat, ImageEditorNodeData } from "./hooks/useCanvasState";
import { CanvasToolbar } from "./CanvasToolbar";
import { SourceNode } from "./nodes/SourceNode";
import { LibraryRefNode } from "./nodes/LibraryRefNode";
import { PromptNode } from "./nodes/PromptNode";
import { GeneratorNode } from "./nodes/GeneratorNode";
import { ContentOutputNode } from "./nodes/ContentOutputNode";
import { ImageEditorNode } from "./nodes/ImageEditorNode";
import { PlanningItemDialog } from "@/components/planning/PlanningItemDialog";
import { usePlanningItems } from "@/hooks/usePlanningItems";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { CONTENT_TO_PLATFORM, ContentTypeKey } from "@/types/contentTypes";

interface ContentCanvasProps {
  clientId: string;
}

// Map canvas format to content type key
const FORMAT_TO_CONTENT_TYPE: Record<ContentFormat, ContentTypeKey> = {
  carousel: 'carousel',
  thread: 'thread',
  reel_script: 'short_video',
  post: 'instagram_post',
  stories: 'stories',
  newsletter: 'newsletter',
  image: 'static_image',
};

function ContentCanvasInner({ clientId }: ContentCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { zoomIn, zoomOut, fitView, getViewport } = useReactFlow();
  const { toast } = useToast();

  // Planning dialog state
  const [planningDialogOpen, setPlanningDialogOpen] = useState(false);
  const [planningOutputNode, setPlanningOutputNode] = useState<OutputNodeData | null>(null);
  const [planningOutputNodeId, setPlanningOutputNodeId] = useState<string | null>(null);

  const { columns, createItem, updateItem } = usePlanningItems({ clientId });

  // Fetch client data for header
  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, avatar_url')
        .eq('id', clientId)
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
  } = useCanvasState(clientId);

  // Handler to open planning dialog with output data
  const handleOpenPlanningDialog = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.data.type === "output") {
      setPlanningOutputNode(node.data as OutputNodeData);
      setPlanningOutputNodeId(nodeId);
      setPlanningDialogOpen(true);
    }
  }, [nodes]);

  // Handle saving from planning dialog
  const handlePlanningDialogSave = useCallback(async (data: any) => {
    await createItem.mutateAsync(data);
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
  }, [createItem, planningOutputNodeId, updateNodeData, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S to save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveCanvas();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveCanvas]);

  // Use refs to maintain stable references for handlers - initialized once with null-safe defaults
  const handlersRef = useRef<{
    clientId: string;
    extractUrlContent: typeof extractUrlContent;
    transcribeFile: typeof transcribeFile;
    analyzeImageStyle: typeof analyzeImageStyle;
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
    updateNodeData,
    deleteNode,
    generateContent,
    regenerateContent,
    editImage,
    handleOpenPlanningDialog,
  };

  // Create nodeTypes only once - handlers are accessed via ref
  // Create nodeTypes only once - handlers are accessed via ref
  const nodeTypes = useMemo(() => ({
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
    library: (props: NodeProps<LibraryNodeData>) => (
      <LibraryRefNode
        {...props}
        clientId={handlersRef.current?.clientId || ""}
        onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data)}
        onDelete={(id) => handlersRef.current?.deleteNode(id)}
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
      />
    ),
    output: (props: NodeProps<OutputNodeData>) => (
      <ContentOutputNode
        {...props}
        onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data)}
        onDelete={(id) => handlersRef.current?.deleteNode(id)}
        onSendToPlanning={(id) => handlersRef.current?.handleOpenPlanningDialog(id)}
        onRegenerate={(id) => handlersRef.current?.regenerateContent(id)}
      />
    ),
    "image-editor": (props: NodeProps<ImageEditorNodeData>) => (
      <ImageEditorNode
        {...props}
        onUpdateData={(id, data) => handlersRef.current?.updateNodeData(id, data)}
        onDelete={(id) => handlersRef.current?.deleteNode(id)}
        onEdit={(id) => handlersRef.current?.editImage(id)}
      />
    ),
  }), []);

  const handleAddNode = useCallback((type: NodeDataType) => {
    const viewport = getViewport();
    const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
    const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
    
    // Offset based on existing nodes to avoid overlap
    const offset = nodes.length * 20;
    
    addNode(type, { x: centerX + offset, y: centerY + offset });
  }, [addNode, getViewport, nodes.length]);

  const handleClear = useCallback(() => {
    if (nodes.length === 0) return;
    if (window.confirm("Tem certeza que deseja limpar o canvas?")) {
      clearCanvas();
    }
  }, [nodes.length, clearCanvas]);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full relative">
      {/* Client Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-sm border-b px-4 py-2 flex items-center gap-3">
        <Avatar className="h-8 w-8 rounded-lg">
          <AvatarImage src={client?.avatar_url || ''} alt={client?.name} className="object-cover" />
          <AvatarFallback className="rounded-lg bg-primary/20 text-primary text-sm font-semibold">
            {client?.name?.charAt(0).toUpperCase() || 'C'}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-medium text-sm">{client?.name || 'Cliente'}</h3>
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
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-muted/30 pt-12"
      >
        <Background gap={20} size={1} className="bg-muted/50" />
        <Controls 
          className="bg-background border shadow-lg rounded-lg"
          showInteractive={false}
        />
        <MiniMap 
          className="bg-background border shadow-lg rounded-lg"
          nodeColor={(node) => {
            switch (node.type) {
              case "source": return "#3b82f6";
              case "library": return "#a855f7";
              case "prompt": return "#eab308";
              case "generator": return "#22c55e";
              case "output": return "#ec4899";
              case "image-editor": return "#f97316";
              default: return "#888";
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
        savedCanvases={savedCanvases}
        currentCanvasName={currentCanvasName}
        setCanvasName={setCanvasName}
        isLoadingCanvases={isLoadingCanvases}
        isSaving={isSaving}
      />

      {/* Empty state with template quick actions */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pt-20">
          <div className="text-center space-y-6 max-w-2xl px-4 pointer-events-auto">
            <div className="space-y-2">
              <div className="text-5xl">✨</div>
              <h3 className="text-xl font-semibold">Canvas de Criação</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Escolha um template para começar rapidamente ou adicione nós manualmente
              </p>
            </div>
            
            {/* Quick template cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-left">
              {[
                { id: "carousel_from_url", icon: "🎠", label: "Carrossel", desc: "URL → Carrossel" },
                { id: "thread_from_video", icon: "🧵", label: "Thread", desc: "Vídeo → Thread" },
                { id: "linkedin_article", icon: "💼", label: "LinkedIn", desc: "URL → Artigo" },
                { id: "story_sequence", icon: "📖", label: "Stories", desc: "Texto → Stories" },
                { id: "repurpose_blog", icon: "🔄", label: "Repurpose", desc: "Blog → Multi" },
                { id: "image_series", icon: "🖼️", label: "Imagens", desc: "Texto → 3 imgs" },
              ].map((template) => (
                <button
                  key={template.id}
                  onClick={() => loadTemplate(template.id)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:bg-accent hover:border-primary/50 transition-all group"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">{template.icon}</span>
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
                  <span className="h-2 w-2 rounded bg-blue-500" /> Fonte
                  <span className="h-2 w-2 rounded bg-yellow-500 ml-2" /> Briefing
                  <span className="h-2 w-2 rounded bg-green-500 ml-2" /> Gerador
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
          defaultColumnId={columns.find(c => c.column_type === "draft")?.id || columns[0]?.id}
          item={{
            id: '',
            title: `${planningOutputNode.format === 'carousel' ? 'Carrossel' : 
                    planningOutputNode.format === 'thread' ? 'Thread' :
                    planningOutputNode.format === 'reel_script' ? 'Roteiro Reel' :
                    planningOutputNode.format === 'post' ? 'Post' :
                    planningOutputNode.format === 'stories' ? 'Stories' :
                    planningOutputNode.format === 'newsletter' ? 'Newsletter' :
                    planningOutputNode.format === 'image' ? 'Imagem' : 'Conteúdo'} - ${new Date().toLocaleDateString("pt-BR")}`,
            content: planningOutputNode.isImage ? '' : planningOutputNode.content,
            client_id: clientId,
            workspace_id: '',
            created_by: '',
            created_at: '',
            updated_at: '',
            status: 'draft',
            priority: 'medium',
            platform: planningOutputNode.platform as any,
            content_type: FORMAT_TO_CONTENT_TYPE[planningOutputNode.format] || 'post',
            media_urls: planningOutputNode.isImage ? [planningOutputNode.content] : [],
            metadata: {
              content_type: FORMAT_TO_CONTENT_TYPE[planningOutputNode.format] || 'post',
              from_canvas: true,
            },
          } as any}
          onSave={handlePlanningDialogSave}
          onUpdate={async () => {}}
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
