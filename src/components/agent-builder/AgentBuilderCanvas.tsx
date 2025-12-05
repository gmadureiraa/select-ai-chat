import { useCallback, useState, useMemo } from "react";
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
  NodeTypes,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

import { TriggerNode } from "./nodes/TriggerNode";
import { AgentNode } from "./nodes/AgentNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { ToolNode } from "./nodes/ToolNode";
import { NoteNode } from "./nodes/NoteNode";
import { AgentBuilderToolbar } from "./AgentBuilderToolbar";
import { AgentConfigPanel } from "./AgentConfigPanel";
import { useAIAgents } from "@/hooks/useAIAgents";
import type { NodeType, AIWorkflowNode, WorkflowNodeData } from "@/types/agentBuilder";

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  agent: AgentNode,
  condition: ConditionNode,
  tool: ToolNode,
  note: NoteNode,
};

interface AgentBuilderCanvasProps {
  workflowId: string;
  initialNodes?: AIWorkflowNode[];
  initialConnections?: any[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
}

export const AgentBuilderCanvas = ({
  workflowId,
  initialNodes = [],
  initialConnections = [],
  onNodesChange,
  onEdgesChange,
}: AgentBuilderCanvasProps) => {
  const { agents, createAgent, updateAgent } = useAIAgents();
  const [activeTool, setActiveTool] = useState<NodeType | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node<WorkflowNodeData> | null>(null);

  // Convert DB nodes to React Flow nodes
  const flowNodes = useMemo(() => 
    initialNodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: { x: node.position_x, y: node.position_y },
      data: {
        label: (node.config as any)?.label || node.type,
        type: node.type,
        agent: agents.find(a => a.id === node.agent_id),
        config: node.config,
      } as WorkflowNodeData,
    })),
    [initialNodes, agents]
  );

  // Convert DB connections to React Flow edges
  const flowEdges = useMemo(() =>
    initialConnections.map((conn) => ({
      id: conn.id,
      source: conn.source_node_id,
      target: conn.target_node_id,
      sourceHandle: conn.connection_type === "condition_true" ? "true" : 
                   conn.connection_type === "condition_false" ? "false" : undefined,
      label: conn.connection_type === "ai_connection" ? "AI connection" : conn.label,
      style: { 
        strokeDasharray: "6 4", 
        stroke: "#888",
        strokeWidth: 1.5,
      },
      markerEnd: { type: MarkerType.ArrowClosed },
    })),
    [initialConnections]
  );

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(flowEdges);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            label: "AI connection",
            style: { 
              strokeDasharray: "6 4", 
              stroke: "#888",
              strokeWidth: 1.5,
            },
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const handleAddNode = useCallback((type: NodeType, config?: Record<string, any>) => {
    const newNode: Node<WorkflowNodeData> = {
      id: `temp-${Date.now()}`,
      type,
      position: { x: 250, y: nodes.length * 150 + 50 },
      data: {
        label: type === "trigger" ? "Trigger" :
               type === "agent" ? "Novo Agente" :
               type === "condition" ? "Condição" :
               type === "tool" ? (config?.toolType === "n8n" ? "n8n Workflow" : "Ferramenta") : "Nota",
        type,
        config: type === "trigger" 
          ? { trigger_type: "manual" } 
          : type === "tool" 
            ? { toolType: config?.toolType || "webhook", ...config }
            : {},
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setActiveTool(null);
  }, [nodes, setNodes]);

  const handleNodeClick = useCallback((_: any, node: Node<WorkflowNodeData>) => {
    setSelectedNode(node);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleUpdateNode = useCallback((updates: Partial<AIWorkflowNode>) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? {
              ...n,
              data: {
                ...n.data,
                ...updates,
                config: updates.config ? { ...n.data.config, ...updates.config } : n.data.config,
              },
            }
          : n
      )
    );
  }, [selectedNode, setNodes]);

  const selectedAgent = selectedNode?.data?.agent || 
    (selectedNode?.data?.type === "agent" ? agents.find(a => a.id === (selectedNode.data as any).agent_id) : null);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeInternal}
        onEdgesChange={onEdgesChangeInternal}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-background"
        proOptions={{ hideAttribution: true }}
      >
        <Controls className="!bg-card !border-border !rounded-lg !shadow-lg" />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-background" />
      </ReactFlow>

      <AgentBuilderToolbar onAddNode={handleAddNode} activeTool={activeTool} />

      {selectedNode && (
        <div className="absolute top-0 right-0 h-full z-50">
          <AgentConfigPanel
            node={{
              id: selectedNode.id,
              workflow_id: workflowId,
              type: selectedNode.data.type,
              agent_id: (selectedNode.data as any).agent_id,
              config: selectedNode.data.config,
              position_x: selectedNode.position.x,
              position_y: selectedNode.position.y,
              created_at: new Date().toISOString(),
            }}
            agent={selectedAgent}
            agents={agents}
            onClose={() => setSelectedNode(null)}
            onUpdateNode={handleUpdateNode}
            onUpdateAgent={(updates) => updateAgent.mutate(updates as any)}
            onCreateAgent={(agent) => createAgent.mutate(agent)}
          />
        </div>
      )}
    </div>
  );
};
