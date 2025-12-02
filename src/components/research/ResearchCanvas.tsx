import { useCallback, useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Connection,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { useResearchItems } from "@/hooks/useResearchItems";
import { ResearchItemNode } from "./ResearchItemNode";
import { AIChatNode } from "./AIChatNode";
import { ContentLibraryNode } from "./ContentLibraryNode";
import { ReferenceLibraryNode } from "./ReferenceLibraryNode";
import { TextNode } from "./TextNode";
import { NoteNode } from "./NoteNode";
import { AudioNode } from "./AudioNode";
import ImageNode from "./ImageNode";
import { PDFNode } from "./PDFNode";
import { EmbedNode } from "./EmbedNode";
import { SpreadsheetNode } from "./SpreadsheetNode";
import { ComparisonNode } from "./ComparisonNode";
import { GroupNode } from "./GroupNode";
import { CanvasToolbar } from "./CanvasToolbar";
import { ZoomControls } from "./ZoomControls";
import { SearchFilterPanel, FilterState } from "./SearchFilterPanel";
import { ExportPanel } from "./ExportPanel";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { QuickCapture } from "./QuickCapture";
import { SmoothEdge } from "./SmoothEdge";
import { FloatingAIChat } from "./FloatingAIChat";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ResearchCanvasProps {
  projectId: string;
  clientId?: string;
  projectName?: string;
  onPresentationMode?: () => void;
  background?: "dark" | "light";
}

export interface ResearchCanvasRef {
  applyTemplate: (templateItems: Array<{ type: string; title: string; content?: string; position_x: number; position_y: number }>) => Promise<void>;
}

const nodeTypes = {
  researchItem: ResearchItemNode,
  aiChat: AIChatNode,
  contentLibrary: ContentLibraryNode,
  referenceLibrary: ReferenceLibraryNode,
  text: TextNode,
  note: NoteNode,
  audio: AudioNode,
  image: ImageNode,
  pdf: PDFNode,
  embed: EmbedNode,
  spreadsheet: SpreadsheetNode,
  comparison: ComparisonNode,
  group: GroupNode,
};

const edgeTypes = {
  smooth: SmoothEdge,
};

// Node colors for minimap
const nodeColors: Record<string, string> = {
  aiChat: "#a855f7",
  comparison: "#f59e0b",
  note: "#eab308",
  text: "#3b82f6",
  youtube: "#ef4444",
  link: "#22c55e",
  audio: "#ec4899",
  image: "#f97316",
  pdf: "#f43f5e",
  embed: "#10b981",
  spreadsheet: "#14b8a6",
  contentLibrary: "#06b6d4",
  referenceLibrary: "#6366f1",
  researchItem: "#9ca3af",
  group: "#64748b",
};

interface ResearchCanvasInnerProps extends ResearchCanvasProps {
  innerRef?: React.Ref<ResearchCanvasRef>;
}

const ResearchCanvasInner = ({ projectId, clientId, projectName = "Projeto", innerRef, background = "dark" }: ResearchCanvasInnerProps) => {
  const { items, deleteItem, updateItem, connections, createConnection, deleteConnection, createItem } = useResearchItems(projectId);
  const { toast } = useToast();
  const { getNodes, deleteElements } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Expose applyTemplate method via ref
  useImperativeHandle(innerRef, () => ({
    applyTemplate: async (templateItems) => {
      try {
        toast({ title: "Aplicando template...", description: "Adicionando itens ao canvas." });
        
        for (const item of templateItems) {
          await createItem.mutateAsync({
            project_id: projectId,
            type: item.type as any,
            title: item.title,
            content: item.content || "",
            position_x: item.position_x,
            position_y: item.position_y,
          });
        }
        
        toast({ title: "Template aplicado", description: `${templateItems.length} itens adicionados ao canvas.` });
      } catch (error: any) {
        toast({
          title: "Erro ao aplicar template",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  }), [projectId, createItem, toast]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [activeTool, setActiveTool] = useState<string | null>("select");
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  
  // Dialog states for URL inputs
  const [urlDialog, setUrlDialog] = useState<{ type: "youtube" | "link" | "image" | null; open: boolean }>({ type: null, open: false });
  const [urlInput, setUrlInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({ types: [], tags: [], processed: "all" });
  
  // Floating AI Chat state
  const [showFloatingChat, setShowFloatingChat] = useState(false);
  const [floatingChatItems, setFloatingChatItems] = useState<Array<{ id: string; title: string; content: string; type: string }>>([]);

  // Track connected nodes for AI chat highlighting
  const [connectedToSelected, setConnectedToSelected] = useState<Set<string>>(new Set());

  // Update connected nodes when selection changes
  useEffect(() => {
    const connected = new Set<string>();
    selectedNodeIds.forEach(nodeId => {
      const nodeConnections = connections.filter(c => c.source_id === nodeId || c.target_id === nodeId);
      nodeConnections.forEach(c => {
        connected.add(c.source_id);
        connected.add(c.target_id);
      });
    });
    setConnectedToSelected(connected);
  }, [selectedNodeIds, connections]);

  // Update nodes when items change - with filtering
  useEffect(() => {
    if (!items) return;

    // Apply filters
    let filteredItems = items;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredItems = filteredItems.filter(item => 
        item.title?.toLowerCase().includes(query) ||
        item.content?.toLowerCase().includes(query) ||
        item.source_url?.toLowerCase().includes(query)
      );
    }
    
    // Type filter
    if (filters.types.length > 0) {
      filteredItems = filteredItems.filter(item => filters.types.includes(item.type));
    }

    const newNodes: Node[] = filteredItems.map((item) => {
      let connectedItems: any[] = [];
      if ((item.type === "ai_chat" || item.type === "comparison") && connections) {
        const connectedIds = connections
          .filter(c => c.source_id === item.id || c.target_id === item.id)
          .map(c => c.source_id === item.id ? c.target_id : c.source_id);
        
        connectedItems = items.filter(i => connectedIds.includes(i.id));
      }

      const typeToNodeType: Record<string, string> = {
        ai_chat: "aiChat",
        content_library: "contentLibrary",
        reference_library: "referenceLibrary",
        text: "text",
        note: "note",
        audio: "audio",
        image: "image",
        pdf: "pdf",
        embed: "embed",
        spreadsheet: "spreadsheet",
        comparison: "comparison",
        group: "group",
      };
      const nodeType = typeToNodeType[item.type] || "researchItem";

      return {
        id: item.id,
        type: nodeType,
        position: { x: item.position_x || 0, y: item.position_y || 0 },
        data: {
          item,
          onDelete: deleteItem.mutate,
          onUpdate: (id: string, updates: any) => updateItem.mutate({ id, ...updates }),
          projectId,
          clientId,
          connectedItems,
          isConnected: connectedToSelected.has(item.id) && !selectedNodeIds.has(item.id),
        },
      };
    });

    setNodes(newNodes);
  }, [items, connections, deleteItem.mutate, updateItem, setNodes, projectId, clientId, connectedToSelected, selectedNodeIds, searchQuery, filters]);

  // Update edges when connections change - with smooth bezier curves
  useEffect(() => {
    const newEdges: Edge[] = connections.map((conn) => {
      const isHighlighted = selectedNodeIds.has(conn.source_id) || selectedNodeIds.has(conn.target_id);
      
      return {
        id: conn.id,
        source: conn.source_id,
        target: conn.target_id,
        label: conn.label,
        type: "smooth",
        data: {
          label: conn.label,
          animated: isHighlighted,
        },
        style: { 
          stroke: isHighlighted ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.4)', 
          strokeWidth: isHighlighted ? 3 : 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
          color: isHighlighted ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.4)',
        },
      };
    });
    setEdges(newEdges);
  }, [connections, setEdges, selectedNodeIds]);

  // Handle node selection changes
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    setSelectedNodeIds(new Set(selectedNodes.map(n => n.id)));
  }, []);

  // Handle keyboard delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const selectedNodes = getNodes().filter(n => n.selected);
        if (selectedNodes.length > 0) {
          e.preventDefault();
          selectedNodes.forEach(node => {
            deleteItem.mutate(node.id);
          });
          toast({ title: `${selectedNodes.length} item(ns) excluído(s)` });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteItem, getNodes, toast]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        createConnection.mutate({
          source_id: params.source,
          target_id: params.target,
        });
      }
    },
    [createConnection]
  );

  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      edgesToDelete.forEach((edge) => {
        deleteConnection.mutate(edge.id);
      });
    },
    [deleteConnection]
  );

  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      updateItem.mutate({
        id: node.id,
        position_x: node.position.x,
        position_y: node.position.y,
      });
    },
    [updateItem]
  );

  const handleAddItem = async (type: string) => {
    // Items that need URL input
    if (type === "youtube" || type === "link") {
      setUrlDialog({ type: type as "youtube" | "link", open: true });
      return;
    }

    // Direct creation items
    try {
      const basePosition = {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100,
      };

      switch (type) {
        case "ai_chat":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "ai_chat",
            title: "Chat com IA",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Chat IA adicionado", description: "Atalho: C" });
          break;

        case "note":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "note",
            title: "Nova Nota",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Nota criada", description: "Atalho: N" });
          break;

        case "text":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "text",
            title: "Novo Texto",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Texto criado", description: "Atalho: T" });
          break;

        case "audio":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "audio",
            title: "Novo Áudio",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Áudio criado", description: "Atalho: A" });
          break;

        case "image":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "image",
            title: "Nova Imagem",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Imagem adicionada", description: "Atalho: I" });
          break;

        case "content_library":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "content_library",
            title: "Biblioteca de Conteúdo",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Biblioteca de Conteúdo adicionada", description: "Atalho: B" });
          break;

        case "reference_library":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "reference_library",
            title: "Biblioteca de Referências",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Biblioteca de Referências adicionada", description: "Atalho: R" });
          break;

        case "pdf":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "pdf",
            title: "Novo PDF",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "PDF adicionado", description: "Atalho: P" });
          break;

        case "embed":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "embed",
            title: "Embed de Rede Social",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Embed adicionado", description: "Atalho: E" });
          break;

        case "spreadsheet":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "spreadsheet",
            title: "Nova Planilha",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Planilha adicionada", description: "Atalho: S" });
          break;

        case "comparison":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "comparison",
            title: "Comparação",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Comparação adicionada", description: "Conecte itens para comparar. Atalho: K" });
          break;

        case "group":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "group",
            title: "Novo Grupo",
            position_x: basePosition.x,
            position_y: basePosition.y,
            metadata: { color: "purple" },
          });
          toast({ title: "Grupo criado", description: "Arraste itens para dentro. Atalho: G" });
          break;
      }
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar item",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handle Quick Capture
  const handleQuickCapture = async (type: string, content?: string) => {
    const basePosition = {
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
    };

    if (type === "youtube" && content) {
      setUrlInput(content);
      setUrlDialog({ type: "youtube", open: true });
      return;
    }

    if (type === "link" && content) {
      setUrlInput(content);
      setUrlDialog({ type: "link", open: true });
      return;
    }

    try {
      if (type === "note" && content) {
        await createItem.mutateAsync({
          project_id: projectId,
          type: "note",
          title: "Nota Rápida",
          content: content,
          position_x: basePosition.x,
          position_y: basePosition.y,
        });
        toast({ title: "Nota adicionada" });
      } else if (type === "text" && content) {
        await createItem.mutateAsync({
          project_id: projectId,
          type: "text",
          title: "Texto",
          content: content,
          position_x: basePosition.x,
          position_y: basePosition.y,
        });
        toast({ title: "Texto adicionado" });
      } else if (type === "ai_chat") {
        // Toggle floating AI chat
        setShowFloatingChat(true);
        // Get selected items for context
        const selectedItems = items?.filter(item => selectedNodeIds.has(item.id)) || [];
        setFloatingChatItems(selectedItems.map(item => ({
          id: item.id,
          title: item.title || "Sem título",
          content: item.content || "",
          type: item.type,
        })));
      } else {
        handleAddItem(type);
      }
    } catch (error: any) {
      toast({
        title: "Erro na captura",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim() || !urlDialog.type) return;

    setIsProcessing(true);
    try {
      const basePosition = {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100,
      };

      if (urlDialog.type === "youtube") {
        toast({ title: "Extraindo transcrição...", description: "Isso pode levar alguns segundos." });
        
        const { data, error } = await supabase.functions.invoke("extract-youtube", {
          body: { url: urlInput },
        });
        if (error) throw error;
        
        await createItem.mutateAsync({
          project_id: projectId,
          type: "youtube",
          title: data.title,
          content: data.content,
          source_url: urlInput,
          thumbnail_url: data.thumbnail,
          metadata: data.metadata,
          processed: true,
          position_x: basePosition.x,
          position_y: basePosition.y,
        });
        toast({ title: "Vídeo adicionado", description: "Transcrição extraída com sucesso." });
      } else if (urlDialog.type === "link") {
        toast({ title: "Extraindo conteúdo...", description: "Isso pode levar alguns segundos." });
        
        const { data: linkData, error: linkError } = await supabase.functions.invoke("scrape-research-link", {
          body: { url: urlInput },
        });
        
        if (linkError) throw linkError;
        
        await createItem.mutateAsync({
          project_id: projectId,
          type: "link",
          title: linkData.data.title || urlInput,
          content: linkData.data.content,
          source_url: urlInput,
          thumbnail_url: linkData.data.thumbnail,
          metadata: {
            description: linkData.data.description,
            images: linkData.data.images,
            textLength: linkData.data.textLength,
            imagesTranscribed: linkData.data.imagesTranscribed
          },
          processed: true,
          position_x: basePosition.x,
          position_y: basePosition.y,
        });
        toast({ title: "Link extraído", description: "Texto e imagens foram processados." });
      }

      setUrlDialog({ type: null, open: false });
      setUrlInput("");
    } catch (error: any) {
      toast({
        title: "Erro ao processar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Get node color for minimap
  const getNodeColor = (node: Node) => {
    return nodeColors[node.type || "researchItem"] || "#9ca3af";
  };

  // Filtered items count
  const filteredCount = nodes.length;
  const totalCount = items?.length || 0;

  return (
    <div ref={canvasRef} className={`h-full w-full relative ${background === "light" ? "bg-white" : "bg-muted/30"}`}>
      {/* Search and Filter Panel */}
      <SearchFilterPanel
        onSearch={setSearchQuery}
        onFilterChange={setFilters}
        itemCount={totalCount}
        filteredCount={filteredCount}
      />

      {/* Export and Summary Panel */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <ExecutiveSummary
          items={items || []}
          connections={connections}
          projectName={projectName}
          clientId={clientId}
        />
        <ExportPanel
          items={items || []}
          connections={connections}
          projectName={projectName}
          canvasRef={canvasRef}
        />
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className={background === "light" ? "bg-white" : "bg-muted/30"}
        noPanClassName="no-pan"
        noWheelClassName="no-wheel"
        connectionRadius={100}
        snapToGrid={false}
        selectionOnDrag
        panOnScroll
        selectNodesOnDrag={false}
        defaultEdgeOptions={{
          type: 'smooth',
          style: { stroke: 'hsl(var(--muted-foreground) / 0.4)', strokeWidth: 2 },
          animated: false,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
          },
        }}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={2} 
          color={background === "light" ? "hsl(var(--muted-foreground) / 0.3)" : "hsl(var(--muted-foreground) / 0.2)"} 
        />
        
        <MiniMap
          className="!bg-card !border !border-border !rounded-lg !shadow-lg"
          nodeColor={getNodeColor}
          maskColor="hsl(var(--background) / 0.7)"
          style={{ width: 150, height: 100 }}
          pannable
          zoomable
        />

        {(!items || items.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center max-w-md">
              <div className="mb-4 flex justify-center">
                <div className="p-4 bg-card rounded-full border-2 border-dashed border-border">
                  <Sparkles className="h-12 w-12 text-muted-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">Laboratório de Pesquisa</h3>
              <p className="text-sm mb-4 text-muted-foreground">
                Use a barra de ferramentas abaixo para adicionar itens ao canvas
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Atalhos: <kbd className="px-1 py-0.5 bg-muted rounded">C</kbd> Chat IA, <kbd className="px-1 py-0.5 bg-muted rounded">N</kbd> Nota, <kbd className="px-1 py-0.5 bg-muted rounded">T</kbd> Texto</p>
                <p>• <kbd className="px-1 py-0.5 bg-muted rounded">Delete</kbd> para excluir itens selecionados</p>
                <p>• Conecte materiais ao Chat IA para análise</p>
              </div>
            </div>
          </div>
        )}
      </ReactFlow>

      {/* Quick Capture - Eden.so style */}
      <QuickCapture 
        onCapture={handleQuickCapture}
        isProcessing={isProcessing}
      />

      {/* Floating AI Chat */}
      {showFloatingChat && (
        <FloatingAIChat
          projectId={projectId}
          clientId={clientId}
          connectedItems={floatingChatItems}
          onClose={() => setShowFloatingChat(false)}
        />
      )}

      <CanvasToolbar
        onAddItem={handleAddItem} 
        activeTool={activeTool} 
        setActiveTool={setActiveTool} 
      />

      <ZoomControls />

      {/* URL Input Dialog */}
      <Dialog open={urlDialog.open} onOpenChange={(open) => {
        if (!open) {
          setUrlDialog({ type: null, open: false });
          setUrlInput("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {urlDialog.type === "youtube" ? "Adicionar Vídeo do YouTube" : "Adicionar Link"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>
                {urlDialog.type === "youtube" ? "URL do YouTube" : "URL do site ou artigo"}
              </Label>
              <Input
                placeholder={urlDialog.type === "youtube" ? "https://www.youtube.com/watch?v=..." : "https://..."}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                disabled={isProcessing}
                autoFocus
              />
              {urlDialog.type === "link" && (
                <p className="text-xs text-muted-foreground">
                  O conteúdo e as imagens serão extraídos automaticamente
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setUrlDialog({ type: null, open: false });
                  setUrlInput("");
                }}
                disabled={isProcessing}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleUrlSubmit} 
                disabled={!urlInput.trim() || isProcessing}
              >
                {isProcessing ? "Processando..." : "Adicionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const ResearchCanvas = forwardRef<ResearchCanvasRef, ResearchCanvasProps>((props, ref) => {
  return (
    <ReactFlowProvider>
      <ResearchCanvasInner {...props} innerRef={ref} />
    </ReactFlowProvider>
  );
});
