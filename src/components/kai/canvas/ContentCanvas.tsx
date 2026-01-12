import { useCallback, useRef, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";

import { useCanvasState, NodeDataType } from "./hooks/useCanvasState";
import { CanvasToolbar } from "./CanvasToolbar";
import { SourceNode } from "./nodes/SourceNode";
import { LibraryRefNode } from "./nodes/LibraryRefNode";
import { PromptNode } from "./nodes/PromptNode";
import { GeneratorNode } from "./nodes/GeneratorNode";
import { ContentOutputNode } from "./nodes/ContentOutputNode";

interface ContentCanvasProps {
  clientId: string;
}

function ContentCanvasInner({ clientId }: ContentCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { zoomIn, zoomOut, fitView, getViewport } = useReactFlow();

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
    generateContent,
    sendToPlanning,
    clearCanvas,
  } = useCanvasState(clientId);

  const nodeTypes = useMemo(() => ({
    source: (props: any) => (
      <SourceNode
        {...props}
        onExtractUrl={extractUrlContent}
        onUpdateData={updateNodeData}
        onDelete={deleteNode}
      />
    ),
    library: (props: any) => (
      <LibraryRefNode
        {...props}
        clientId={clientId}
        onUpdateData={updateNodeData}
        onDelete={deleteNode}
      />
    ),
    prompt: (props: any) => (
      <PromptNode
        {...props}
        onUpdateData={updateNodeData}
        onDelete={deleteNode}
      />
    ),
    generator: (props: any) => (
      <GeneratorNode
        {...props}
        onUpdateData={updateNodeData}
        onDelete={deleteNode}
        onGenerate={generateContent}
      />
    ),
    output: (props: any) => (
      <ContentOutputNode
        {...props}
        onUpdateData={updateNodeData}
        onDelete={deleteNode}
        onSendToPlanning={sendToPlanning}
      />
    ),
  }), [clientId, extractUrlContent, updateNodeData, deleteNode, generateContent, sendToPlanning]);

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
    <div ref={reactFlowWrapper} className="w-full h-full">
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
        className="bg-muted/30"
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
      />

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-3 max-w-md px-4">
            <div className="text-6xl">🎨</div>
            <h3 className="text-lg font-medium">Canvas de Criação</h3>
            <p className="text-sm text-muted-foreground">
              Arraste fontes, conecte a geradores e crie conteúdos visualmente.
              <br />
              Clique nos botões acima para começar.
            </p>
            <div className="flex justify-center gap-4 text-xs text-muted-foreground pt-2">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-blue-500" />
                <span>Fonte</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-yellow-500" />
                <span>Briefing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-green-500" />
                <span>Gerador</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-pink-500" />
                <span>Resultado</span>
              </div>
            </div>
          </div>
        </div>
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
