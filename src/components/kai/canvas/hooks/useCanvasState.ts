import { useState, useCallback } from "react";
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from "reactflow";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlanningItems } from "@/hooks/usePlanningItems";

export type NodeDataType = 
  | "source" 
  | "library" 
  | "prompt" 
  | "generator" 
  | "output";

export interface SourceNodeData {
  type: "source";
  sourceType: "url" | "text" | "file";
  value: string;
  extractedContent?: string;
  isExtracting?: boolean;
  title?: string;
}

export interface LibraryNodeData {
  type: "library";
  itemId?: string;
  itemTitle?: string;
  itemContent?: string;
  itemType?: string;
}

export interface PromptNodeData {
  type: "prompt";
  briefing: string;
}

export type ContentFormat = 
  | "carousel" 
  | "thread" 
  | "reel_script" 
  | "post" 
  | "stories" 
  | "newsletter";

export type Platform = "instagram" | "linkedin" | "twitter" | "youtube" | "tiktok";

export interface GeneratorNodeData {
  type: "generator";
  format: ContentFormat;
  platform: Platform;
  isGenerating: boolean;
  progress?: number;
  currentStep?: string;
}

export interface OutputNodeData {
  type: "output";
  content: string;
  format: ContentFormat;
  platform: Platform;
  isEditing: boolean;
  addedToPlanning: boolean;
}

export type CanvasNodeData = 
  | SourceNodeData 
  | LibraryNodeData 
  | PromptNodeData 
  | GeneratorNodeData 
  | OutputNodeData;

const defaultNodes: Node<CanvasNodeData>[] = [];
const defaultEdges: Edge[] = [];

export function useCanvasState(clientId: string) {
  const { toast } = useToast();
  const [nodes, setNodes] = useState<Node<CanvasNodeData>[]>(defaultNodes);
  const [edges, setEdges] = useState<Edge[]>(defaultEdges);
  const { columns, createItem } = usePlanningItems({ clientId });

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds) as Node<CanvasNodeData>[]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
  }, []);

  const addNode = useCallback((
    nodeType: NodeDataType,
    position: { x: number; y: number },
    data?: Partial<CanvasNodeData>
  ) => {
    const id = `${nodeType}-${Date.now()}`;
    
    let nodeData: CanvasNodeData;
    
    switch (nodeType) {
      case "source":
        nodeData = {
          type: "source",
          sourceType: "url",
          value: "",
          ...data
        } as SourceNodeData;
        break;
      case "library":
        nodeData = {
          type: "library",
          ...data
        } as LibraryNodeData;
        break;
      case "prompt":
        nodeData = {
          type: "prompt",
          briefing: "",
          ...data
        } as PromptNodeData;
        break;
      case "generator":
        nodeData = {
          type: "generator",
          format: "carousel",
          platform: "instagram",
          isGenerating: false,
          ...data
        } as GeneratorNodeData;
        break;
      case "output":
        nodeData = {
          type: "output",
          content: "",
          format: "carousel",
          platform: "instagram",
          isEditing: false,
          addedToPlanning: false,
          ...data
        } as OutputNodeData;
        break;
      default:
        throw new Error(`Unknown node type: ${nodeType}`);
    }

    const newNode: Node<CanvasNodeData> = {
      id,
      type: nodeType,
      position,
      data: nodeData,
    };

    setNodes((nds) => [...nds, newNode]);
    return id;
  }, []);

  const updateNodeData = useCallback((nodeId: string, updates: Partial<CanvasNodeData>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...updates } as CanvasNodeData }
          : node
      )
    );
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, []);

  const getConnectedInputs = useCallback((generatorNodeId: string) => {
    const inputEdges = edges.filter((e) => e.target === generatorNodeId);
    const inputNodes = inputEdges
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter(Boolean) as Node<CanvasNodeData>[];
    return inputNodes;
  }, [edges, nodes]);

  const extractUrlContent = useCallback(async (nodeId: string, url: string) => {
    updateNodeData(nodeId, { isExtracting: true } as Partial<SourceNodeData>);

    try {
      const { data, error } = await supabase.functions.invoke("fetch-url-content", {
        body: { url }
      });

      if (error) throw error;

      updateNodeData(nodeId, {
        extractedContent: data.content || data.transcript,
        title: data.title,
        isExtracting: false
      } as Partial<SourceNodeData>);

      toast({
        title: "Conteúdo extraído",
        description: `"${data.title || url}" foi processado com sucesso`,
      });
    } catch (error) {
      console.error("Error extracting URL:", error);
      updateNodeData(nodeId, { isExtracting: false } as Partial<SourceNodeData>);
      toast({
        title: "Erro na extração",
        description: "Não foi possível extrair o conteúdo da URL",
        variant: "destructive",
      });
    }
  }, [updateNodeData, toast]);

  const generateContent = useCallback(async (generatorNodeId: string) => {
    const generatorNode = nodes.find((n) => n.id === generatorNodeId);
    if (!generatorNode || generatorNode.data.type !== "generator") return;

    const genData = generatorNode.data as GeneratorNodeData;
    const inputNodes = getConnectedInputs(generatorNodeId);

    if (inputNodes.length === 0) {
      toast({
        title: "Conexões necessárias",
        description: "Conecte pelo menos uma fonte ao gerador",
        variant: "destructive",
      });
      return;
    }

    // Build context from connected inputs
    let combinedContext = "";
    let briefing = "";

    for (const inputNode of inputNodes) {
      switch (inputNode.data.type) {
        case "source": {
          const sourceData = inputNode.data as SourceNodeData;
          if (sourceData.extractedContent) {
            combinedContext += `\n\n### Conteúdo Extraído:\n${sourceData.extractedContent}`;
          } else if (sourceData.value && sourceData.sourceType === "text") {
            combinedContext += `\n\n### Texto:\n${sourceData.value}`;
          }
          break;
        }
        case "library": {
          const libData = inputNode.data as LibraryNodeData;
          if (libData.itemContent) {
            combinedContext += `\n\n### Referência (${libData.itemTitle}):\n${libData.itemContent}`;
          }
          break;
        }
        case "prompt": {
          const promptData = inputNode.data as PromptNodeData;
          briefing = promptData.briefing;
          break;
        }
      }
    }

    if (!combinedContext && !briefing) {
      toast({
        title: "Conteúdo necessário",
        description: "Adicione conteúdo ou briefing às fontes conectadas",
        variant: "destructive",
      });
      return;
    }

    updateNodeData(generatorNodeId, { 
      isGenerating: true, 
      progress: 0,
      currentStep: "Pesquisando..." 
    } as Partial<GeneratorNodeData>);

    try {
      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      const userMessage = briefing 
        ? `${briefing}\n\nMaterial de referência:\n${combinedContext}`
        : `Crie conteúdo baseado no seguinte material:\n${combinedContext}`;

      const { data, error } = await supabase.functions.invoke("chat-multi-agent", {
        body: {
          userMessage,
          contentType: genData.format,
          platform: genData.platform,
          clientData: clientData || {},
          libraryContext: "",
          referenceContext: "",
        }
      });

      if (error) throw error;

      updateNodeData(generatorNodeId, { 
        isGenerating: false, 
        progress: 100,
        currentStep: "Concluído" 
      } as Partial<GeneratorNodeData>);

      // Create output node
      const outputPosition = {
        x: generatorNode.position.x + 350,
        y: generatorNode.position.y
      };

      const outputId = addNode("output", outputPosition, {
        type: "output",
        content: data.content || "",
        format: genData.format,
        platform: genData.platform,
        isEditing: false,
        addedToPlanning: false
      } as OutputNodeData);

      // Connect generator to output
      setEdges((eds) => addEdge({
        id: `${generatorNodeId}-${outputId}`,
        source: generatorNodeId,
        target: outputId,
        sourceHandle: "output",
        targetHandle: "input"
      }, eds));

      toast({
        title: "Conteúdo gerado",
        description: `${genData.format} criado com sucesso`,
      });

    } catch (error) {
      console.error("Generation error:", error);
      updateNodeData(generatorNodeId, { 
        isGenerating: false,
        currentStep: "Erro" 
      } as Partial<GeneratorNodeData>);
      toast({
        title: "Erro na geração",
        description: "Não foi possível gerar o conteúdo",
        variant: "destructive",
      });
    }
  }, [nodes, getConnectedInputs, updateNodeData, addNode, clientId, toast]);

  const sendToPlanning = useCallback(async (outputNodeId: string) => {
    const outputNode = nodes.find((n) => n.id === outputNodeId);
    if (!outputNode || outputNode.data.type !== "output") return;

    const outData = outputNode.data as OutputNodeData;
    
    const draftColumn = columns.find(c => c.column_type === "draft") || columns[0];
    if (!draftColumn) {
      toast({
        title: "Erro",
        description: "Nenhuma coluna encontrada para adicionar o conteúdo",
        variant: "destructive",
      });
      return;
    }

    const formatLabels: Record<ContentFormat, string> = {
      carousel: "Carrossel",
      thread: "Thread",
      reel_script: "Roteiro Reel",
      post: "Post",
      stories: "Stories",
      newsletter: "Newsletter"
    };

    try {
      await createItem.mutateAsync({
        title: `${formatLabels[outData.format]} - ${new Date().toLocaleDateString("pt-BR")}`,
        content: outData.content,
        content_type: outData.format,
        platform: outData.platform,
        column_id: draftColumn.id,
        client_id: clientId,
        labels: [formatLabels[outData.format]]
      });

      updateNodeData(outputNodeId, { addedToPlanning: true } as Partial<OutputNodeData>);

      toast({
        title: "Enviado para planejamento",
        description: "Conteúdo adicionado à coluna de rascunhos",
      });
    } catch (error) {
      console.error("Error sending to planning:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar para o planejamento",
        variant: "destructive",
      });
    }
  }, [nodes, columns, clientId, createItem, updateNodeData, toast]);

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, []);

  return {
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
    getConnectedInputs
  };
}
