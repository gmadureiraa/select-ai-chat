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
  | "output"
  | "image-editor";

// Structured metadata for each image reference
export interface ImageMetadata {
  uploadedAt: string;
  dimensions: { width: number; height: number } | null;
  analyzed: boolean;
  analyzedAt?: string;
  
  // Detailed style analysis
  styleAnalysis?: {
    dominantColors: string[];
    colorMood: string;
    visualStyle: string;
    artDirection: string;
    composition: string;
    hasText: boolean;
    textStyle?: string;
    mood: string;
    lighting: string;
    promptDescription: string;
  };
  
  // Additional metadata
  userNotes?: string;
  isPrimary?: boolean;
  referenceType?: "base" | "style" | "composition" | "color" | "general";
}

export interface SourceFile {
  id: string;
  name: string;
  type: "image" | "audio" | "video" | "document";
  mimeType: string;
  size: number;
  url: string;
  storagePath?: string;
  transcription?: string;
  styleAnalysis?: {
    colors?: string[];
    mood?: string;
    style?: string;
    fonts?: string[];
    description?: string;
  };
  metadata?: ImageMetadata;
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
  // Batch generation
  quantity?: number;
  generatedCount?: number;
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

export interface ImageEditorNodeData {
  type: "image-editor";
  baseImageUrl?: string;
  editInstruction: string;
  aspectRatio?: string;
  isProcessing: boolean;
  progress?: number;
  currentStep?: string;
}

export type CanvasNodeData = 
  | SourceNodeData 
  | LibraryNodeData 
  | PromptNodeData 
  | GeneratorNodeData 
  | OutputNodeData
  | ImageEditorNodeData;

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
  const [isSaving, setIsSaving] = useState(false);
  const { columns, createItem } = usePlanningItems({ clientId });

  // Fetch client data for name
  const { data: clientData } = useQuery({
    queryKey: ['client-for-canvas', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, identity_guide, context_notes')
        .eq('id', clientId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!clientId
  });

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
          quantity: 1,
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
      case "image-editor":
        nodeData = {
          type: "image-editor",
          editInstruction: "",
          aspectRatio: "1:1",
          isProcessing: false,
          ...data
        } as ImageEditorNodeData;
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
      
      // Call analyze-style for proper image style analysis (not transcribe-images)
      const { data, error } = await supabase.functions.invoke("analyze-style", {
        body: { 
          imageUrls: [file.url]
        }
      });

      if (error) throw error;

      const analysis = data.styleAnalysis || {};
      const visualElements = analysis.visual_elements || {};
      const brandElements = analysis.brand_elements || {};
      const technicalSpecs = analysis.technical_specs || {};
      
      // Legacy format for compatibility
      const styleAnalysis = {
        colors: visualElements.color_palette || [],
        mood: visualElements.dominant_mood || "Não identificado",
        style: visualElements.photography_style || "Não identificado",
        fonts: brandElements.typography ? [brandElements.typography] : [],
        description: analysis.style_summary || analysis.generation_prompt_template || "Análise de estilo visual"
      };

      // New structured metadata format with complete style analysis
      const metadata: ImageMetadata = {
        uploadedAt: file.metadata?.uploadedAt || new Date().toISOString(),
        dimensions: file.metadata?.dimensions || null,
        analyzed: true,
        analyzedAt: new Date().toISOString(),
        isPrimary: file.metadata?.isPrimary || false,
        referenceType: file.metadata?.referenceType || "general",
        styleAnalysis: {
          dominantColors: visualElements.color_palette || [],
          colorMood: visualElements.dominant_mood || "neutral",
          visualStyle: visualElements.photography_style || "general",
          artDirection: technicalSpecs.post_processing || "mixed",
          composition: visualElements.composition || "centered",
          hasText: !!brandElements.typography,
          textStyle: brandElements.typography,
          mood: visualElements.dominant_mood || "neutral",
          lighting: visualElements.lighting || "natural",
          promptDescription: analysis.generation_prompt_template || analysis.style_summary || ""
        }
      };

      updatedFiles[fileIndex] = { 
        ...updatedFiles[fileIndex], 
        styleAnalysis,
        metadata,
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
            // Sort to prioritize primary images first
            const sortedFiles = [...sourceData.files].sort((a, b) => {
              if (a.metadata?.isPrimary && !b.metadata?.isPrimary) return -1;
              if (!a.metadata?.isPrimary && b.metadata?.isPrimary) return 1;
              return 0;
            });
            
            for (const file of sortedFiles) {
              if (file.type === "image") {
                imageReferences.push(file.url);
                
                // Use new structured metadata if available
                if (file.metadata?.styleAnalysis?.promptDescription) {
                  styleContext.push(file.metadata.styleAnalysis.promptDescription);
                } else if (file.styleAnalysis) {
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
        // NEW: Support output nodes as input for derivation
        case "output": {
          const outputData = inputNode.data as OutputNodeData;
          if (outputData.isImage && outputData.content) {
            // If it's an image output, use as reference for new image generation
            imageReferences.push(outputData.content);
            styleContext.push("Usar estilo visual desta imagem como referência principal");
          } else if (outputData.content) {
            // If it's text output, use as context for new content
            combinedContext += `\n\n### Conteúdo Gerado Anteriormente:\n${outputData.content}`;
          }
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
        // Generate text content with batch support
        const quantity = genData.quantity || 1;
        
        // Get auth session for API call
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) throw new Error("Usuário não autenticado");

        // Generate multiple variations
        for (let i = 0; i < quantity; i++) {
          const variationSuffix = quantity > 1 
            ? `\n\nIMPORTANTE: Esta é a variação ${i + 1} de ${quantity}. Crie uma versão DIFERENTE e ÚNICA, com abordagem, estrutura ou ângulo distintos das outras variações.`
            : "";
          
          const userMessage = briefing 
            ? `${briefing}\n\nMaterial de referência:\n${combinedContext}${variationSuffix}`
            : `Crie conteúdo baseado no seguinte material:\n${combinedContext}${variationSuffix}`;

          // Update progress for batch
          updateNodeData(generatorNodeId, {
            currentStep: quantity > 1 ? `Gerando ${i + 1}/${quantity}...` : "Pesquisando...",
            progress: Math.round((i / quantity) * 100),
            generatedCount: i,
          } as Partial<GeneratorNodeData>);

          // Use fetch with SSE stream processing
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-multi-agent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
                "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({
                userMessage,
                contentType: genData.format,
                platform: genData.platform,
                clientName: clientData?.name || "Cliente",
                identityGuide: clientData?.identity_guide || "",
                libraryContext: "",
                referenceContext: "",
                userId: sessionData?.session?.user?.id,
                clientId,
              }),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro na API: ${response.status} - ${errorText}`);
          }

          // Process SSE stream
          const reader = response.body?.getReader();
          if (!reader) throw new Error("Não foi possível ler a resposta");

          const decoder = new TextDecoder();
          let buffer = "";
          let finalContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(":")) continue;

              if (trimmed.startsWith("data: ")) {
                const jsonStr = trimmed.slice(6).trim();
                if (jsonStr === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(jsonStr);
                  
                  // Update progress in real-time based on agent (for single content)
                  if (quantity === 1 && parsed.status === "running" && parsed.agentName) {
                    const progressMap: Record<string, number> = {
                      "researcher": 25,
                      "writer": 50,
                      "editor": 75,
                      "reviewer": 90,
                    };
                    const progressPercent = progressMap[parsed.step] || 50;
                    
                    updateNodeData(generatorNodeId, {
                      currentStep: parsed.agentName,
                      progress: progressPercent,
                    } as Partial<GeneratorNodeData>);
                  }
                  
                  // Capture final content
                  if (parsed.step === "complete" && parsed.status === "done" && parsed.content) {
                    finalContent = parsed.content;
                  }
                } catch {
                  // Ignore JSON parse errors for incomplete chunks
                }
              }
            }
          }

          if (!finalContent) continue; // Skip this variation if no content

          // Create output node with offset for batch
          const yOffset = i * 180; // Stack outputs vertically
          const outputPosition = {
            x: generatorNode.position.x + 350,
            y: generatorNode.position.y + yOffset
          };

          const outputId = addNode("output", outputPosition, {
            type: "output",
            content: finalContent,
            format: genData.format,
            platform: genData.platform,
            isEditing: false,
            addedToPlanning: false,
            isImage: false,
          } as OutputNodeData);

          // Connect generator to output
          setEdges((eds) => addEdge({
            id: `${generatorNodeId}-${outputId}-${i}`,
            source: generatorNodeId,
            target: outputId,
            sourceHandle: "output",
            targetHandle: "input"
          }, eds));
        }

        updateNodeData(generatorNodeId, { 
          isGenerating: false, 
          progress: 100,
          currentStep: "Concluído",
          generatedCount: quantity,
        } as Partial<GeneratorNodeData>);

        toast({
          title: quantity > 1 ? "Conteúdos gerados" : "Conteúdo gerado",
          description: quantity > 1 
            ? `${quantity} variações de ${genData.format} criadas com sucesso`
            : `${genData.format} criado com sucesso`,
        });
      }
    } catch (error) {
      console.error("Generation error:", error);
      updateNodeData(generatorNodeId, { 
        isGenerating: false,
        currentStep: "Erro",
        generatedCount: 0,
      } as Partial<GeneratorNodeData>);
      toast({
        title: "Erro na geração",
        description: "Não foi possível gerar o conteúdo",
        variant: "destructive",
      });
    }
  }, [nodes, getConnectedInputs, updateNodeData, addNode, clientId, clientData, toast]);

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

  // Regenerate content from an output node
  const regenerateContent = useCallback(async (outputNodeId: string) => {
    const outputNode = nodes.find((n) => n.id === outputNodeId);
    if (!outputNode || outputNode.data.type !== "output") return;

    // Find the generator node that created this output
    const connectedEdge = edges.find((e) => e.target === outputNodeId);
    if (!connectedEdge) {
      toast({
        title: "Erro",
        description: "Não foi possível encontrar o gerador conectado",
        variant: "destructive",
      });
      return;
    }

    const generatorNodeId = connectedEdge.source;
    
    // Delete the current output node
    deleteNode(outputNodeId);
    
    // Regenerate from the generator
    await generateContent(generatorNodeId);
  }, [nodes, edges, deleteNode, generateContent, toast]);

  // Edit image using ImageEditorNode
  const editImage = useCallback(async (editorNodeId: string) => {
    const editorNode = nodes.find((n) => n.id === editorNodeId);
    if (!editorNode || editorNode.data.type !== "image-editor") return;

    const editorData = editorNode.data as ImageEditorNodeData;
    
    // Get base image from connected source node
    const inputEdge = edges.find((e) => e.target === editorNodeId);
    let baseImageUrl = editorData.baseImageUrl;
    
    if (!baseImageUrl && inputEdge) {
      const sourceNode = nodes.find((n) => n.id === inputEdge.source);
      if (sourceNode?.data.type === "source") {
        const sourceData = sourceNode.data as SourceNodeData;
        const imageFile = sourceData.files?.find(f => f.type === "image");
        if (imageFile) {
          baseImageUrl = imageFile.url;
          updateNodeData(editorNodeId, { baseImageUrl } as Partial<ImageEditorNodeData>);
        }
      } else if (sourceNode?.data.type === "output" && (sourceNode.data as OutputNodeData).isImage) {
        baseImageUrl = (sourceNode.data as OutputNodeData).content;
        updateNodeData(editorNodeId, { baseImageUrl } as Partial<ImageEditorNodeData>);
      }
    }

    if (!baseImageUrl) {
      toast({
        title: "Imagem necessária",
        description: "Conecte uma fonte com imagem ao editor",
        variant: "destructive",
      });
      return;
    }

    if (!editorData.editInstruction.trim()) {
      toast({
        title: "Instrução necessária",
        description: "Digite uma instrução de edição",
        variant: "destructive",
      });
      return;
    }

    updateNodeData(editorNodeId, { 
      isProcessing: true, 
      progress: 0,
      currentStep: "Editando imagem..." 
    } as Partial<ImageEditorNodeData>);

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: editorData.editInstruction,
          clientId,
          aspectRatio: editorData.aspectRatio || "1:1",
          referenceImages: [{ url: baseImageUrl, isPrimary: true }],
        }
      });

      if (error) throw error;

      updateNodeData(editorNodeId, { 
        isProcessing: false, 
        progress: 100,
        currentStep: "Concluído" 
      } as Partial<ImageEditorNodeData>);

      // Create output node with edited image
      const outputPosition = {
        x: editorNode.position.x + 350,
        y: editorNode.position.y
      };

      const outputId = addNode("output", outputPosition, {
        type: "output",
        content: data.imageUrl || data.url || "",
        format: "image",
        platform: "instagram",
        isEditing: false,
        addedToPlanning: false,
        isImage: true,
      } as OutputNodeData);

      // Connect editor to output
      setEdges((eds) => addEdge({
        id: `${editorNodeId}-${outputId}`,
        source: editorNodeId,
        target: outputId,
        sourceHandle: "output",
        targetHandle: "input"
      }, eds));

      toast({
        title: "Imagem editada",
        description: "Sua imagem foi editada com sucesso",
      });
    } catch (error) {
      console.error("Edit error:", error);
      updateNodeData(editorNodeId, { 
        isProcessing: false,
        currentStep: "Erro" 
      } as Partial<ImageEditorNodeData>);
      toast({
        title: "Erro na edição",
        description: "Não foi possível editar a imagem",
        variant: "destructive",
      });
    }
  }, [nodes, edges, updateNodeData, addNode, clientId, toast]);

  // Save canvas
  const saveCanvas = useCallback(async (name?: string) => {
    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
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

  // Load template - pre-configured canvas flows
  const loadTemplate = useCallback((templateId: string) => {
    clearCanvas();
    
    const templates: Record<string, { nodes: any[]; edges: any[]; name: string }> = {
      carousel_from_url: {
        name: "Carrossel de URL",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 150 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 350 }, data: { type: "prompt", briefing: "Transforme este conteúdo em um carrossel de 7-10 slides para Instagram" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "carousel", platform: "instagram", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      thread_from_video: {
        name: "Thread de Vídeo",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 200 }, data: { type: "source", sourceType: "file", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 400 }, data: { type: "prompt", briefing: "Crie uma thread viral com os principais insights deste vídeo" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 300 }, data: { type: "generator", format: "thread", platform: "twitter", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      newsletter_curated: {
        name: "Newsletter Curada",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 100 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "source-t2", type: "source", position: { x: 100, y: 300 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 500 }, data: { type: "prompt", briefing: "Compile estas fontes em uma newsletter com curadoria e análise" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 300 }, data: { type: "generator", format: "newsletter", platform: "other", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "source-t2", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
          { id: "e3", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-3" },
        ]
      },
      reel_script: {
        name: "Roteiro de Reel",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 150 }, data: { type: "source", sourceType: "text", value: "", files: [] } },
          { id: "library-t1", type: "library", position: { x: 100, y: 350 }, data: { type: "library" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "reel_script", platform: "instagram", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "library-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      image_series: {
        name: "Série de Imagens",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 150 }, data: { type: "source", sourceType: "text", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 350 }, data: { type: "prompt", briefing: "Descreva o estilo visual desejado" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "image", platform: "instagram", isGenerating: false, imageStyle: "photographic", aspectRatio: "1:1", quantity: 3 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      // New templates
      linkedin_article: {
        name: "Artigo LinkedIn",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 150 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 350 }, data: { type: "prompt", briefing: "Transforme em um artigo profissional para LinkedIn com insights acionáveis" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "post", platform: "linkedin", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      podcast_highlights: {
        name: "Destaques de Podcast",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 150 }, data: { type: "source", sourceType: "file", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 350 }, data: { type: "prompt", briefing: "Extraia os 5 principais insights deste áudio para uma thread" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "thread", platform: "twitter", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      story_sequence: {
        name: "Sequência de Stories",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 150 }, data: { type: "source", sourceType: "text", value: "", files: [] } },
          { id: "library-t1", type: "library", position: { x: 100, y: 350 }, data: { type: "library" } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 250 }, data: { type: "generator", format: "stories", platform: "instagram", isGenerating: false, quantity: 5 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "library-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
        ]
      },
      repurpose_blog: {
        name: "Repurpose de Blog",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 200 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "generator-t1", type: "generator", position: { x: 450, y: 100 }, data: { type: "generator", format: "carousel", platform: "instagram", isGenerating: false, quantity: 1 } },
          { id: "generator-t2", type: "generator", position: { x: 450, y: 300 }, data: { type: "generator", format: "thread", platform: "twitter", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "source-t1", target: "generator-t2", sourceHandle: "output", targetHandle: "input-1" },
        ]
      },
      weekly_summary: {
        name: "Resumo Semanal",
        nodes: [
          { id: "source-t1", type: "source", position: { x: 100, y: 50 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "source-t2", type: "source", position: { x: 100, y: 200 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "source-t3", type: "source", position: { x: 100, y: 350 }, data: { type: "source", sourceType: "url", value: "", files: [] } },
          { id: "prompt-t1", type: "prompt", position: { x: 100, y: 500 }, data: { type: "prompt", briefing: "Crie um resumo semanal compilando todas essas fontes em uma newsletter" } },
          { id: "generator-t1", type: "generator", position: { x: 500, y: 275 }, data: { type: "generator", format: "newsletter", platform: "other", isGenerating: false, quantity: 1 } },
        ],
        edges: [
          { id: "e1", source: "source-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-1" },
          { id: "e2", source: "source-t2", target: "generator-t1", sourceHandle: "output", targetHandle: "input-2" },
          { id: "e3", source: "source-t3", target: "generator-t1", sourceHandle: "output", targetHandle: "input-3" },
          { id: "e4", source: "prompt-t1", target: "generator-t1", sourceHandle: "output", targetHandle: "input-4" },
        ]
      },
    };

    const template = templates[templateId];
    if (template) {
      setNodes(template.nodes);
      setEdges(template.edges);
      setCurrentCanvasName(template.name);
    }
  }, [clearCanvas]);

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
    regenerateContent,
    editImage,
    sendToPlanning,
    clearCanvas,
    getConnectedInputs,
    loadTemplate,
    // Canvas persistence
    savedCanvases,
    isLoadingCanvases,
    isSaving,
    currentCanvasId,
    currentCanvasName,
    setCanvasName,
    saveCanvas,
    loadCanvas,
    deleteCanvas,
  };
}
