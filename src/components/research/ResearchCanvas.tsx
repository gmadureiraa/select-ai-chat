import { useCallback, useEffect, useState } from "react";
import { AddItemDialog } from "./AddItemDialog";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MiniMap,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { useResearchItems } from "@/hooks/useResearchItems";
import { ResearchItemNode } from "./ResearchItemNode";
import { AIChatNode } from "./AIChatNode";
import { Sparkles } from "lucide-react";

interface ResearchCanvasProps {
  projectId: string;
}

const nodeTypes = {
  researchItem: ResearchItemNode,
  aiChat: AIChatNode,
};

export const ResearchCanvas = ({ projectId }: ResearchCanvasProps) => {
  const { items, deleteItem, updateItem, connections, createConnection, deleteConnection } = useResearchItems(projectId);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Update nodes when items change
  useEffect(() => {
    if (!items) return;

    const newNodes: Node[] = items.map((item) => {
      // Para AI Chat nodes, calcular items conectados
      let connectedItems: any[] = [];
      if (item.type === "ai_chat" && connections) {
        const connectedIds = connections
          .filter(c => c.source_id === item.id || c.target_id === item.id)
          .map(c => c.source_id === item.id ? c.target_id : c.source_id);
        
        connectedItems = items.filter(i => connectedIds.includes(i.id));
      }

      return {
        id: item.id,
        type: item.type === "ai_chat" ? "aiChat" : "researchItem",
        position: { x: item.position_x || 0, y: item.position_y || 0 },
        data: {
          item,
          onDelete: deleteItem.mutate,
          projectId,
          connectedItems,
        },
      };
    });

    setNodes(newNodes);
  }, [items, connections, deleteItem.mutate, setNodes, projectId]);

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
      // Save position to database
      updateItem.mutate({
        id: node.id,
        position_x: node.position.x,
        position_y: node.position.y,
      });
    },
    [updateItem]
  );

  return (
    <div className="h-full w-full bg-white relative">
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
        className="bg-white"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e5e5" />
        <Controls className="bg-white border border-gray-200 rounded-lg" />
        <MiniMap
          className="bg-white border border-gray-200 rounded-lg"
          nodeColor="#f3f4f6"
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        <Panel position="top-right" className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">
          Arraste os cards • Conecte clicando e arrastando das bordas
        </Panel>
        <Panel position="bottom-right" className="mr-4 mb-4">
          <button
            onClick={() => setIsAddDialogOpen(true)}
            className="w-14 h-14 rounded-full bg-[#00ff9d] hover:bg-[#00cc7d] text-black shadow-lg flex items-center justify-center transition-all hover:scale-110"
          >
            <span className="text-3xl font-light">+</span>
          </button>
        </Panel>

        {(!items || items.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted-foreground max-w-md">
              <div className="mb-4 flex justify-center">
                <div className="p-4 bg-card/50 rounded-full border-2 border-dashed border-border">
                  <Sparkles className="h-12 w-12 text-muted-foreground/50" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">Laboratório de Pesquisa</h3>
              <p className="text-sm mb-4">
                Comece adicionando um <strong>Chat IA</strong> ou <strong>materiais de pesquisa</strong>
              </p>
              <div className="text-xs text-muted-foreground/70 space-y-1">
                <p>• Adicione notas, links, imagens, vídeos ou PDFs</p>
                <p>• Conecte materiais relacionados</p>
                <p>• Chat IA analisa apenas items conectados a ele</p>
              </div>
            </div>
          </div>
        )}
      </ReactFlow>

      <AddItemDialog 
        projectId={projectId} 
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
    </div>
  );
};