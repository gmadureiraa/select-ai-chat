import { useCallback, useEffect } from "react";
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

interface ResearchCanvasProps {
  projectId: string;
}

const nodeTypes = {
  researchItem: ResearchItemNode,
};

export const ResearchCanvas = ({ projectId }: ResearchCanvasProps) => {
  const { items, deleteItem, updateItem } = useResearchItems(projectId);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Update nodes when items change
  useEffect(() => {
    const newNodes: Node[] = items.map((item) => ({
      id: item.id,
      type: "researchItem",
      position: { x: item.position_x || Math.random() * 500, y: item.position_y || Math.random() * 500 },
      data: { item, onDelete: deleteItem.mutate },
    }));
    setNodes(newNodes);
  }, [items, deleteItem.mutate, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
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

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">Nenhum material adicionado ainda</p>
          <p className="text-sm">Clique em "Adicionar Material" para começar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
      </ReactFlow>
    </div>
  );
};
