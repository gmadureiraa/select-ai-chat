import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Message, Client, Website, Document, ProcessStep, MultiAgentStep, detectImageGenerationRequest } from "@/types/chat";
import { createChatError, getErrorMessage } from "@/lib/errors";
import { validateMessage, validateModelId } from "@/lib/validation";
import { withRetry, RetryError } from "@/lib/retry";
import { parseSSEStream } from "@/lib/sse";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useTemplateReferences } from "@/hooks/useTemplateReferences";
import { useActivities } from "@/hooks/useActivities";
import { useAuth } from "@/hooks/useAuth";
import { useClientKnowledge, formatKnowledgeForContext } from "@/hooks/useClientKnowledge";
import { useWorkspace } from "@/hooks/useWorkspace";
import { 
  GLOBAL_CONTENT_RULES, 
  STORIES_FORMAT_RULES, 
  CAROUSEL_FORMAT_RULES,
  STATIC_POST_FORMAT_RULES,
  TWEET_FORMAT_RULES,
  THREAD_FORMAT_RULES,
  REELS_FORMAT_RULES,
  LINKEDIN_FORMAT_RULES,
  CAPTION_FORMAT_RULES,
  IDEA_MODE_RULES,
  CONTENT_CREATION_RULES,
  detectContentType,
  parseIdeaRequest,
  ContentFormatType,
  TEMPLATE_NAME_TO_CONTENT_TYPE
} from "@/types/template";
import { getPipelineForContentType, PipelineConfig } from "@/types/pipelines";

// Tipos de conteúdo que se beneficiam do pipeline multi-agente
const MULTI_AGENT_CONTENT_TYPES = ["newsletter", "blog_post", "linkedin_post", "thread", "carousel", "stories", "short_video", "long_video", "tweet"];

export const useClientChat = (clientId: string, templateId?: string, conversationIdParam?: string) => {
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<ProcessStep>(null);
  const [multiAgentStep, setMultiAgentStep] = useState<MultiAgentStep>(null);
  const [multiAgentDetails, setMultiAgentDetails] = useState<Record<string, string>>({});
  const [conversationRules, setConversationRules] = useState<string[]>([]);
  const [isIdeaMode, setIsIdeaMode] = useState(false);
  const [isFreeChatMode, setIsFreeChatMode] = useState(false);
  const [workflowState, setWorkflowState] = useState<any>({
    selectedMaterials: [],
    reasoning: "",
    strategy: "",
    patternAnalysis: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivities();
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  // Ativar realtime para mensagens
  useRealtimeMessages(conversationId);

  // Get template references
  const { template, references, isLoading: isLoadingReferences } = useTemplateReferences(templateId);

  // Get client context with all structured data (including identity_guide)
  const { data: client } = useQuery({
    queryKey: ["client-context", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("name, context_notes, identity_guide, social_media, tags, function_templates")
        .eq("id", clientId)
        .single();

      if (error) throw error;
      return {
        ...data,
        social_media: data.social_media as Record<string, string>,
        tags: data.tags as Record<string, string>,
        function_templates: data.function_templates as string[],
      };
    },
    enabled: !!clientId,
  });

  // Get client knowledge from files and identity guide
  const { identityGuide, knowledgeFiles, isLoading: isLoadingKnowledge } = useClientKnowledge(clientId, client?.name);

  // Função auxiliar para detectar feedback
  const detectFeedback = (message: string): boolean => {
    const feedbackPatterns = [
      /não era (bem )?(isso|assim)/i,
      /prefiro/i,
      /mais (informal|formal|curto|longo)/i,
      /menos/i,
      /sempre (use|faça|inclua)/i,
      /nunca (use|faça|inclua)/i,
      /por favor/i,
      /corrija/i,
      /mude/i,
      /altere/i,
    ];
    return feedbackPatterns.some(p => p.test(message));
  };

  // Get specific conversation by ID or get/create default conversation
  const { data: conversation, refetch: refetchConversation } = useQuery({
    queryKey: ["conversation", clientId, templateId, conversationIdParam],
    queryFn: async () => {
      // If specific conversationId provided, load that conversation
      if (conversationIdParam) {
        const { data: specific, error } = await supabase
          .from("conversations")
          .select("*")
          .eq("id", conversationIdParam)
          .single();
        
        if (error) throw error;
        return specific;
      }

      // Try to get existing conversation for this client + template combination
      let query = supabase
        .from("conversations")
        .select("*")
        .eq("client_id", clientId);
      
      // Filter by template_id if provided, or get the general chat (no template)
      if (templateId) {
        query = query.eq("template_id", templateId);
      } else {
        query = query.is("template_id", null);
      }
      
      const { data: existing, error: fetchError } = await query
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        return existing;
      }

      // Create new conversation if none exists
      const { data: newConv, error: createError } = await supabase
        .from("conversations")
        .insert({
          client_id: clientId,
          title: "Nova Conversa",
          model: selectedModel,
          template_id: templateId || null,
        })
        .select()
        .single();

      if (createError) throw createError;
      return newConv;
    },
    enabled: !!clientId,
  });

  useEffect(() => {
    if (conversation) {
      setConversationId(conversation.id);
    }
  }, [conversation]);

  // Start a new conversation
  const startNewConversation = useCallback(async () => {
    const { data: newConv, error } = await supabase
      .from("conversations")
      .insert({
        client_id: clientId,
        title: "Nova Conversa",
        model: selectedModel,
        template_id: templateId || null,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar nova conversa.",
        variant: "destructive",
      });
      return;
    }

    setConversationId(newConv.id);
    queryClient.invalidateQueries({ queryKey: ["conversation-history", clientId] });
  }, [clientId, templateId, selectedModel, toast, queryClient]);

  // Get messages
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
  });

  // Get websites and their scraped content
  const { data: websites = [] } = useQuery({
    queryKey: ["client-websites", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_websites")
        .select("*")
        .eq("client_id", clientId);

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Get documents with extracted content
  const { data: documents = [] } = useQuery({
    queryKey: ["client-documents", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("id, name, file_type, file_path, extracted_content")
        .eq("client_id", clientId);

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Get content library
  const { data: contentLibrary = [] } = useQuery({
    queryKey: ["client-content-library", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_content_library")
        .select("id, title, content_type, content, metadata")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Get reference library
  const { data: referenceLibrary = [] } = useQuery({
    queryKey: ["client-reference-library", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_reference_library")
        .select("id, title, reference_type, content, source_url, metadata")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Get global knowledge base
  const { data: globalKnowledge = [] } = useQuery({
    queryKey: ["global-knowledge", workspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_knowledge")
        .select("id, title, content, category")
        .eq("workspace_id", workspace!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!workspace?.id,
  });

  const sendMessage = useCallback(async (content: string, imageUrls?: string[], quality?: "fast" | "high", explicitMode?: "content" | "ideas" | "free_chat") => {
    // Validações
    const validationError = validateMessage(content);
    if (validationError) {
      toast({
        title: "Erro de validação",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    if (!conversationId || !client) {
      toast({
        title: "Erro",
        description: "Conversa não inicializada.",
        variant: "destructive",
      });
      return;
    }

    if (!validateModelId(selectedModel)) {
      toast({
        title: "Erro",
        description: "Modelo de IA inválido.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setCurrentStep("analyzing");
    
    // Usar modo explícito do toggle - PRIORIDADE sobre auto-detecção
    const isExplicitIdeaMode = explicitMode === "ideas";
    const isFreeChatModeExplicit = explicitMode === "free_chat";
    setIsIdeaMode(isExplicitIdeaMode);
    setIsFreeChatMode(isFreeChatModeExplicit);
    
    console.log("[CHAT] Explicit mode:", explicitMode, "| isExplicitIdeaMode:", isExplicitIdeaMode, "| isFreeChatMode:", isFreeChatModeExplicit);

    try {
      // Save user message
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content,
        image_urls: imageUrls || null,
      });

      if (insertError) throw insertError;

      // DETECTAR PEDIDO DE GERAÇÃO DE IMAGEM
      const imageGenRequest = detectImageGenerationRequest(content);
      
      if (imageGenRequest.isImageRequest) {
        setCurrentStep("generating_image");
        
        try {
          console.log("[CHAT] Image generation detected, prompt:", imageGenRequest.prompt);
          
          // Process attached images as references
          let referenceImages: Array<{ base64: string; description?: string }> = [];
          if (imageUrls && imageUrls.length > 0) {
            console.log("[CHAT] Processing", imageUrls.length, "attached images as references");
            const { processReferenceImages } = await import("@/lib/imageUtils");
            referenceImages = await processReferenceImages(
              imageUrls.map(url => ({ url, description: "Referência do usuário" })),
              3,
              1024
            );
          }
          
          const { data: imageData, error: imageError } = await supabase.functions.invoke("generate-image", {
            body: {
              prompt: imageGenRequest.prompt || content,
              referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
            },
          });

          if (imageError) throw imageError;
          
          if (imageData?.imageUrl) {
            // Salvar resposta com imagem gerada
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: `Imagem gerada com sucesso! 🎨\n\n**Prompt utilizado:** ${imageGenRequest.prompt || content}`,
              image_urls: [imageData.imageUrl],
            });

            // Log activity
            logActivity.mutate({
              activityType: "image_generated",
              entityType: "conversation",
              entityId: conversationId,
              entityName: client.name,
              description: `Imagem gerada no chat de ${client.name}`,
              metadata: { prompt: imageGenRequest.prompt || content },
            });

            queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          } else {
            throw new Error("Nenhuma imagem retornada");
          }
        } catch (imgError: any) {
          console.error("Image generation error:", imgError);
          
          // Salvar mensagem de erro
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: `Não foi possível gerar a imagem. ${imgError.message || "Tente novamente."}`,
          });
          
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        }
        
        setIsLoading(false);
        setCurrentStep(null);
        return;
      }

      // =====================================================
      // FLUXO CHAT LIVRE (conversa com dados reais, nunca inventa)
      // =====================================================
      if (isFreeChatModeExplicit) {
        console.log("[CHAT] MODO CHAT LIVRE - Conversa com dados reais");
        setCurrentStep("analyzing");
        
        // Buscar métricas do cliente (últimos 90 dias para análise completa)
        const { data: metrics } = await supabase
          .from("platform_metrics")
          .select("*")
          .eq("client_id", clientId)
          .order("metric_date", { ascending: false })
          .limit(90);
        
        // Buscar vídeos do YouTube
        const { data: youtubeVideos } = await supabase
          .from("youtube_videos")
          .select("*")
          .eq("client_id", clientId)
          .order("total_views", { ascending: false })
          .limit(20);
        
        // Formatar métricas para contexto com informações mais completas
        const metricsContext = metrics && metrics.length > 0 
          ? `📊 Dados disponíveis para ${[...new Set(metrics.map(m => m.platform))].join(', ')}:\n\n` +
            [...new Set(metrics.map(m => m.platform))].map(platform => {
              const platformMetrics = metrics.filter(m => m.platform === platform);
              const latest = platformMetrics[0];
              const weekAgo = platformMetrics.find((_, i) => i >= 7);
              const monthAgo = platformMetrics.find((_, i) => i >= 30);
              
              let summary = `### ${platform.toUpperCase()}\n`;
              summary += `- Última atualização: ${latest.metric_date}\n`;
              if (latest.subscribers) summary += `- Seguidores: ${latest.subscribers.toLocaleString()}\n`;
              if (latest.views) summary += `- Visualizações: ${latest.views.toLocaleString()}\n`;
              if (latest.likes) summary += `- Curtidas: ${latest.likes.toLocaleString()}\n`;
              if (latest.comments) summary += `- Comentários: ${latest.comments}\n`;
              if (latest.engagement_rate) summary += `- Taxa de engajamento: ${latest.engagement_rate.toFixed(2)}%\n`;
              if (latest.open_rate) summary += `- Taxa de abertura: ${latest.open_rate.toFixed(2)}%\n`;
              if (latest.click_rate) summary += `- Taxa de cliques: ${latest.click_rate.toFixed(2)}%\n`;
              if (latest.total_posts) summary += `- Total de posts: ${latest.total_posts}\n`;
              
              // Calcular totais do período
              const totalViews = platformMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
              const totalLikes = platformMetrics.reduce((sum, m) => sum + (m.likes || 0), 0);
              if (totalViews > 0) summary += `- Views acumuladas (${platformMetrics.length} dias): ${totalViews.toLocaleString()}\n`;
              if (totalLikes > 0) summary += `- Curtidas acumuladas (${platformMetrics.length} dias): ${totalLikes.toLocaleString()}\n`;
              
              // Comparação semanal
              if (weekAgo && latest.subscribers && weekAgo.subscribers) {
                const weekGrowth = latest.subscribers - weekAgo.subscribers;
                const weekGrowthPct = ((weekGrowth / weekAgo.subscribers) * 100).toFixed(2);
                summary += `- Crescimento semanal: ${weekGrowth > 0 ? '+' : ''}${weekGrowth} seguidores (${weekGrowthPct}%)\n`;
              }
              
              // Comparação mensal  
              if (monthAgo && latest.subscribers && monthAgo.subscribers) {
                const monthGrowth = latest.subscribers - monthAgo.subscribers;
                const monthGrowthPct = ((monthGrowth / monthAgo.subscribers) * 100).toFixed(2);
                summary += `- Crescimento mensal: ${monthGrowth > 0 ? '+' : ''}${monthGrowth} seguidores (${monthGrowthPct}%)\n`;
              }
              
              return summary;
            }).join('\n')
          : 'Sem métricas disponíveis';
        
        // Formatar dados de YouTube
        const youtubeContext = youtubeVideos && youtubeVideos.length > 0
          ? `📺 VÍDEOS DO YOUTUBE (Top ${youtubeVideos.length}):\n` +
            youtubeVideos.map((v, i) => 
              `${i + 1}. "${v.title}" - ${v.total_views?.toLocaleString() || 0} views, ${v.watch_hours?.toFixed(1) || 0}h assistidas, +${v.subscribers_gained || 0} inscritos`
            ).join('\n')
          : '';
        
        // Preparar contexto completo com TODOS os dados
        const freeChatContext = `Você é o kAI, assistente de IA especializado para o cliente ${client.name}.

## ⚠️ REGRA CRÍTICA: NUNCA INVENTE DADOS
- Se uma informação não estiver listada abaixo, diga: "Não encontrei essa informação nas fontes disponíveis"
- NUNCA crie números, estatísticas ou dados que não estejam explicitamente fornecidos
- Cite a fonte quando responder (ex: "Segundo a biblioteca de conteúdo...", "Nas métricas de Instagram...")
- Se perguntado sobre algo que não está nas fontes, seja honesto e diga que não tem essa informação

## 📋 IDENTIDADE DO CLIENTE:
${client.identity_guide || client.context_notes || 'Sem guia de identidade cadastrado'}

## 📊 MÉTRICAS DE PERFORMANCE (últimos 90 dias):
${metricsContext}

${youtubeContext}

## 📚 BIBLIOTECA DE CONTEÚDO (${contentLibrary.length} itens):
${contentLibrary.slice(0, 20).map((c, i) => `[${i + 1}] "${c.title}" (${c.content_type})`).join('\n') || 'Biblioteca vazia'}

## 📖 BIBLIOTECA DE REFERÊNCIAS (${referenceLibrary.length} itens):
${referenceLibrary.slice(0, 15).map((r, i) => `[REF ${i + 1}] "${r.title}" (${r.reference_type})`).join('\n') || 'Sem referências'}

## 📄 DOCUMENTOS (${documents.length}):
${documents.map(d => `- ${d.name}: ${d.extracted_content?.substring(0, 200) || 'Sem transcrição'}...`).join('\n') || 'Sem documentos'}

## 🌐 WEBSITES (${websites.length}):
${websites.map(w => `- ${w.url}`).join('\n') || 'Sem websites'}

## 📱 REDES SOCIAIS:
${client.social_media ? Object.entries(client.social_media).filter(([_, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n') : 'Não cadastradas'}

## 🏷️ TAGS:
${client.tags ? Object.entries(client.tags).filter(([_, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n') : 'Sem tags'}

---

INSTRUÇÕES:
- Responda perguntas usando APENAS as informações acima
- Para perguntas sobre métricas, use os dados de MÉTRICAS DE PERFORMANCE
- Para perguntas sobre conteúdo passado, use BIBLIOTECA DE CONTEÚDO
- Seja direto e conciso
- Se não souber, diga que não encontrou a informação`;

        setCurrentStep("creating");

        // Chamar IA diretamente - modelo rápido e barato
        const freeChatMessages = [
          { role: "system", content: freeChatContext },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content }
        ];

        const { data: freeChatData, error: freeChatError } = await supabase.functions.invoke("chat", {
          body: {
            messages: freeChatMessages,
            model: "gemini-2.5-flash-lite", // Modelo mais barato para chat livre
            isSelectionPhase: false,
            userId: user?.id,
            clientId
          },
        });

        if (freeChatError) throw freeChatError;

        // Processar stream usando função utilitária
        const reader = freeChatData.body?.getReader();
        let aiResponse = "";

        if (reader) {
          aiResponse = await parseSSEStream(reader);
        }

        // Salvar resposta
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: aiResponse,
        });

        logActivity.mutate({
          activityType: "message_sent",
          entityType: "conversation",
          entityId: conversationId,
          entityName: client.name,
          description: `Chat livre com ${client.name}`,
          metadata: { 
            model: "gemini-2.5-flash-lite",
            isFreeChatMode: true
          },
        });

        queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        setIsLoading(false);
        setCurrentStep(null);
        return;
      }

      // Detectar tipo de conteúdo para multi-agente (apenas se NÃO estiver em modo ideias)
      const earlyDetectedType = detectContentType(content);
      
      // Usar pipeline multi-agente APENAS quando:
      // 1. NÃO está em modo ideias explícito E
      // 2. (Usuário escolheu "Alta Qualidade" OU é conteúdo longo com modelo premium)
      const shouldUseMultiAgent = !isExplicitIdeaMode && (quality === "high" || (
        MULTI_AGENT_CONTENT_TYPES.includes(earlyDetectedType || "") &&
        (selectedModel.includes("pro") || selectedModel.includes("gpt-5"))
      ));

      if (shouldUseMultiAgent) {
        // Determinar tipo de conteúdo baseado no template ou detecção automática
        let contentTypeForPipeline: string | ContentFormatType | null = earlyDetectedType;
        
        // Se tem template, usar o tipo do template
        if (template?.name) {
          const templateContentType = TEMPLATE_NAME_TO_CONTENT_TYPE[template.name];
          if (templateContentType) {
            contentTypeForPipeline = templateContentType as ContentFormatType;
            console.log("[CHAT] Using template content type:", templateContentType);
          }
        }
        
        // Obter pipeline específico para o tipo de conteúdo
        const pipeline = getPipelineForContentType(contentTypeForPipeline);
        console.log("[CHAT] Using pipeline:", pipeline.name, "for content type:", contentTypeForPipeline);
        console.log("[CHAT] Pipeline agents:", pipeline.agents.map(a => a.id).join(" → "));
        
        setCurrentStep("multi_agent");
        setMultiAgentStep(pipeline.agents[0]?.id as any || "researcher");
        setMultiAgentDetails({ [pipeline.agents[0]?.id || "researcher"]: `${pipeline.agents[0]?.description || "Iniciando"}...` });

        try {
          // Buscar guia de copywriting do cliente (de knowledgeFiles se disponível)
          const copywritingEntry = Object.entries(knowledgeFiles || {}).find(([name]) => 
            name.toLowerCase().includes("copywriting") || name.toLowerCase().includes("guia")
          );
          const copywritingGuide = copywritingEntry ? copywritingEntry[1] : "";

          const { data, error } = await supabase.functions.invoke("chat-multi-agent", {
            body: {
              userMessage: content,
              contentLibrary: contentLibrary.slice(0, 20).map(c => ({
                id: c.id,
                title: c.title,
                content_type: c.content_type,
                content: c.content
              })),
              referenceLibrary: referenceLibrary.slice(0, 10).map(r => ({
                id: r.id,
                title: r.title,
                reference_type: r.reference_type,
                content: r.content
              })),
              identityGuide: identityGuide || client.identity_guide || "",
              copywritingGuide,
              clientName: client.name,
              contentType: contentTypeForPipeline,
              userId: user?.id,
              clientId,
              pipeline // Enviar configuração do pipeline para o edge function
            },
          });

          if (error) throw error;

          // Processar stream de progresso
          const reader = data.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let finalContent = "";

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;

                const jsonStr = trimmed.slice(6);
                if (jsonStr === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(jsonStr);
                  const { step, status, content: stepContent, agentName } = parsed;

                  // Atualizar progresso visual
                  if (step && status) {
                    if (step === "complete" && status === "done") {
                      finalContent = stepContent || "";
                      setMultiAgentStep("complete");
                    } else if (step === "error") {
                      throw new Error(stepContent || "Erro no pipeline");
                    } else {
                      setMultiAgentStep(step as any);
                      if (stepContent || agentName) {
                        setMultiAgentDetails(prev => ({
                          ...prev,
                          [step]: stepContent || agentName || step
                        }));
                      }
                    }
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }

          // Salvar resposta final
          if (finalContent) {
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: finalContent,
            });

            // Log activity
            logActivity.mutate({
              activityType: "message_sent",
              entityType: "conversation",
              entityId: conversationId,
              entityName: client.name,
              description: `Conteúdo gerado via ${pipeline.name} para ${client.name}`,
              metadata: { 
                model: "multi-agent-pipeline",
                pipelineId: pipeline.id,
                pipelineName: pipeline.name,
                agentCount: pipeline.agents.length,
                contentType: contentTypeForPipeline,
                responseLength: finalContent.length
              },
            });

            queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          }
        } catch (multiAgentError: any) {
          console.error("Multi-agent pipeline error:", multiAgentError);
          
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: `Erro no pipeline multi-agente: ${multiAgentError.message || "Tente novamente."}`,
          });
          
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        }
        
        setIsLoading(false);
        setCurrentStep(null);
        setMultiAgentStep(null);
        return;
      }

      // =====================================================
      // FLUXO SIMPLIFICADO PARA IDEIAS (toggle explícito)
      // =====================================================
      if (isExplicitIdeaMode) {
        console.log("[CHAT] MODO IDEIAS EXPLÍCITO - Fluxo simplificado");
        setCurrentStep("selecting");
        
        // Gerar pelo menos 3 ideias (mínimo), pode pedir mais
        const requestedQuantity = Math.max(3, parseIdeaRequest(content).quantity || 3);
        
        // Preparar contexto simplificado com biblioteca
        const libraryContext = contentLibrary.slice(0, 15).map((c, i) => 
          `[${i + 1}] ${c.title} (${c.content_type}): "${c.content.substring(0, 300)}..."`
        ).join('\n\n');
        
        const referenceContext = referenceLibrary.slice(0, 10).map((r, i) => 
          `[REF ${i + 1}] ${r.title} (${r.reference_type}): "${r.content.substring(0, 200)}..."`
        ).join('\n\n');

        setCurrentStep("analyzing_library");
        
        // Prompt DIRETO para geração de ideias
        const ideaSystemPrompt = `Você é o kAI, assistente de criação de conteúdo da Kaleidos para o cliente ${client.name}.

## 🎯 TAREFA: GERAR ${requestedQuantity} IDEIAS NOVAS DE CONTEÚDO

${client.identity_guide ? `## 📋 IDENTIDADE DO CLIENTE:\n${client.identity_guide.substring(0, 1500)}\n` : ''}

## 📚 BIBLIOTECA DE CONTEÚDO DO CLIENTE (TEMAS QUE ELE TRABALHA):

${contentLibrary.length === 0 ? 'ATENÇÃO: Biblioteca vazia! Sugira ideias genéricas para o nicho do cliente.' : libraryContext}

${referenceLibrary.length > 0 ? `## 📖 REFERÊNCIAS DE ESTILO:\n${referenceContext}` : ''}

## INSTRUÇÕES OBRIGATÓRIAS:

1. **ANALISE OS TEMAS**: Veja sobre o que o cliente fala na biblioteca acima
2. **CRIE IDEIAS NOVAS**: As ideias devem ser sobre os MESMOS TEMAS, mas com ângulos NOVOS
3. **NÃO COPIE**: Nunca repita ideias que já existem na biblioteca
4. **SEJA CONCISO**: Cada ideia deve ter máximo 2-3 linhas

## FORMATO DE RESPOSTA (OBRIGATÓRIO):

**Ideia 1: [Título curto - máx 8 palavras]**
[Descrição em 1-2 frases explicando o conceito]

**Ideia 2: [Título curto]**
[Descrição breve]

... (até ${requestedQuantity} ideias)

## REGRAS:
- Gere EXATAMENTE ${requestedQuantity} ideias
- Ideias devem ser sobre os temas que o cliente trabalha
- Cada ideia deve ser diferente das outras
- NÃO desenvolva conteúdo completo
- NÃO use emojis nos títulos`;

        setCurrentStep("creating");

        // Chamar IA diretamente para ideias
        const ideaMessages = [
          { role: "system", content: ideaSystemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content }
        ];

        const { data: ideaData, error: ideaError } = await supabase.functions.invoke("chat", {
          body: {
            messages: ideaMessages,
            model: "gemini-2.5-flash", // Modelo rápido para ideias
            isSelectionPhase: false,
            userId: user?.id,
            clientId
          },
        });

        if (ideaError) throw ideaError;

        // Processar stream usando função utilitária
        const reader = ideaData.body?.getReader();
        let aiResponse = "";

        if (reader) {
          aiResponse = await parseSSEStream(reader);
        }

        // Salvar resposta
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: aiResponse,
        });

        logActivity.mutate({
          activityType: "message_sent",
          entityType: "conversation",
          entityId: conversationId,
          entityName: client.name,
          description: `${requestedQuantity} ideias geradas para ${client.name}`,
          metadata: { 
            model: "gemini-2.5-flash",
            isIdeaMode: true,
            requestedQuantity
          },
        });

        queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        setIsLoading(false);
        setCurrentStep(null);
        return;
      }

      // =====================================================
      // FLUXO NORMAL PARA CRIAÇÃO DE CONTEÚDO
      // =====================================================
      console.log("[CHAT] MODO CONTEÚDO - Fluxo completo");
      
      // FASE 1: Análise e seleção de materiais relevantes (biblioteca + documentos)
      setCurrentStep("analyzing");
      
      // Preparar lista completa de materiais disponíveis
      const availableMaterials = [
        // Conteúdos da biblioteca (com preview do conteúdo)
        ...contentLibrary.map(c => ({
          id: c.id,
          type: 'content_library',
          category: c.content_type,
          title: c.title,
          preview: c.content.substring(0, 300),
          hasFullContent: true
        })),
        // Documentos do storage
        ...documents.map(d => ({
          id: d.id,
          type: 'document',
          category: d.file_type,
          title: d.name,
          preview: d.extracted_content 
            ? `${d.name}: ${d.extracted_content.substring(0, 250)}...` 
            : `Documento: ${d.name} (sem transcrição)`,
          hasFullContent: !!d.extracted_content,
          content: d.extracted_content
        })),
        // Biblioteca de Referências
        ...referenceLibrary.map(r => ({
          id: r.id,
          type: 'reference_library',
          category: r.reference_type,
          title: r.title,
          preview: `${r.reference_type.toUpperCase()}: ${r.content.substring(0, 250)}`,
          hasFullContent: true,
          source_url: r.source_url
        }))
      ];

      // Detectar tipo de conteúdo para seleção
      const selectionDetectedType = detectContentType(content);
      
      // System message para seleção inteligente (APENAS PARA CONTEÚDO)
      const selectionSystemMessage = `Você é o kAI, assistente especializado da Kaleidos para o cliente ${client.name}.

## ⚠️ INSTRUÇÃO OBRIGATÓRIA
Você DEVE usar a função select_relevant_content para selecionar materiais da biblioteca.

## MODO CRIAÇÃO DE CONTEÚDO

OBJETIVO: Entender o ESTILO de escrita do cliente para replicá-lo.

ANALISE A BIBLIOTECA ABAIXO:
- Qual é o TOM de voz? (informal, formal, poético, direto)
- Qual é a ESTRUTURA dos conteúdos?
- Quais palavras e expressões são características?

SELECIONE: 3-5 exemplos que mostrem o ESTILO de escrita.
O conteúdo gerado deve PARECER com esses exemplos.

## BIBLIOTECA DE CONTEÚDO DO CLIENTE (${contentLibrary.length} itens):

${contentLibrary.length === 0 ? 'ATENÇÃO: Biblioteca vazia! Selecione analysis_needed: false' : contentLibrary.slice(0, 15).map((c, i) => `
### [${i + 1}] ${c.title}
- ID: ${c.id}
- Tipo: ${c.content_type}
- Conteúdo: "${c.content.substring(0, 400)}..."
`).join('\n')}

## BIBLIOTECA DE REFERÊNCIAS (${referenceLibrary.length} itens):

${referenceLibrary.length === 0 ? 'Sem referências cadastradas' : referenceLibrary.slice(0, 10).map((r, i) => `
### [REF ${i + 1}] ${r.title}
- ID: ${r.id}
- Tipo: ${r.reference_type}
- Conteúdo: "${r.content.substring(0, 300)}..."
`).join('\n')}

## DOCUMENTOS (${documents.length} itens):
${documents.length === 0 ? 'Sem documentos' : documents.map(d => `- ${d.name} (${d.file_type})`).join('\n')}

---
AGORA CHAME A FUNÇÃO select_relevant_content com:
- detected_content_type: "${selectionDetectedType || 'general'}"
- selected_references: array com IDs dos materiais relevantes (mínimo 3 se disponível)
- analysis_needed: ${contentLibrary.length > 0 || referenceLibrary.length > 0 ? 'true' : 'false'}
- use_context_notes: ${client.context_notes ? 'true' : 'false'}
- use_websites: ${websites.length > 0 ? 'true' : 'false'}
- strategy: "follow_structure" ou "adapt_tone"
- reasoning: explique brevemente porque selecionou esses materiais`;

      // Histórico completo de mensagens para contexto
      const selectionMessages = [
        { role: "system", content: selectionSystemMessage },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: `TAREFA: Analise a biblioteca acima e use a função select_relevant_content para selecionar materiais relevantes para: "${content}"` }
      ];

      // USAR MODELO BARATO para seleção
      const { data: selectionData, error: selectionError } = await supabase.functions.invoke("chat", {
        body: {
          messages: selectionMessages,
          model: "gemini-2.5-flash-lite", // Modelo mais barato e rápido
          isSelectionPhase: true,
          availableMaterials,
          userId: user?.id,
          clientId
        },
      });

      if (selectionError) throw selectionError;

      const selection = selectionData.selection;
      console.log("Materials selected:", selection);

      // Atualizar workflow state com materiais selecionados
      setWorkflowState({
        selectedMaterials: selection.selected_references || [],
        reasoning: selection.reasoning || "",
        strategy: selection.strategy || "",
        patternAnalysis: ""
      });

      // FASE 2: Análise de padrões (se necessário)
      let patternAnalysis = null;
      
      if (selection.analysis_needed && selection.selected_references?.length > 0) {
        setCurrentStep("analyzing_library");
        
        // Buscar conteúdos completos selecionados (biblioteca + referências)
        const selectedContents = selection.selected_references
          .map((ref: any) => {
            if (ref.type === 'content_library') {
              const content = contentLibrary.find(c => c.id === ref.id);
              return content ? {
                title: content.title,
                content_type: content.content_type,
                content: content.content,
                reason: ref.reason
              } : null;
            } else if (ref.type === 'reference_library') {
              const reference = referenceLibrary.find(r => r.id === ref.id);
              return reference ? {
                title: reference.title,
                content_type: `reference_${reference.reference_type}`,
                content: reference.content,
                source_url: reference.source_url,
                reason: ref.reason
              } : null;
            }
            return null;
          })
          .filter(Boolean);

        if (selectedContents.length > 0) {
          // Criar prompt de análise de padrões (apenas para modo conteúdo - o modo ideias usa fluxo separado)
          const analysisPrompt = `Analise os seguintes conteúdos de REFERÊNCIA do cliente ${client.name} para extrair PADRÕES DE ESCRITA:

## REFERÊNCIAS DE ESTILO:
${selectedContents.map((c: any, idx: number) => `
### ${idx + 1}. ${c.title} (${c.content_type})
${c.source_url ? `**Fonte:** ${c.source_url}\n` : ''}
${c.content}
---
`).join('\n')}

## EXTRAIA OS PADRÕES DE ESCRITA:

### 1. TOM DE VOZ
- Formal ou informal?
- Uso de "você" ou "vocês"?
- Primeira pessoa (eu/nós) ou terceira pessoa?
- Estilo: didático, provocativo, inspiracional, técnico?

### 2. ESTRUTURA
- Como começa os conteúdos? (gancho, pergunta, afirmação)
- Como desenvolve o argumento?
- Como termina? (CTA, reflexão, provocação)

### 3. ELEMENTOS DE ESTILO
- Usa emojis? Com que frequência?
- Tamanho típico dos parágrafos
- Usa listas, bullets, numeração?
- Frases curtas ou longas?

### 4. VOCABULÁRIO CARACTERÍSTICO
- Palavras e expressões que se repetem
- Jargões ou termos específicos
- Bordões ou frases marcantes

### 5. REGRAS PARA REPLICAR
Liste as 5 regras mais importantes para ESCREVER IGUAL a este cliente:
1. [regra]
2. [regra]
...

IMPORTANTE: O novo conteúdo deve parecer escrito pelo mesmo autor.`;

          const analysisMessages = [
            { role: "system", content: "Você é um especialista em análise de padrões de conteúdo." },
            { role: "user", content: analysisPrompt }
          ];

          // Chamar IA para análise
          const { data: analysisData, error: analysisError } = await supabase.functions.invoke("chat", {
            body: {
              messages: analysisMessages,
              model: "gemini-2.5-flash",
              isSelectionPhase: false,
              userId: user?.id,
              clientId
            },
          });

          if (!analysisError && analysisData?.body) {
            const reader = analysisData.body.getReader();
            const analysisText = await parseSSEStream(reader);

            patternAnalysis = analysisText;
            console.log("Pattern analysis completed:", analysisText.substring(0, 200));
            
            // Atualizar workflow state com análise de padrões
            setWorkflowState((prev: any) => ({
              ...prev,
              patternAnalysis: analysisText
            }));
          }
        }
      }

      // FASE 3: Carregar documentos e preparar contexto enriquecido
      setCurrentStep("reviewing");

      // Build enriched context with pattern analysis
      // Start with identity guide as the FIRST thing (most important context)
      // Include documents with extracted content
      const docsWithContent = documents.filter(d => d.extracted_content).map(d => ({
        id: d.id,
        name: d.name,
        file_type: d.file_type,
        extracted_content: d.extracted_content
      }));
      
      const knowledgeContext = formatKnowledgeForContext(
        identityGuide || client.identity_guide || null, 
        knowledgeFiles,
        docsWithContent
      );

      let contextParts = [
        `# Identidade kAI - Assistente Estratégico para ${client.name}`,
        ``,
        `Você é o kAI, assistente de IA especializado em marketing digital da Kaleidos.`,
        ``
      ];

      // Add identity guide and knowledge files FIRST (highest priority context)
      if (knowledgeContext) {
        contextParts.push(knowledgeContext);
        contextParts.push(``);
      }

      // Add global knowledge base (content creation knowledge)
      if (globalKnowledge.length > 0) {
        contextParts.push(`## 📚 BASE DE CONHECIMENTO (Técnicas de Criação de Conteúdo)`);
        contextParts.push(``);
        globalKnowledge.forEach((k) => {
          contextParts.push(`### ${k.title} [${k.category}]`);
          contextParts.push(k.content.substring(0, 2000)); // Limitar para não sobrecarregar
          contextParts.push(``);
        });
      }

      contextParts.push(`## 🎯 INFORMAÇÕES SELECIONADAS PARA ESTA TAREFA`);
      contextParts.push(``);
      contextParts.push(`**Raciocínio da Seleção:** ${selection.reasoning}`);
      contextParts.push(`**Estratégia:** ${selection.strategy || 'Seguir padrões estabelecidos'}`);
      contextParts.push(``);

      // Detectar se usuário está pedindo ideias de forma inteligente
      const ideaRequest = parseIdeaRequest(content);
      const isAskingForIdeas = ideaRequest.isIdea;
      const requestedQuantity = ideaRequest.quantity || 5;

      // Detectar tipo de conteúdo automaticamente
      const detectedType = ideaRequest.contentType || detectContentType(content) || selection.detected_content_type;

      // Se é pedido de IDEIAS, aplicar regras específicas de ideias
      if (isAskingForIdeas) {
        // Adicionar regras específicas de ideias
        contextParts.push(IDEA_MODE_RULES);
        contextParts.push(``);
        contextParts.push(`**⚡ QUANTIDADE SOLICITADA:** ${requestedQuantity} ideias`);
        if (detectedType) {
          contextParts.push(`**📋 TIPO DE CONTEÚDO:** ${detectedType}`);
        }
        contextParts.push(``);
        
        // Adicionar análise de temas SE disponível
        if (patternAnalysis) {
          contextParts.push(`## 📊 ANÁLISE DOS TEMAS DO CLIENTE`);
          contextParts.push(``);
          contextParts.push(`**IMPORTANTE:** Use esta análise para criar ideias sobre os MESMOS TEMAS:`);
          contextParts.push(``);
          contextParts.push(patternAnalysis);
          contextParts.push(``);
          contextParts.push(`**INSTRUÇÕES CRÍTICAS PARA IDEIAS:**`);
          contextParts.push(`1. CRIE ideias sobre os TEMAS identificados acima`);
          contextParts.push(`2. NÃO sugira ideias sobre temas FORA do nicho do cliente`);
          contextParts.push(`3. CRIE variações NOVAS - não repita as ideias existentes`);
          contextParts.push(`4. Cada ideia deve ser DIFERENTE das outras`);
          contextParts.push(`5. Mantenha-se no POSICIONAMENTO do cliente`);
          contextParts.push(``);
        }
        
        // IMPORTANTE: Instruir sobre uso da biblioteca como inspiração
        if (selection.selected_references?.length > 0) {
          contextParts.push(`## 📚 BIBLIOTECA DO CLIENTE (TEMAS DE REFERÊNCIA)`);
          contextParts.push(``);
          contextParts.push(`Os conteúdos abaixo mostram os TEMAS que o cliente trabalha.`);
          contextParts.push(`CRIE ideias NOVAS sobre estes mesmos temas:`);
          contextParts.push(``);
        }
      } else {
        // MODO CRIAÇÃO DE CONTEÚDO
        contextParts.push(CONTENT_CREATION_RULES);
        contextParts.push(``);
        
        // REGRAS GLOBAIS DE CONTEÚDO
        contextParts.push(`## REGRAS GLOBAIS DE CONTEÚDO`);
        contextParts.push(``);
        contextParts.push(`- ${GLOBAL_CONTENT_RULES.emoji}`);
        contextParts.push(`- ${GLOBAL_CONTENT_RULES.clarity}`);
        contextParts.push(`- ${GLOBAL_CONTENT_RULES.specificity}`);
        contextParts.push(`- ${GLOBAL_CONTENT_RULES.hook}`);
        contextParts.push(`- ${GLOBAL_CONTENT_RULES.cta}`);
        contextParts.push(`- ${GLOBAL_CONTENT_RULES.value}`);
        contextParts.push(``);

        // Aplicar regras específicas do formato detectado
        if (detectedType === "stories" || content.toLowerCase().includes("storie")) {
          contextParts.push(STORIES_FORMAT_RULES);
          contextParts.push(``);
        } else if (detectedType === "carousel" || content.toLowerCase().includes("carrossel")) {
          contextParts.push(CAROUSEL_FORMAT_RULES);
          contextParts.push(``);
        } else if (detectedType === "static_image" || content.toLowerCase().includes("post estático")) {
          contextParts.push(STATIC_POST_FORMAT_RULES);
          contextParts.push(``);
        } else if (detectedType === "tweet" || (content.toLowerCase().includes("tweet") && !content.toLowerCase().includes("thread"))) {
          contextParts.push(TWEET_FORMAT_RULES);
          contextParts.push(``);
        } else if (detectedType === "thread" || content.toLowerCase().includes("thread")) {
          contextParts.push(THREAD_FORMAT_RULES);
          contextParts.push(``);
        } else if (detectedType === "short_video" || 
                   content.toLowerCase().includes("reel") || content.toLowerCase().includes("tiktok")) {
          contextParts.push(REELS_FORMAT_RULES);
          contextParts.push(``);
        } else if (detectedType === "linkedin_post" || content.toLowerCase().includes("linkedin")) {
          contextParts.push(LINKEDIN_FORMAT_RULES);
          contextParts.push(``);
        } else if (detectedType === "newsletter" || detectedType === "blog_post" || 
                   content.toLowerCase().includes("legenda")) {
          contextParts.push(CAPTION_FORMAT_RULES);
          contextParts.push(``);
        }
        
        // Adicionar análise de padrões de ESTILO SE disponível
        if (patternAnalysis) {
          contextParts.push(`## 📊 ANÁLISE DE ESTILO DO CLIENTE`);
          contextParts.push(``);
          contextParts.push(`**IMPORTANTE:** ESCREVA seguindo o estilo identificado abaixo:`);
          contextParts.push(``);
          contextParts.push(patternAnalysis);
          contextParts.push(``);
          contextParts.push(`**INSTRUÇÕES CRÍTICAS PARA ESCRITA:**`);
          contextParts.push(`1. SIGA a estrutura e organização identificada`);
          contextParts.push(`2. MANTENHA o tom de voz característico`);
          contextParts.push(`3. USE o vocabulário e expressões do cliente`);
          contextParts.push(`4. COPIE o estilo, não o conteúdo`);
          contextParts.push(`5. O resultado deve parecer escrito pelo mesmo autor`);
          contextParts.push(``);
        }
      }

      // Incluir regras aprendidas nesta conversa
      if (conversationRules.length > 0) {
        contextParts.push("## ⚠️ REGRAS APRENDIDAS NESTA CONVERSA:");
        contextParts.push("**Aplique SEMPRE estas diretrizes do usuário:**");
        conversationRules.forEach((rule, idx) => {
          contextParts.push(`${idx + 1}. ${rule}`);
        });
        contextParts.push('');
      }

      // Add context notes only if selected
      if (selection.use_context_notes && client.context_notes) {
        contextParts.push(`## 📋 Contexto do Cliente:`);
        contextParts.push(client.context_notes);
        contextParts.push('');
      }

      // Add function templates if they exist
      const templates = client.function_templates as string[] | undefined;
      if (templates && templates.length > 0) {
        contextParts.push("## 🔧 Funções e Padrões Recorrentes:");
        contextParts.push("**SEMPRE consulte e siga estes padrões ao criar conteúdo:**");
        templates.forEach((template, idx) => {
          contextParts.push(`${idx + 1}. ${template}`);
        });
        contextParts.push('');
      }

      // Add template rules and references if template is being used
      if (template && !isLoadingReferences) {
        contextParts.push(`## 📝 Template Específico: "${template.name}"`);
        contextParts.push("**REGRAS CRÍTICAS - SEMPRE SEGUIR:**");
        contextParts.push('');

        // Add text rules
        if (references.textRules.length > 0) {
          contextParts.push("### Diretrizes Textuais:");
          references.textRules.forEach((rule, idx) => {
            contextParts.push(`${idx + 1}. ${rule}`);
          });
          contextParts.push('');
        }

        // Add image references
        if (references.imageReferences.length > 0) {
          contextParts.push("### 🎨 Referências Visuais:");
          contextParts.push("**IMPORTANTE:** Essas são imagens de referência disponíveis:");
          references.imageReferences.forEach((ref, idx) => {
            contextParts.push(`${idx + 1}. ${ref.description}`);
            contextParts.push(`   URL: ${ref.url}`);
          });
          contextParts.push('');
          contextParts.push("Ao discutir design, estilo visual ou elementos gráficos, considere essas referências.");
          contextParts.push('');
        }

        // Add content references with full content
        if (references.contentReferences.length > 0) {
          contextParts.push("### 📄 Referências de Estrutura e Linguagem:");
          contextParts.push("**IMPORTANTE:** Use estes exemplos APENAS para entender:");
          contextParts.push("- Estrutura e organização do conteúdo");
          contextParts.push("- Tom de voz e estilo de linguagem");
          contextParts.push("- Formato e apresentação");
          contextParts.push("**NÃO COPIE** o tema, assunto ou informações específicas.");
          contextParts.push('');

          references.contentReferences.forEach((ref, idx) => {
            contextParts.push(`#### Referência ${idx + 1}: ${ref.description}`);
            contextParts.push('```');
            contextParts.push(ref.content);
            contextParts.push('```');
            contextParts.push('');
          });
        }
      }

      if (client.tags && Object.values(client.tags).some(v => v)) {
        contextParts.push("## 🎯 Informações Estratégicas do Cliente:");
        if (client.tags.segment) contextParts.push(`**Segmento:** ${client.tags.segment}`);
        if (client.tags.tone) contextParts.push(`**Tom de Voz:** ${client.tags.tone}`);
        if (client.tags.objectives) contextParts.push(`**Objetivos:** ${client.tags.objectives}`);
        if (client.tags.audience) contextParts.push(`**Público-Alvo:** ${client.tags.audience}`);
        contextParts.push('');
      }

      // Add selected resources
      if (selection.use_websites && websites.length > 0) {
        contextParts.push("## 🌐 Websites Selecionados:");
        websites.forEach(w => {
          contextParts.push(`### ${w.url}`);
          if (w.scraped_markdown) {
            contextParts.push(w.scraped_markdown.substring(0, 4000));
          }
          contextParts.push('');
        });
      }

      // Add selected content library items (full content)
      if (selection.selected_references && selection.selected_references.length > 0) {
        const contentRefs = selection.selected_references.filter((ref: any) => ref.type === 'content_library');
        
        if (contentRefs.length > 0) {
          contextParts.push(`## 📚 CONTEÚDOS DA BIBLIOTECA SELECIONADOS:`);
          contextParts.push(``);
          contextParts.push(`Os seguintes conteúdos foram identificados como referências relevantes:`);
          contextParts.push(``);
          
          contentRefs.forEach((ref: any) => {
            const content = contentLibrary.find(c => c.id === ref.id);
            if (content) {
              contextParts.push(`### ${content.title} (${content.content_type}) - Prioridade: ${ref.priority}`);
              contextParts.push(`**Por que foi selecionado:** ${ref.reason}`);
              contextParts.push(``);
              contextParts.push('```');
              contextParts.push(content.content);
              contextParts.push('```');
              contextParts.push(``);
            }
          });
        }

        // Add selected documents
        const docRefs = selection.selected_references.filter((ref: any) => ref.type === 'document');
        if (docRefs.length > 0) {
          contextParts.push(`## 📄 Documentos Selecionados:`);
          docRefs.forEach((ref: any) => {
            const doc = documents.find(d => d.id === ref.id);
            if (doc) {
              contextParts.push(`### ${doc.name}`);
              contextParts.push(`**Por que foi selecionado:** ${ref.reason}`);
              contextParts.push(`Tipo: ${doc.file_type}`);
              contextParts.push(``);
            }
          });
        }
      }

      // Always add social media and tags for consistency
      if (client.social_media && Object.values(client.social_media).some(v => v)) {
        contextParts.push("## 📱 Redes Sociais:");
        if (client.social_media.instagram) contextParts.push(`- Instagram: ${client.social_media.instagram}`);
        if (client.social_media.linkedin) contextParts.push(`- LinkedIn: ${client.social_media.linkedin}`);
        if (client.social_media.facebook) contextParts.push(`- Facebook: ${client.social_media.facebook}`);
        if (client.social_media.twitter) contextParts.push(`- Twitter: ${client.social_media.twitter}`);
        contextParts.push('');
      }

      // FASE 4: Criar resposta contextualizada
      setCurrentStep("creating");

      const systemMessage = contextParts.join("\n");

      // IMPORTANTE: Sempre enviar histórico COMPLETO da conversa
      const messagesWithContext = [
        { role: "system" as const, content: systemMessage },
        ...messages.map((m) => {
          const msg: any = { role: m.role, content: m.content };
          // Add image URLs for multimodal support
          if (m.image_urls && m.image_urls.length > 0) {
            msg.image_urls = m.image_urls;
          }
          return msg;
        }),
        { 
          role: "user" as const, 
          content,
          ...(imageUrls && imageUrls.length > 0 ? { image_urls: imageUrls } : {})
        },
      ];

      // USAR MODELO MELHOR para resposta final (gpt-5-mini se selecionado mini/nano, ou manter o escolhido)
      const responseModel = selectedModel === "gpt-5-nano-2025-08-07" || selectedModel === "gpt-5-mini-2025-08-07"
        ? "gpt-5-mini-2025-08-07" 
        : selectedModel;

      // Call AI com retry automático
      const { data, error } = await withRetry(
        () =>
          supabase.functions.invoke("chat", {
            body: {
              messages: messagesWithContext,
              model: responseModel, // Modelo melhor para resposta
              isSelectionPhase: false, // Fase de resposta
              userId: user?.id,
              clientId
            },
          }),
        {
          maxRetries: 3,
          initialDelay: 1000,
          backoffFactor: 2,
        }
      );

      if (error) throw error;

      // Processar stream usando função utilitária
      const reader = data.body?.getReader();
      let aiResponse = "";

      if (reader) {
        aiResponse = await parseSSEStream(reader);
      }

      // Save AI response
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: aiResponse,
      });

      // Log activity
      logActivity.mutate({
        activityType: "message_sent",
        entityType: "conversation",
        entityId: conversationId,
        entityName: client.name,
        description: `Mensagem enviada no chat de ${client.name}`,
        metadata: { 
          model: responseModel,
          hasImages: (imageUrls && imageUrls.length > 0) || false,
          messageLength: content.length,
          responseLength: aiResponse.length
        },
      });

      // Detectar feedback na mensagem do usuário (próxima implementação)
      // TODO: Implementar detecção de feedback e extração de regras
      const hasFeedback = detectFeedback(content);
      if (hasFeedback) {
        console.log("Feedback detected in message, future implementation will extract rules");
      }

      // Não precisa invalidar - realtime vai atualizar automaticamente
    } catch (error) {
      console.error("Error sending message:", error);
      
      let errorMessage = "Não foi possível enviar a mensagem";
      
      if (error instanceof RetryError) {
        errorMessage = `Falha após ${error.attempts} tentativas. ${error.lastError.message}`;
      } else {
        const chatError = createChatError(error, "Não foi possível enviar a mensagem");
        errorMessage = getErrorMessage(chatError);
      }
      
      toast({
        title: "Erro ao enviar mensagem",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });

      // Remover mensagem do usuário em caso de erro
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    } finally {
      setIsLoading(false);
      setCurrentStep(null);
    }
  }, [conversationId, client, selectedModel, messages, websites, documents, template, references, isLoadingReferences, queryClient, toast]);

  const regenerateLastMessage = useCallback(async () => {
    if (!messages.length || messages[messages.length - 1].role !== "assistant") {
      toast({
        title: "Erro",
        description: "Não há resposta para regenerar.",
        variant: "destructive",
      });
      return;
    }

    // Deletar última mensagem da IA
    const lastMessage = messages[messages.length - 1];
    await supabase
      .from("messages")
      .delete()
      .eq("id", lastMessage.id || "");

    // Pegar última mensagem do usuário
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m) => m.role === "user");

    if (lastUserMessage) {
      // Reenviar
      await sendMessage(lastUserMessage.content);
    }
  }, [messages, sendMessage, toast]);

  const clearConversation = useCallback(async () => {
    if (!conversationId) return;

    try {
      // Delete all messages
      await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", conversationId);

      // Invalidate messages query to refresh
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });

      toast({
        title: "Conversa limpa",
        description: "Todas as mensagens foram removidas.",
      });
    } catch (error) {
      console.error("Error clearing conversation:", error);
      toast({
        title: "Erro ao limpar conversa",
        description: "Não foi possível limpar a conversa.",
        variant: "destructive",
      });
    }
  }, [conversationId, queryClient, toast]);

  return {
    messages,
    isLoading,
    currentStep,
    multiAgentStep,
    multiAgentDetails,
    selectedModel,
    conversationRules,
    workflowState,
    isIdeaMode,
    isFreeChatMode,
    conversationId,
    setSelectedModel,
    sendMessage,
    regenerateLastMessage,
    clearConversation,
    startNewConversation,
  };
};
