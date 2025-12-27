import { useCallback, useState, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  MarkerType,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { AutomationBuilderToolbar } from "./AutomationBuilderToolbar";
import { ImprovedNodeConfigPanel } from "./ImprovedNodeConfigPanel";
import { NodeExecutionPanel } from "./NodeExecutionPanel";
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
  trigger_rss: "RSS Feed Trigger",
  trigger_webhook: "Webhook Trigger",
  trigger_schedule: "Schedule Trigger",
  trigger_api: "API Request",
  ai_process: "AI Process",
  condition: "Condition",
  action_publish: "Publish",
  action_webhook: "Webhook",
  action_email: "Send Email",
  action_n8n: "n8n Workflow",
  note: "Note",
};

interface ImprovedAutomationBuilderCanvasProps {
  initialFlow?: AutomationFlow;
  onFlowChange?: (flow: AutomationFlow) => void;
  onBackToCanvas?: () => void;
}

export const ImprovedAutomationBuilderCanvas = ({
  initialFlow,
  onFlowChange,
  onBackToCanvas,
}: ImprovedAutomationBuilderCanvasProps) => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, any>>({});
  const [nodeErrors, setNodeErrors] = useState<Record<string, string>>({});

  const initialNodes: Node[] = useMemo(() => 
    initialFlow?.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: { x: node.position_x, y: node.position_y },
      data: {
        label: node.config.label || nodeLabels[node.type],
        config: node.config,
      },
    })) || [], [initialFlow]);

  const initialEdges: Edge[] = useMemo(() => 
    initialFlow?.connections.map((conn) => ({
      id: conn.id,
      source: conn.source_node_id,
      target: conn.target_node_id,
      sourceHandle: conn.connection_type === "condition_true" ? "true" : 
                    conn.connection_type === "condition_false" ? "false" : undefined,
      label: conn.label,
      style: { 
        stroke: "#666",
        strokeWidth: 2,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#666" },
      animated: false,
    })) || [], [initialFlow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            style: { stroke: "#666", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#666" },
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
      position: { x: 400, y: nodes.length * 150 + 100 },
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

  const handleExecuteNode = useCallback(async (nodeId: string) => {
    // Mock execution - in real implementation, this would call the backend
    setNodeErrors((prev) => ({ ...prev, [nodeId]: "" }));
    
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Simulate execution delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock output based on node type
    const mockOutputs: Record<string, any> = {
      trigger_rss: {
        title: "Sample RSS Item",
        link: "https://example.com/article",
        pubDate: new Date().toISOString(),
        content: "This is sample content from RSS feed",
        contentSnippet: "This is sample content...",
        enclosure: {
          url: "https://example.com/image.jpg",
          length: 12345,
          type: "image/jpeg",
        },
      },
      ai_process: {
        result: "AI processed content here",
        tokens: 150,
      },
      action_publish: {
        success: true,
        postId: "123456789",
        url: "https://twitter.com/user/status/123456789",
      },
    };

    setNodeOutputs((prev) => ({
      ...prev,
      [nodeId]: mockOutputs[node.type as string] || { result: "Executed successfully" },
    }));

    return mockOutputs[node.type as string];
  }, [nodes]);

  const getPreviousNodeLabel = useCallback((nodeId: string) => {
    const incomingEdge = edges.find((e) => e.target === nodeId);
    if (!incomingEdge) return undefined;
    
    const sourceNode = nodes.find((n) => n.id === incomingEdge.source);
    return sourceNode?.data.label;
  }, [edges, nodes]);

  const getPreviousNodeOutput = useCallback((nodeId: string) => {
    const incomingEdge = edges.find((e) => e.target === nodeId);
    if (!incomingEdge) return undefined;
    
    return nodeOutputs[incomingEdge.source];
  }, [edges, nodeOutputs]);

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

  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    setTimeout(() => onFlowChange?.(getCurrentFlow()), 0);
  }, [onNodesChange, onFlowChange, getCurrentFlow]);

  const handleEdgesChange = useCallback((changes: any) => {
    onEdgesChange(changes);
    setTimeout(() => onFlowChange?.(getCurrentFlow()), 0);
  }, [onEdgesChange, onFlowChange, getCurrentFlow]);

  return (
    <div className="relative h-full w-full flex">
      {/* Main Canvas Area */}
      <div className={`flex-1 relative ${selectedNode ? 'mr-[560px]' : ''}`}>
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
          className="bg-[#1a1a1a]"
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            style: { stroke: "#666", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#666" },
          }}
        >
          <Controls 
            className="!bg-card !border-border !rounded-lg !shadow-lg" 
            position="bottom-left"
          />
          <MiniMap 
            className="!bg-card !border-border !rounded-lg"
            nodeColor="#666"
            maskColor="rgba(0,0,0,0.8)"
            position="bottom-left"
            style={{ left: 80, bottom: 10 }}
          />
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={20} 
            size={1} 
            color="#333"
          />
          
          {/* Top Left Panel */}
          <Panel position="top-left" className="flex items-center gap-2">
            {onBackToCanvas && (
              <Button variant="ghost" size="sm" onClick={onBackToCanvas} className="gap-1 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Back to canvas
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          </Panel>
        </ReactFlow>

        <AutomationBuilderToolbar onAddNode={handleAddNode} />
      </div>

      {/* Side Panel when node is selected */}
      {selectedNode && (
        <div className="absolute top-0 right-0 h-full w-[560px] flex z-50">
          {/* Input Panel */}
          <div className="w-[280px] border-l border-border bg-card flex flex-col">
            <NodeExecutionPanel
              nodeId={selectedNode.id}
              nodeLabel={selectedNode.data.label}
              inputData={getPreviousNodeOutput(selectedNode.id)}
              outputData={nodeOutputs[selectedNode.id]}
              error={nodeErrors[selectedNode.id]}
              previousNodeLabel={getPreviousNodeLabel(selectedNode.id)}
              onExecute={() => handleExecuteNode(selectedNode.id)}
            />
          </div>

          {/* Config Panel */}
          <div className="w-[280px]">
            <ImprovedNodeConfigPanel
              nodeType={selectedNode.type as AutomationNodeType}
              nodeId={selectedNode.id}
              config={selectedNode.data.config || {}}
              onClose={() => setSelectedNode(null)}
              onUpdate={handleUpdateNodeConfig}
              onExecuteNode={handleExecuteNode}
              inputData={getPreviousNodeOutput(selectedNode.id)}
              outputData={nodeOutputs[selectedNode.id]}
              previousNodeLabel={getPreviousNodeLabel(selectedNode.id)}
              error={nodeErrors[selectedNode.id]}
            />
          </div>
        </div>
      )}
    </div>
  );
};
