import { useCallback, useState } from "react";
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

import { AutomationBuilderToolbar } from "./AutomationBuilderToolbar";
import { AutomationNodeConfigPanel } from "./AutomationNodeConfigPanel";
import { RSSNode } from "./nodes/RSSNode";
import { AIProcessNode } from "./nodes/AIProcessNode";
import { PublishNode } from "./nodes/PublishNode";
import { WebhookNode } from "./nodes/WebhookNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { N8nNode } from "./nodes/N8nNode";
import { ScheduleNode } from "./nodes/ScheduleNode";
import { EmailNode } from "./nodes/EmailNode";
import { APINode } from "./nodes/APINode";
import { NoteNode } from "./nodes/NoteNode";
import type { AutomationNodeType, AutomationNodeConfig, AutomationFlow } from "@/types/automationBuilder";

const nodeTypes: NodeTypes = {
  trigger_rss: RSSNode,
  trigger_webhook: (props: any) => <WebhookNode {...props} data={{ ...props.data, isTrigger: true }} />,
  trigger_schedule: ScheduleNode,
  trigger_api: APINode,
  ai_process: AIProcessNode,
  condition: ConditionNode,
  action_publish: PublishNode,
  action_webhook: WebhookNode,
  action_email: EmailNode,
  action_n8n: N8nNode,
  note: NoteNode,
};

const nodeLabels: Record<AutomationNodeType, string> = {
  trigger_rss: "RSS Feed",
  trigger_webhook: "Webhook Trigger",
  trigger_schedule: "Agendamento",
  trigger_api: "API Request",
  ai_process: "Processar com IA",
  condition: "Condição",
  action_publish: "Publicar",
  action_webhook: "Chamar Webhook",
  action_email: "Enviar Email",
  action_n8n: "n8n Workflow",
  note: "Nota",
};

interface AutomationBuilderCanvasProps {
  initialFlow?: AutomationFlow;
  onFlowChange?: (flow: AutomationFlow) => void;
}

export const AutomationBuilderCanvas = ({
  initialFlow,
  onFlowChange,
}: AutomationBuilderCanvasProps) => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Convert initial flow to ReactFlow format
  const initialNodes: Node[] = initialFlow?.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: node.position_x, y: node.position_y },
    data: {
      label: node.config.label || nodeLabels[node.type],
      config: node.config,
    },
  })) || [];

  const initialEdges: Edge[] = initialFlow?.connections.map((conn) => ({
    id: conn.id,
    source: conn.source_node_id,
    target: conn.target_node_id,
    sourceHandle: conn.connection_type === "condition_true" ? "true" : 
                  conn.connection_type === "condition_false" ? "false" : undefined,
    label: conn.label,
    style: { 
      strokeDasharray: "6 4", 
      stroke: "#888",
      strokeWidth: 1.5,
    },
    markerEnd: { type: MarkerType.ArrowClosed },
  })) || [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
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

  const handleAddNode = useCallback((type: AutomationNodeType) => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      position: { x: 250, y: nodes.length * 120 + 50 },
      data: {
        label: nodeLabels[type],
        config: {},
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nodes, setNodes]);

  const handleNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleUpdateNodeConfig = useCallback((config: AutomationNodeConfig) => {
    if (!selectedNode) return;
    
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? {
              ...n,
              data: {
                ...n.data,
                config,
                label: config.label || n.data.label,
              },
            }
          : n
      )
    );
  }, [selectedNode, setNodes]);

  // Convert back to AutomationFlow format
  const getCurrentFlow = useCallback((): AutomationFlow => {
    return {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type as AutomationNodeType,
        config: node.data.config || {},
        position_x: node.position.x,
        position_y: node.position.y,
      })),
      connections: edges.map((edge) => ({
        id: edge.id,
        source_node_id: edge.source,
        target_node_id: edge.target,
        connection_type: edge.sourceHandle === "true" ? "condition_true" as const :
                        edge.sourceHandle === "false" ? "condition_false" as const : 
                        "default" as const,
        label: edge.label as string | undefined,
      })),
    };
  }, [nodes, edges]);

  // Notify parent of changes
  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    setTimeout(() => onFlowChange?.(getCurrentFlow()), 0);
  }, [onNodesChange, onFlowChange, getCurrentFlow]);

  const handleEdgesChange = useCallback((changes: any) => {
    onEdgesChange(changes);
    setTimeout(() => onFlowChange?.(getCurrentFlow()), 0);
  }, [onEdgesChange, onFlowChange, getCurrentFlow]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
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

      <AutomationBuilderToolbar onAddNode={handleAddNode} />

      {selectedNode && (
        <div className="absolute top-0 right-0 h-full z-50">
          <AutomationNodeConfigPanel
            nodeType={selectedNode.type as AutomationNodeType}
            config={selectedNode.data.config || {}}
            onClose={() => setSelectedNode(null)}
            onUpdate={handleUpdateNodeConfig}
          />
        </div>
      )}
    </div>
  );
};
