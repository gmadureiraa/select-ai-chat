import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Connection,
  MiniMap,
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
import { CanvasToolbar } from "./CanvasToolbar";
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
};

export const ResearchCanvas = ({ projectId, clientId }: ResearchCanvasProps) => {
  const { items, deleteItem, updateItem, connections, createConnection, deleteConnection, createItem } = useResearchItems(projectId);
  const { toast } = useToast();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [activeTool, setActiveTool] = useState<string | null>("select");
  
  // Dialog states for URL inputs
  const [urlDialog, setUrlDialog] = useState<{ type: "youtube" | "link" | "image" | null; open: boolean }>({ type: null, open: false });
  const [urlInput, setUrlInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Update nodes when items change
  useEffect(() => {
    if (!items) return;

    const newNodes: Node[] = items.map((item) => {
      let connectedItems: any[] = [];
      if (item.type === "ai_chat" && connections) {
        const connectedIds = connections
          .filter(c => c.source_id === item.id || c.target_id === item.id)
          .map(c => c.source_id === item.id ? c.target_id : c.source_id);
        
        connectedItems = items.filter(i => connectedIds.includes(i.id));
      }

      let nodeType = "researchItem";
      if (item.type === "ai_chat") nodeType = "aiChat";
      else if (item.type === "content_library") nodeType = "contentLibrary";
      else if (item.type === "reference_library") nodeType = "referenceLibrary";
      else if (item.type === "text") nodeType = "text";
      else if (item.type === "note") nodeType = "note";
      else if (item.type === "audio") nodeType = "audio";
      else if (item.type === "image") nodeType = "image";

      return {
        id: item.id,
        type: nodeType,
        position: { x: item.position_x || 0, y: item.position_y || 0 },
        data: {
          item,
          onDelete: deleteItem.mutate,
          projectId,
          clientId,
          connectedItems,
        },
      };
    });

    setNodes(newNodes);
  }, [items, connections, deleteItem.mutate, setNodes, projectId, clientId]);

  // Update edges when connections change
  useEffect(() => {
    const newEdges: Edge[] = connections.map((conn) => ({
      id: conn.id,
      source: conn.source_id,
      target: conn.target_id,
      label: conn.label,
      type: "default",
      style: { stroke: "#8b5cf6", strokeWidth: 2 },
      animated: true,
    }));
    setEdges(newEdges);
  }, [connections, setEdges]);

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
          toast({ title: "Chat IA adicionado" });
          break;

        case "note":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "note",
            title: "Nova Nota",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Nota criada" });
          break;

        case "text":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "text",
            title: "Novo Texto",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Texto criado" });
          break;

        case "audio":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "audio",
            title: "Novo Áudio",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Áudio criado" });
          break;

        case "image":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "image",
            title: "Nova Imagem",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Imagem adicionada" });
          break;

        case "content_library":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "content_library",
            title: "Biblioteca de Conteúdo",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Biblioteca de Conteúdo adicionada" });
          break;

        case "reference_library":
          await createItem.mutateAsync({
            project_id: projectId,
            type: "reference_library",
            title: "Biblioteca de Referências",
            position_x: basePosition.x,
            position_y: basePosition.y,
          });
          toast({ title: "Biblioteca de Referências adicionada" });
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

  return (
    <div className="h-full w-full bg-[#fafafa] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        className="bg-[#fafafa]"
        noPanClassName="no-pan"
        noWheelClassName="no-wheel"
        connectionRadius={100}
        snapToGrid={false}
        defaultEdgeOptions={{
          type: 'default',
          style: { stroke: '#8b5cf6', strokeWidth: 2 },
          animated: true,
        }}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={2} 
          color="#d4d4d4" 
        />
        <Controls className="bg-card border border-border rounded-lg shadow-sm" />
        <MiniMap
          className="bg-card border border-border rounded-lg shadow-sm"
          nodeColor="#e5e5e5"
          maskColor="rgba(0, 0, 0, 0.08)"
        />

        {(!items || items.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center max-w-md">
              <div className="mb-4 flex justify-center">
                <div className="p-4 bg-white rounded-full border-2 border-dashed border-gray-300">
                  <Sparkles className="h-12 w-12 text-gray-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-700">Laboratório de Pesquisa</h3>
              <p className="text-sm mb-4 text-gray-500">
                Use a barra de ferramentas abaixo para adicionar itens ao canvas
              </p>
              <div className="text-xs text-gray-400 space-y-1">
                <p>• Adicione notas, links, imagens, vídeos ou PDFs</p>
                <p>• Conecte materiais relacionados</p>
                <p>• Chat IA analisa apenas items conectados a ele</p>
              </div>
            </div>
          </div>
        )}
      </ReactFlow>

      <CanvasToolbar 
        onAddItem={handleAddItem} 
        activeTool={activeTool} 
        setActiveTool={setActiveTool} 
      />

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
