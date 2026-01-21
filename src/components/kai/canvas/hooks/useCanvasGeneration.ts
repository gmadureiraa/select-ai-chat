import { useCallback } from "react";
import { Node, Edge } from "reactflow";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTokenError } from "@/hooks/useTokenError";
import { IMAGE_FORMAT_INSTRUCTIONS } from "@/types/template";
import { 
  CanvasNodeData,
  SourceNodeData,
  LibraryNodeData,
  PromptNodeData,
  OutputNodeData,
  GeneratorNodeData,
  ImageSourceNodeData,
  AttachmentNodeData,
  ImageEditorNodeData
} from "./useCanvasState";
import { blobUrlToBase64 } from "./useCanvasExtractions";

interface UseCanvasGenerationProps {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  clientId: string;
  updateNodeData: (nodeId: string, updates: Partial<CanvasNodeData>) => void;
  addNode: (nodeType: string, position: { x: number; y: number }, data?: Partial<CanvasNodeData>) => string;
  deleteNode: (nodeId: string) => void;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  analyzeImageSourceImage: (nodeId: string, imageId: string, url: string) => Promise<void>;
}

export function useCanvasGeneration({
  nodes,
  edges,
  clientId,
  updateNodeData,
  addNode,
  deleteNode,
  setEdges,
  analyzeImageSourceImage
}: UseCanvasGenerationProps) {
  const { toast } = useToast();
  const { handleTokenError } = useTokenError();

  const getConnectedInputs = useCallback((generatorNodeId: string) => {
    const inputEdges = edges.filter((e) => e.target === generatorNodeId);
    const inputNodes = inputEdges
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter(Boolean) as Node<CanvasNodeData>[];
    return inputNodes;
  }, [edges, nodes]);

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

    // Process all inputs in parallel for better performance
    const processInputs = async () => {
      const promises = inputNodes.map(async (inputNode) => {
        switch (inputNode.data.type) {
          case "source": {
            const sourceData = inputNode.data as SourceNodeData;
            if (sourceData.extractedContent) {
              combinedContext += `\n\n### Conteúdo Extraído:\n${sourceData.extractedContent}`;
            } else if (sourceData.value && sourceData.sourceType === "text") {
              combinedContext += `\n\n### Texto:\n${sourceData.value}`;
            }
            
            if (sourceData.files) {
              const sortedFiles = [...sourceData.files].sort((a, b) => {
                if (a.metadata?.isPrimary && !b.metadata?.isPrimary) return -1;
                if (!a.metadata?.isPrimary && b.metadata?.isPrimary) return 1;
                return 0;
              });
              
              // Process images in parallel
              const imagePromises = sortedFiles
                .filter(file => file.type === "image")
                .map(async (file) => {
                  try {
                    const imageUrl = await blobUrlToBase64(file.url);
                    imageReferences.push(imageUrl);
                  } catch (e) {
                    console.warn('Failed to process image reference:', e);
                  }
                  
                  if (file.metadata?.styleAnalysis?.promptDescription) {
                    styleContext.push(file.metadata.styleAnalysis.promptDescription);
                  } else if (file.styleAnalysis) {
                    styleContext.push(JSON.stringify(file.styleAnalysis));
                  }
                });
              
              await Promise.all(imagePromises);
              
              for (const file of sortedFiles) {
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
          case "output": {
            const outputData = inputNode.data as OutputNodeData;
            if (outputData.isImage && outputData.content) {
              imageReferences.push(outputData.content);
              styleContext.push("Usar estilo visual desta imagem como referência principal");
            } else if (outputData.content) {
              combinedContext += `\n\n### Conteúdo Gerado Anteriormente:\n${outputData.content}`;
            }
            break;
          }
          case "image-source": {
            const imgSrcData = inputNode.data as ImageSourceNodeData;
            const srcImages = imgSrcData.images || [];
            
            const imagePromises = srcImages.map(async (img) => {
              if (img.url) {
                try {
                  const imageUrl = await blobUrlToBase64(img.url);
                  imageReferences.push(imageUrl);
                } catch (e) {
                  console.warn('Failed to process image-source reference:', e);
                }
              }
              
              if (img.metadata?.imageAnalysis) {
                styleContext.push(`Análise completa: ${JSON.stringify(img.metadata.imageAnalysis)}`);
                if (img.metadata.imageAnalysis.generation_prompt) {
                  styleContext.push(`Prompt sugerido: ${img.metadata.imageAnalysis.generation_prompt}`);
                }
              } else if (img.metadata?.styleAnalysis?.promptDescription) {
                styleContext.push(img.metadata.styleAnalysis.promptDescription);
              }
            });
            
            await Promise.all(imagePromises);
            break;
          }
          case "attachment": {
            const attachData = inputNode.data as AttachmentNodeData;
            
            if (attachData.activeTab === "link" && attachData.extractedContent) {
              combinedContext += `\n\n### Conteúdo de ${attachData.title || 'Link'}:\n${attachData.extractedContent}`;
            }
            
            if (attachData.activeTab === "text" && attachData.textContent) {
              combinedContext += `\n\n### Texto:\n${attachData.textContent}`;
            }
            
            if (attachData.files && attachData.files.length > 0) {
              for (const file of attachData.files) {
                if (file.transcription) {
                  combinedContext += `\n\n### Transcrição (${file.name}):\n${file.transcription}`;
                }
              }
            }
            
            if (attachData.images && attachData.images.length > 0) {
              const sortedImages = [...attachData.images].sort((a, b) => {
                if (a.metadata?.isPrimary && !b.metadata?.isPrimary) return -1;
                if (!a.metadata?.isPrimary && b.metadata?.isPrimary) return 1;
                return 0;
              });
              
              const imagePromises = sortedImages.map(async (img) => {
                if (img.url) {
                  try {
                    const imageUrl = await blobUrlToBase64(img.url);
                    imageReferences.push(imageUrl);
                  } catch (e) {
                    console.warn('Failed to process attachment image:', e);
                  }
                }
                
                if (img.metadata?.imageAnalysis) {
                  styleContext.push(`Análise: ${JSON.stringify(img.metadata.imageAnalysis)}`);
                  if (img.metadata.imageAnalysis.generation_prompt) {
                    styleContext.push(`Prompt: ${img.metadata.imageAnalysis.generation_prompt}`);
                  }
                } else if (img.metadata?.styleAnalysis?.promptDescription) {
                  styleContext.push(img.metadata.styleAnalysis.promptDescription);
                }
                
                if (img.metadata?.ocrText) {
                  combinedContext += `\n\n### Texto da Imagem (${img.name || 'imagem'}):\n${img.metadata.ocrText}`;
                }
              });
              
              await Promise.all(imagePromises);
            }
            break;
          }
        }
      });
      
      await Promise.all(promises);
    };

    await processInputs();

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
      currentStep: genData.format === "image" ? "Preparando..." : "Pesquisando..." 
    } as Partial<GeneratorNodeData>);

    try {
      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (genData.format === "image") {
        // Auto-analyze images that don't have analysis - in parallel
        const imagesToAnalyze: Array<{ nodeId: string; imageId: string; url: string }> = [];
        
        for (const inputNode of inputNodes) {
          if (inputNode.data.type === "attachment") {
            const attachData = inputNode.data as AttachmentNodeData;
            if (attachData.images && attachData.images.length > 0) {
              for (const img of attachData.images) {
                if (img.url && !img.metadata?.imageAnalysis) {
                  imagesToAnalyze.push({
                    nodeId: inputNode.id,
                    imageId: img.id,
                    url: img.url
                  });
                }
              }
            }
          }
        }

        if (imagesToAnalyze.length > 0) {
          updateNodeData(generatorNodeId, { 
            currentStep: `Analisando ${imagesToAnalyze.length} referência(s)...`,
            progress: 10
          } as Partial<GeneratorNodeData>);

          // Process in parallel with batching
          const BATCH_SIZE = 3;
          for (let i = 0; i < imagesToAnalyze.length; i += BATCH_SIZE) {
            const batch = imagesToAnalyze.slice(i, i + BATCH_SIZE);
            
            await Promise.allSettled(
              batch.map(({ nodeId, imageId, url }) => 
                analyzeImageSourceImage(nodeId, imageId, url)
              )
            );
            
            updateNodeData(generatorNodeId, { 
              currentStep: `Analisando referência ${Math.min(i + BATCH_SIZE, imagesToAnalyze.length)}/${imagesToAnalyze.length}...`,
              progress: 10 + Math.round(((i + BATCH_SIZE) / imagesToAnalyze.length) * 30)
            } as Partial<GeneratorNodeData>);
          }
        }

        updateNodeData(generatorNodeId, { 
          currentStep: "Gerando imagem...",
          progress: 50
        } as Partial<GeneratorNodeData>);

        // Collect fresh style analysis after auto-analyze
        let allImageRefs: string[] = [...imageReferences];
        let collectedStyleAnalysis = "";

        for (const inputNode of inputNodes) {
          if (inputNode.data.type === "attachment") {
            const attachData = inputNode.data as AttachmentNodeData;
            if (attachData.images) {
              for (const img of attachData.images) {
                if (img.metadata?.imageAnalysis) {
                  collectedStyleAnalysis += JSON.stringify(img.metadata.imageAnalysis) + "\n";
                }
              }
            }
          }
        }

        if (styleContext.length > 0) {
          collectedStyleAnalysis += "\n" + styleContext.join("\n\n");
        }

        const imagePrompt = (genData as any).imagePrompt || briefing || combinedContext.substring(0, 1000);
        
        const imageTypeToFormatKey: Record<string, string> = {
          "feed": "post_feed",
          "carousel": "carrossel",
          "thumbnail": "thumbnail",
          "stories": "story",
          "youtube_thumbnail": "thumbnail_youtube",
          "quote": "quote_card",
          "data_viz": "infografico",
          "general": "arte_generica"
        };

        const imageType = (genData as any).imageType || "general";
        const formatKey = imageTypeToFormatKey[imageType] || "arte_generica";
        const formatSpec = IMAGE_FORMAT_INSTRUCTIONS[formatKey];
        const formatInstructionsText = formatSpec?.instructions || "";
        
        const effectiveAspectRatio = genData.aspectRatio || formatSpec?.aspectRatio || "1:1";
        const preservePerson = (genData as any).preservePerson || false;

        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: {
            prompt: imagePrompt,
            clientId,
            aspectRatio: effectiveAspectRatio,
            imageFormat: genData.imageStyle || "photographic",
            imageType,
            preservePerson,
            formatInstructions: formatInstructionsText,
            imageReferences: allImageRefs.slice(0, 2),
            styleAnalysis: collectedStyleAnalysis,
          }
        });

        if (error) throw error;

        updateNodeData(generatorNodeId, { 
          isGenerating: false, 
          progress: 100,
          currentStep: "Concluído" 
        } as Partial<GeneratorNodeData>);

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

        setEdges((eds) => [...eds, {
          id: `${generatorNodeId}-${outputId}`,
          source: generatorNodeId,
          target: outputId,
          sourceHandle: "output",
          targetHandle: "input"
        }]);

        toast({
          title: "Imagem gerada",
          description: "Sua imagem foi criada com sucesso",
        });
      } else {
        // Generate text content
        const quantity = genData.quantity || 1;
        
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) throw new Error("Usuário não autenticado");

        for (let i = 0; i < quantity; i++) {
          const variationSuffix = quantity > 1 
            ? `\n\nIMPORTANTE: Esta é a variação ${i + 1} de ${quantity}. Crie uma versão DIFERENTE e ÚNICA.`
            : "";
          
          const userMessage = briefing 
            ? `${briefing}\n\nMaterial de referência:\n${combinedContext}${variationSuffix}`
            : `Crie conteúdo baseado no seguinte material:\n${combinedContext}${variationSuffix}`;

          updateNodeData(generatorNodeId, {
            currentStep: quantity > 1 ? `Gerando ${i + 1}/${quantity}...` : "Pesquisando...",
            progress: Math.round((i / quantity) * 100),
            generatedCount: i,
          } as Partial<GeneratorNodeData>);

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kai-content-agent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
                "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({
                clientId,
                request: userMessage,
                format: genData.format,
                platform: genData.platform,
              }),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            
            if (response.status === 402) {
              const error = new Error("Créditos insuficientes") as Error & { status: number; code: string };
              error.status = 402;
              error.code = "TOKENS_EXHAUSTED";
              throw error;
            }
            
            throw new Error(`Erro na API: ${response.status} - ${errorText}`);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error("Não foi possível ler a resposta");

          const decoder = new TextDecoder();
          let buffer = "";
          let finalContent = "";
          let chunkCount = 0;

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
                  const deltaContent = parsed.choices?.[0]?.delta?.content;
                  if (deltaContent) {
                    finalContent += deltaContent;
                    chunkCount++;
                    
                    if (quantity === 1 && chunkCount % 10 === 0) {
                      const progress = Math.min(90, 20 + Math.floor(chunkCount / 5));
                      updateNodeData(generatorNodeId, {
                        currentStep: "Gerando conteúdo...",
                        progress,
                      } as Partial<GeneratorNodeData>);
                    }
                  }
                } catch {
                  // Ignore JSON parse errors
                }
              }
            }
          }

          finalContent = finalContent.trim();
          if (!finalContent) continue;

          const yOffset = i * 180;
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

          setEdges((eds) => [...eds, {
            id: `${generatorNodeId}-${outputId}-${i}`,
            source: generatorNodeId,
            target: outputId,
            sourceHandle: "output",
            targetHandle: "input"
          }]);
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
            ? `${quantity} variações criadas com sucesso`
            : `${genData.format} criado com sucesso`,
        });
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      updateNodeData(generatorNodeId, { 
        isGenerating: false,
        currentStep: "Erro",
        generatedCount: 0,
      } as Partial<GeneratorNodeData>);
      
      const isTokenError = await handleTokenError(error, error?.status);
      if (!isTokenError) {
        toast({
          title: "Erro na geração",
          description: "Não foi possível gerar o conteúdo",
          variant: "destructive",
        });
      }
    }
  }, [nodes, edges, getConnectedInputs, updateNodeData, addNode, clientId, toast, handleTokenError, analyzeImageSourceImage, setEdges]);

  const regenerateContent = useCallback(async (outputNodeId: string) => {
    const outputNode = nodes.find((n) => n.id === outputNodeId);
    if (!outputNode || outputNode.data.type !== "output") return;

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
    deleteNode(outputNodeId);
    await generateContent(generatorNodeId);
  }, [nodes, edges, deleteNode, generateContent, toast]);

  const editImage = useCallback(async (editorNodeId: string) => {
    const editorNode = nodes.find((n) => n.id === editorNodeId);
    if (!editorNode || editorNode.data.type !== "image-editor") return;

    const editorData = editorNode.data as ImageEditorNodeData;
    
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

      setEdges((eds) => [...eds, {
        id: `${editorNodeId}-${outputId}`,
        source: editorNodeId,
        target: outputId,
        sourceHandle: "output",
        targetHandle: "input"
      }]);

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
  }, [nodes, edges, updateNodeData, addNode, clientId, toast, setEdges]);

  return {
    getConnectedInputs,
    generateContent,
    regenerateContent,
    editImage
  };
}
