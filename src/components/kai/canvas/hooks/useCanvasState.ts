import { useState, useCallback } from "react";
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from "reactflow";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlanningItems } from "@/hooks/usePlanningItems";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type NodeDataType = 
  | "source" 
  | "library" 
  | "prompt" 
  | "generator" 
  | "output";

export interface SourceFile {
  id: string;
  name: string;
  type: "image" | "audio" | "video" | "document";
  mimeType: string;
  size: number;
  url: string;
  transcription?: string;
  styleAnalysis?: {
    colors?: string[];
    mood?: string;
    style?: string;
    fonts?: string[];
    description?: string;
  };
  isProcessing?: boolean;
}

export interface SourceNodeData {
  type: "source";
  sourceType: "url" | "text" | "file";
  value: string;
  extractedContent?: string;
  isExtracting?: boolean;
  title?: string;
  thumbnail?: string;
  urlType?: "youtube" | "article" | "newsletter";
  files?: SourceFile[];
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
  | "newsletter"
  | "image";

export type Platform = "instagram" | "linkedin" | "twitter" | "youtube" | "tiktok" | "other";

export interface GeneratorNodeData {
  type: "generator";
  format: ContentFormat;
  platform: Platform;
  isGenerating: boolean;
  progress?: number;
  currentStep?: string;
  // Image generation options
  imageStyle?: string;
  aspectRatio?: string;
  noTextInImage?: boolean;
}

export interface OutputNodeData {
  type: "output";
  content: string;
  format: ContentFormat;
  platform: Platform;
  isEditing: boolean;
  addedToPlanning: boolean;
  isImage?: boolean;
  imageUrl?: string;
}

export type CanvasNodeData = 
  | SourceNodeData 
  | LibraryNodeData 
  | PromptNodeData 
  | GeneratorNodeData 
  | OutputNodeData;

export interface SavedCanvas {
  id: string;
  workspace_id: string;
  client_id: string;
  user_id: string;
  name: string;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  created_at: string;
  updated_at: string;
}

const defaultNodes: Node<CanvasNodeData>[] = [];
const defaultEdges: Edge[] = [];

function isYoutubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

export function useCanvasState(clientId: string, workspaceId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nodes, setNodes] = useState<Node<CanvasNodeData>[]>(defaultNodes);
  const [edges, setEdges] = useState<Edge[]>(defaultEdges);
  const [currentCanvasId, setCurrentCanvasId] = useState<string | null>(null);
  const [currentCanvasName, setCurrentCanvasName] = useState<string>("Novo Canvas");
  const { columns, createItem } = usePlanningItems({ clientId });

  // Fetch saved canvases for this client
  const { data: savedCanvases = [], isLoading: isLoadingCanvases } = useQuery({
    queryKey: ['content-canvas', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_canvas')
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as SavedCanvas[];
    },
    enabled: !!clientId
  });

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
          files: [],
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
          imageStyle: "photographic",
          aspectRatio: "1:1",
          noTextInImage: false,
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
          isImage: false,
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

  // Extract URL content (YouTube or article)
  const extractUrlContent = useCallback(async (nodeId: string, url: string) => {
    updateNodeData(nodeId, { isExtracting: true } as Partial<SourceNodeData>);

    try {
      const isYoutube = isYoutubeUrl(url);
      
      if (isYoutube) {
        // Use extract-youtube for YouTube URLs
        const { data, error } = await supabase.functions.invoke("extract-youtube", {
          body: { url }
        });

        if (error) throw error;

        updateNodeData(nodeId, {
          extractedContent: data.content || data.transcript || "",
          title: data.title || url,
          thumbnail: data.thumbnail || "",
          urlType: "youtube",
          isExtracting: false
        } as Partial<SourceNodeData>);

        toast({
          title: "YouTube extraído",
          description: `"${data.title || url}" transcrito com sucesso`,
        });
      } else {
        // Use fetch-reference-content for other URLs
        const { data, error } = await supabase.functions.invoke("fetch-reference-content", {
          body: { url }
        });

        if (error) throw error;
        
        if (!data.success) {
          throw new Error(data.error || "Falha ao extrair conteúdo");
        }

        updateNodeData(nodeId, {
          extractedContent: data.content || data.markdown || "",
          title: data.title || url,
          thumbnail: data.thumbnail || "",
          urlType: data.type === "newsletter" ? "newsletter" : "article",
          isExtracting: false
        } as Partial<SourceNodeData>);

        toast({
          title: "Conteúdo extraído",
          description: `"${data.title || url}" foi processado com sucesso`,
        });
      }
    } catch (error) {
      console.error("Error extracting URL:", error);
      updateNodeData(nodeId, { isExtracting: false } as Partial<SourceNodeData>);
      toast({
        title: "Erro na extração",
        description: error instanceof Error ? error.message : "Não foi possível extrair o conteúdo da URL",
        variant: "destructive",
      });
    }
  }, [updateNodeData, toast]);

  // Transcribe audio/video file
  const transcribeFile = useCallback(async (nodeId: string, fileId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.data.type !== "source") return;

    const sourceData = node.data as SourceNodeData;
    const files = sourceData.files || [];
    const fileIndex = files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) return;

    // Mark file as processing
    const updatedFiles = [...files];
    updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], isProcessing: true };
    updateNodeData(nodeId, { files: updatedFiles } as Partial<SourceNodeData>);

    try {
      const file = files[fileIndex];
      
      // For now, show a placeholder - real implementation would call transcribe-audio
      const { data, error } = await supabase.functions.invoke("transcribe-audio", {
        body: { audioUrl: file.url }
      });

      if (error) throw error;

      updatedFiles[fileIndex] = { 
        ...updatedFiles[fileIndex], 
        transcription: data.transcription || data.text || "Transcrição não disponível",
        isProcessing: false 
      };
      updateNodeData(nodeId, { files: updatedFiles } as Partial<SourceNodeData>);

      toast({
        title: "Arquivo transcrito",
        description: `"${file.name}" foi transcrito com sucesso`,
      });
    } catch (error) {
      console.error("Error transcribing file:", error);
      updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], isProcessing: false };
      updateNodeData(nodeId, { files: updatedFiles } as Partial<SourceNodeData>);
      toast({
        title: "Erro na transcrição",
        description: "Não foi possível transcrever o arquivo",
        variant: "destructive",
      });
    }
  }, [nodes, updateNodeData, toast]);

  // Analyze image style
  const analyzeImageStyle = useCallback(async (nodeId: string, fileId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.data.type !== "source") return;

    const sourceData = node.data as SourceNodeData;
    const files = sourceData.files || [];
    const fileIndex = files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) return;

    // Mark file as processing
    const updatedFiles = [...files];
    updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], isProcessing: true };
    updateNodeData(nodeId, { files: updatedFiles } as Partial<SourceNodeData>);

    try {
      const file = files[fileIndex];
      
      // Call transcribe-images to analyze the image
      const { data, error } = await supabase.functions.invoke("transcribe-images", {
        body: { 
          imageUrls: [file.url],
          mode: "style_analysis"
        }
      });

      if (error) throw error;

      const styleAnalysis = {
        colors: data.colors || [],
        mood: data.mood || "Não identificado",
        style: data.style || "Não identificado",
        fonts: data.fonts || [],
        description: data.description || data.analysis || "Análise de estilo visual"
      };

      updatedFiles[fileIndex] = { 
        ...updatedFiles[fileIndex], 
        styleAnalysis,
        isProcessing: false 
      };
      updateNodeData(nodeId, { files: updatedFiles } as Partial<SourceNodeData>);

      toast({
        title: "Estilo analisado",
        description: `Estilo de "${file.name}" foi identificado`,
      });
    } catch (error) {
      console.error("Error analyzing style:", error);
      updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], isProcessing: false };
      updateNodeData(nodeId, { files: updatedFiles } as Partial<SourceNodeData>);
      toast({
        title: "Erro na análise",
        description: "Não foi possível analisar o estilo da imagem",
        variant: "destructive",
      });
    }
  }, [nodes, updateNodeData, toast]);

  // Generate content (text or image)
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
    let imageReferences: string[] = [];
    let styleContext: string[] = [];

    for (const inputNode of inputNodes) {
      switch (inputNode.data.type) {
        case "source": {
          const sourceData = inputNode.data as SourceNodeData;
          if (sourceData.extractedContent) {
            combinedContext += `\n\n### Conteúdo Extraído:\n${sourceData.extractedContent}`;
          } else if (sourceData.value && sourceData.sourceType === "text") {
            combinedContext += `\n\n### Texto:\n${sourceData.value}`;
          }
          
          // Collect image references and transcriptions from files
          if (sourceData.files) {
            for (const file of sourceData.files) {
              if (file.type === "image") {
                imageReferences.push(file.url);
                if (file.styleAnalysis) {
                  styleContext.push(JSON.stringify(file.styleAnalysis));
                }
              }
              if (file.transcription) {
                combinedContext += `\n\n### Transcrição (${file.name}):\n${file.transcription}`;
              }
            }
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
      currentStep: genData.format === "image" ? "Gerando imagem..." : "Pesquisando..." 
    } as Partial<GeneratorNodeData>);

    try {
      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      // Check if generating image
      if (genData.format === "image") {
        // Get visual references from client
        const { data: visualRefs } = await supabase
          .from('client_visual_references')
          .select('*')
          .eq('client_id', clientId)
          .eq('is_primary', true)
          .limit(4);

        const visualRefUrls = (visualRefs || []).map(r => r.image_url);
        const allImageRefs = [...imageReferences, ...visualRefUrls];

        // Build image generation prompt
        let imagePrompt = briefing || `Crie uma imagem baseada em: ${combinedContext.substring(0, 500)}`;
        
        if (styleContext.length > 0) {
          imagePrompt += `\n\nEstilo de referência: ${styleContext.join(", ")}`;
        }
        
        if (genData.noTextInImage) {
          imagePrompt += "\n\nIMPORTANTE: A imagem não deve conter texto.";
        }

        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: {
            prompt: imagePrompt,
            clientId,
            format: genData.aspectRatio || "1:1",
            style: genData.imageStyle || "photographic",
            imageUrls: allImageRefs.slice(0, 4),
          }
        });

        if (error) throw error;

        updateNodeData(generatorNodeId, { 
          isGenerating: false, 
          progress: 100,
          currentStep: "Concluído" 
        } as Partial<GeneratorNodeData>);

        // Create output node with image
        const outputPosition = {
          x: generatorNode.position.x + 350,
          y: generatorNode.position.y
        };

        const outputId = addNode("output", outputPosition, {
          type: "output",
          content: data.imageUrl || data.url || "",
          format: "image",
          platform: genData.platform,
          isEditing: false,
          addedToPlanning: false,
          isImage: true,
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
          title: "Imagem gerada",
          description: "Sua imagem foi criada com sucesso",
        });
      } else {
        // Generate text content
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
          addedToPlanning: false,
          isImage: false,
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
      }
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
      newsletter: "Newsletter",
      image: "Imagem"
    };

    try {
      await createItem.mutateAsync({
        title: `${formatLabels[outData.format]} - ${new Date().toLocaleDateString("pt-BR")}`,
        content: outData.content,
        content_type: outData.format === "image" ? "post" : outData.format,
        platform: outData.platform as any,
        column_id: draftColumn.id,
        client_id: clientId,
        labels: [formatLabels[outData.format]],
        ...(outData.isImage && { image_url: outData.content })
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

  // Save canvas
  const saveCanvas = useCallback(async (name?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: client } = await supabase
        .from("clients")
        .select("workspace_id")
        .eq("id", clientId)
        .single();

      if (!client) throw new Error("Cliente não encontrado");

      const canvasData = {
        id: currentCanvasId || undefined,
        client_id: clientId,
        workspace_id: client.workspace_id,
        user_id: user.id,
        name: name || currentCanvasName || `Canvas ${new Date().toLocaleDateString("pt-BR")}`,
        nodes: nodes as any,
        edges: edges as any,
      };

      const { data, error } = await supabase
        .from('content_canvas')
        .upsert(canvasData)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCurrentCanvasId(data.id);
        setCurrentCanvasName(data.name);
        queryClient.invalidateQueries({ queryKey: ['content-canvas', clientId] });
      }

      toast({
        title: "Canvas salvo",
        description: `"${data?.name}" foi salvo com sucesso`,
      });

      return data as unknown as SavedCanvas;
    } catch (error) {
      console.error("Error saving canvas:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o canvas",
        variant: "destructive",
      });
      return null;
    }
  }, [nodes, edges, clientId, currentCanvasId, currentCanvasName, queryClient, toast]);

  // Load canvas
  const loadCanvas = useCallback(async (canvasId: string) => {
    try {
      const { data, error } = await supabase
        .from('content_canvas')
        .select('*')
        .eq('id', canvasId)
        .single();

      if (error) throw error;

      if (data) {
        setNodes((data.nodes as any) || []);
        setEdges((data.edges as any) || []);
        setCurrentCanvasId(data.id);
        setCurrentCanvasName(data.name);
      }

      toast({
        title: "Canvas carregado",
        description: `"${data?.name}" foi carregado`,
      });
    } catch (error) {
      console.error("Error loading canvas:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar o canvas",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Delete canvas
  const deleteCanvas = useCallback(async (canvasId: string) => {
    try {
      const { error } = await supabase
        .from('content_canvas')
        .delete()
        .eq('id', canvasId);

      if (error) throw error;

      if (currentCanvasId === canvasId) {
        setCurrentCanvasId(null);
        setCurrentCanvasName("Novo Canvas");
        setNodes([]);
        setEdges([]);
      }

      queryClient.invalidateQueries({ queryKey: ['content-canvas', clientId] });

      toast({
        title: "Canvas excluído",
        description: "O canvas foi removido",
      });
    } catch (error) {
      console.error("Error deleting canvas:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o canvas",
        variant: "destructive",
      });
    }
  }, [currentCanvasId, clientId, queryClient, toast]);

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setCurrentCanvasId(null);
    setCurrentCanvasName("Novo Canvas");
  }, []);

  const setCanvasName = useCallback((name: string) => {
    setCurrentCanvasName(name);
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
    transcribeFile,
    analyzeImageStyle,
    generateContent,
    sendToPlanning,
    clearCanvas,
    getConnectedInputs,
    // Canvas persistence
    savedCanvases,
    isLoadingCanvases,
    currentCanvasId,
    currentCanvasName,
    setCanvasName,
    saveCanvas,
    loadCanvas,
    deleteCanvas,
  };
}
