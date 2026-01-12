import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Message, Client, Website, Document, ProcessStep, MultiAgentStep, detectImageGenerationRequest, extractLastRelevantContent } from "@/types/chat";
import { detectContextualReference } from "@/hooks/useContextualReference";
import { autoDetectImageFormat } from "@/hooks/useAutoImageFormat";
import { createChatError, getErrorMessage } from "@/lib/errors";
import { validateMessage, validateModelId } from "@/lib/validation";
import { withRetry, RetryError } from "@/lib/retry";
import { parseSSEStream } from "@/lib/sse";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useTemplateReferences } from "@/hooks/useTemplateReferences";
import { useActivities } from "@/hooks/useActivities";
import { useAuth } from "@/hooks/useAuth";
import { useClientKnowledge, formatKnowledgeForContext } from "@/hooks/useClientKnowledge";
import { useCitationParser, ParsedCitation } from "@/hooks/useCitationParser";
import { Citation } from "@/components/chat/CitationChip";
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
  TEMPLATE_NAME_TO_CONTENT_TYPE,
  detectImageFormat,
  getImageFormatSpec
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
  const { fetchCitationContents, formatCitationsForContext } = useCitationParser();
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

  // Get or create THE SINGLE default conversation for this client
  // Each client has ONLY ONE main conversation (template_id = null)
  const { data: conversation, refetch: refetchConversation } = useQuery({
    queryKey: ["conversation", clientId, "default"],
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

      // Template-specific conversation (for template flows)
      if (templateId) {
        const { data: templateConv, error: templateError } = await supabase
          .from("conversations")
          .select("*")
          .eq("client_id", clientId)
          .eq("template_id", templateId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (templateError) throw templateError;

        if (templateConv) return templateConv;

        // Create template-specific conversation if not exists
        const { data: newTemplateConv, error: createError } = await supabase
          .from("conversations")
          .insert({
            client_id: clientId,
            title: "Template Chat",
            model: selectedModel,
            template_id: templateId,
          })
          .select()
          .single();

        if (createError) throw createError;
        return newTemplateConv;
      }

      // Get THE SINGLE main conversation (template_id IS NULL)
      // IMPORTANT: Order by created_at ASC to always get the FIRST one created
      const { data: existing, error: fetchError } = await supabase
        .from("conversations")
        .select("*")
        .eq("client_id", clientId)
        .is("template_id", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        return existing;
      }

      // Create the single main conversation if none exists
      const { data: newConv, error: createError } = await supabase
        .from("conversations")
        .insert({
          client_id: clientId,
          title: "Chat Principal",
          model: selectedModel,
          template_id: null,
        })
        .select()
        .single();

      if (createError) throw createError;
      return newConv;
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  useEffect(() => {
    if (conversation) {
      setConversationId(conversation.id);
    }
  }, [conversation]);


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
    staleTime: 5 * 60 * 1000, // 5 minutes cache
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
    staleTime: 5 * 60 * 1000, // 5 minutes cache
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
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const sendMessage = useCallback(async (content: string, imageUrls?: string[], quality?: "fast" | "high", explicitMode?: "content" | "ideas" | "free_chat" | "image", citations?: Citation[]) => {
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
    
    

    try {
      // Save user message with citations in payload
      const messagePayload = citations && citations.length > 0 
        ? { citations: citations.map(c => ({ id: c.id, title: c.title, type: c.type, category: c.category })) } 
        : null;

      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content,
        image_urls: imageUrls || null,
      } as any);

      if (insertError) throw insertError;

      // Immediately invalidate messages so UI shows user message right away
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });

      // DETECTAR PEDIDO DE GERAÇÃO DE IMAGEM
      // Modo "image" (template de imagem) OU detecção automática de pedido de imagem
      const isImageTemplateMode = explicitMode === "image";
      const imageGenRequest = detectImageGenerationRequest(content);
      const shouldGenerateImage = isImageTemplateMode || imageGenRequest.isImageRequest;
      
      if (shouldGenerateImage) {
        setCurrentStep("generating_image");
        
        try {
          // Para templates de imagem, usa o conteúdo diretamente como prompt
          // Para detecção automática, usa o prompt extraído
          // Se for contextual (ex: "gera imagem disso"), usa o conteúdo anterior
          let imagePrompt = isImageTemplateMode ? content : (imageGenRequest.prompt || content);
          
          // Se for um pedido contextual e o prompt está vazio/curto, buscar conteúdo anterior
          if (imageGenRequest.isContextual || imagePrompt.length < 20) {
            const lastContent = extractLastRelevantContent(messages || []);
            if (lastContent) {
              console.log("[CHAT] Using contextual content for image generation, content length:", lastContent.length);
              // Combinar o prompt do usuário (se houver) com o conteúdo anterior
              imagePrompt = imagePrompt.length > 5 
                ? `${imagePrompt}\n\nBaseado no seguinte conteúdo:\n${lastContent.substring(0, 2000)}`
                : `Crie uma imagem visual impactante para o seguinte conteúdo:\n${lastContent.substring(0, 2000)}`;
            }
          }
          
          console.log("[CHAT] Image generation - mode:", isImageTemplateMode ? "template" : "auto-detect", "contextual:", imageGenRequest.isContextual, "prompt length:", imagePrompt.length);
          
          // SPRINT 4: Detecção automática de formato baseado no contexto
          // Prioridade: prompt do usuário > template > conteúdo anterior
          const lastContent = extractLastRelevantContent(messages || []);
          const autoFormat = autoDetectImageFormat(imagePrompt, lastContent || undefined, template?.name);
          console.log("[CHAT] Auto-detected image format:", autoFormat.format, "aspect:", autoFormat.aspectRatio, "confidence:", autoFormat.confidence, "reason:", autoFormat.reason);
          
          // Buscar análises de estilo das referências visuais
          const { data: visualRefs } = await supabase
            .from("client_visual_references")
            .select("*")
            .eq("client_id", clientId)
            .not("metadata", "is", null);
          
          // Filtrar referências que têm análise de estilo
          const styleAnalyses = (visualRefs || [])
            .filter((r: any) => r.metadata?.styleAnalysis)
            .slice(0, 4)
            .map((r: any) => ({
              type: r.reference_type,
              analysis: r.metadata.styleAnalysis,
            }));
          
          console.log("[CHAT] Found", styleAnalyses.length, "analyzed style references");
          
          // Buscar brand_assets do cliente
          const { data: clientData } = await supabase
            .from("clients")
            .select("brand_assets")
            .eq("id", clientId)
            .single();
          
          const brandAssets = clientData?.brand_assets;
          
          // Preparar o prompt otimizado usando o pipeline
          let enhancedPrompt = imagePrompt;
          let imageSpec = null;
          
          if (styleAnalyses.length > 0 || brandAssets) {
            try {
              const { data: prepData, error: prepError } = await supabase.functions.invoke("prepare-image-generation", {
                body: {
                  userPrompt: imagePrompt,
                  clientId: clientId,
                  styleAnalyses: styleAnalyses,
                  brandAssets: brandAssets,
                  imageFormat: autoFormat.format,
                  aspectRatio: autoFormat.aspectRatio,
                },
              });
              
              if (!prepError && prepData?.enhancedPrompt) {
                enhancedPrompt = prepData.enhancedPrompt;
                imageSpec = prepData.imageSpec;
                console.log("[CHAT] Enhanced prompt generated:", enhancedPrompt.substring(0, 100) + "...");
              }
            } catch (prepErr) {
              console.warn("[CHAT] Prepare image failed, using original prompt:", prepErr);
            }
          }
          
          // Combine template image references with user-attached images
          let allReferenceImages: Array<{ url?: string; base64?: string; description?: string }> = [];
          
          // Add template image references first (style guidance)
          if (references.imageReferences && references.imageReferences.length > 0) {
            console.log("[CHAT] Adding", references.imageReferences.length, "template reference images for style guidance");
            allReferenceImages.push(...references.imageReferences.map(ref => ({
              url: ref.url,
              description: ref.description || "Referência de estilo do template"
            })));
          }
          
          // Process user-attached images as additional references
          if (imageUrls && imageUrls.length > 0) {
            console.log("[CHAT] Processing", imageUrls.length, "attached images as references");
            const { processReferenceImages } = await import("@/lib/imageUtils");
            const processedUserImages = await processReferenceImages(
              imageUrls.map(url => ({ url, description: "Referência do usuário" })),
              3,
              1024
            );
            allReferenceImages.push(...processedUserImages);
          }
          
          console.log("[CHAT] Total reference images:", allReferenceImages.length);
          
          const { data: imageData, error: imageError } = await supabase.functions.invoke("generate-image", {
            body: {
              prompt: enhancedPrompt,
              clientId: clientId,
              userId: user?.id,
              referenceImages: allReferenceImages.length > 0 ? allReferenceImages : undefined,
              styleAnalysis: references.styleAnalysis || undefined,
              imageFormat: autoFormat.format,
              formatInstructions: `Formato: ${autoFormat.format} | Aspect Ratio: ${autoFormat.aspectRatio} | Plataforma: ${autoFormat.platform || 'universal'} | ${autoFormat.reason}`,
              aspectRatio: autoFormat.aspectRatio,
              templateName: template?.name,
              imageSpec: imageSpec,
            },
          });

          if (imageError) throw imageError;
          
          if (imageData?.imageUrl) {
            // Salvar resposta com imagem gerada (SEM texto explicativo)
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: "", // Sem texto, apenas a imagem
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
      // DETECTAR URL E SEPARAR EXTRAÇÃO vs GERAÇÃO DE CONTEÚDO
      // =====================================================
      const urlMatch = content.match(/https?:\/\/[^\s]+/gi);
      const hasUrl = urlMatch && urlMatch.length > 0;
      
      // Keywords que indicam APENAS extração (mostrar conteúdo, não gerar)
      const isExtractionOnly = (
        content.toLowerCase().includes("extrai") ||
        content.toLowerCase().includes("extraia") ||
        content.toLowerCase().includes("extrair") ||
        content.toLowerCase().includes("mostra") ||
        content.toLowerCase().includes("mostre") ||
        content.toLowerCase().includes("veja") ||
        content.toLowerCase().includes("analise") ||
        content.toLowerCase().includes("analisa")
      ) && !(
        content.toLowerCase().includes("crie") ||
        content.toLowerCase().includes("gere") ||
        content.toLowerCase().includes("faça") ||
        content.toLowerCase().includes("escreva") ||
        content.toLowerCase().includes("baseado") ||
        content.toLowerCase().includes("a partir")
      );
      
      // Keywords que indicam GERAÇÃO de conteúdo a partir da URL
      const isContentGenerationFromUrl = hasUrl && (
        content.toLowerCase().includes("crie") ||
        content.toLowerCase().includes("gere") ||
        content.toLowerCase().includes("faça") ||
        content.toLowerCase().includes("escreva") ||
        content.toLowerCase().includes("baseado") ||
        content.toLowerCase().includes("a partir") ||
        content.toLowerCase().includes("carrossel") ||
        content.toLowerCase().includes("carousel") ||
        content.toLowerCase().includes("post") ||
        content.toLowerCase().includes("thread") ||
        content.toLowerCase().includes("newsletter") ||
        content.toLowerCase().includes("stories") ||
        content.toLowerCase().includes("reels") ||
        content.toLowerCase().includes("conteúdo") ||
        content.toLowerCase().includes("conteudo")
      );
      
      // Variáveis para armazenar conteúdo extraído
      let extractedUrlContent: { title?: string; content?: string; highlights?: string[]; url?: string } | null = null;
      
      // Se tem URL e é pedido de geração, extrair conteúdo primeiro
      if (hasUrl && isContentGenerationFromUrl && !isExtractionOnly) {
        console.log("[CHAT] Content generation from URL detected:", urlMatch[0]);
        setCurrentStep("analyzing");
        
        try {
          // Detectar tipo de URL
          const isYouTube = urlMatch[0].includes("youtube.com") || urlMatch[0].includes("youtu.be");
          
          if (isYouTube) {
            // Extrair transcrição do YouTube
            const { data: ytData, error: ytError } = await supabase.functions.invoke("extract-youtube", {
              body: { url: urlMatch[0] },
            });
            
            if (!ytError && ytData) {
              extractedUrlContent = {
                title: ytData.title || "Vídeo do YouTube",
                content: ytData.transcript || ytData.description || "",
                highlights: [],
                url: urlMatch[0]
              };
              console.log("[CHAT] YouTube content extracted, transcript length:", extractedUrlContent.content?.length);
            }
          } else {
            // Extrair conteúdo de newsletter/artigo
            const { data: newsletterData, error: newsletterError } = await supabase.functions.invoke("scrape-newsletter", {
              body: { url: urlMatch[0] },
            });
            
            if (!newsletterError && newsletterData?.success && newsletterData?.data) {
              const { title, paragraphs, highlights, markdown } = newsletterData.data;
              extractedUrlContent = {
                title: title || "Conteúdo extraído",
                content: markdown || paragraphs?.join('\n\n') || "",
                highlights: highlights || [],
                url: urlMatch[0]
              };
              console.log("[CHAT] Newsletter content extracted, length:", extractedUrlContent.content?.length);
            }
          }
          
          // Se extraiu conteúdo, enriquecer a mensagem e CONTINUAR para o pipeline
          if (extractedUrlContent && extractedUrlContent.content) {
            // Não retornamos aqui - deixamos o fluxo continuar para o pipeline multi-agente
            // O conteúdo extraído será usado como contexto
            console.log("[CHAT] Content extracted successfully, will pass to multi-agent pipeline");
          } else {
            throw new Error("Não foi possível extrair conteúdo da URL");
          }
        } catch (urlError: any) {
          console.error("[CHAT] URL extraction error:", urlError);
          
          // Se falhou a extração, informar e continuar sem o conteúdo
          toast({
            title: "Aviso",
            description: "Não foi possível extrair o conteúdo da URL. Tentando gerar conteúdo com as informações disponíveis.",
            variant: "default",
          });
        }
      }
      
      // Se é APENAS extração (sem geração), mostrar conteúdo estruturado e retornar
      if (hasUrl && isExtractionOnly && urlMatch) {
        console.log("[CHAT] Extraction-only request for URL:", urlMatch[0]);
        setCurrentStep("analyzing");
        
        try {
          const { data: newsletterData, error: newsletterError } = await supabase.functions.invoke("scrape-newsletter", {
            body: { url: urlMatch[0] },
          });

          if (newsletterError) throw newsletterError;
          
          if (newsletterData?.success && newsletterData?.data) {
            const { title, images, headings, highlights, paragraphs, carouselSlides, stats } = newsletterData.data;
            
            // Coletar todas as URLs de imagens válidas
            const imageUrlsFromNewsletter = images?.slice(0, 20).map((img: any) => img.url).filter(Boolean) || [];
            
            // Formatar resposta estruturada para carrossel seguindo guia
            let responseContent = `## 📰 ${title}\n\n`;
            responseContent += `**Fonte:** [${newsletterData.data.url}](${newsletterData.data.url})\n\n`;
            responseContent += `**Estatísticas:** ${stats?.imageCount || 0} imagens | ${stats?.paragraphCount || 0} parágrafos\n\n`;
            responseContent += `---\n\n`;
            
            // Carrossel estruturado seguindo guia
            if (carouselSlides && carouselSlides.length > 0) {
              responseContent += `### 🎠 ESTRUTURA DO CARROSSEL (${carouselSlides.length} slides)\n\n`;
              
              carouselSlides.forEach((slide: any) => {
                const slideType = slide.type === 'hook' ? '🎯 GANCHO' : 
                                  slide.type === 'bridge' ? '🌉 PONTE' : 
                                  slide.type === 'cta' ? '📢 CTA' : '📝 CONTEÚDO';
                
                responseContent += `---\n\n`;
                responseContent += `## 📱 Slide ${slide.slideNumber} de ${carouselSlides.length}\n\n`;
                responseContent += `**Tipo:** ${slideType}\n\n`;
                
                // Heading se existir
                if (slide.heading && slide.type === 'content') {
                  responseContent += `### ${slide.heading}\n\n`;
                }
                
                // Texto do slide
                if (slide.text) {
                  responseContent += `${slide.text}\n\n`;
                }
                
                // Imagem com preview e link
                if (slide.imageUrl) {
                  responseContent += `**🖼️ Imagem sugerida:**\n\n`;
                  responseContent += `![Slide ${slide.slideNumber}](${slide.imageUrl})\n\n`;
                }
                
                responseContent += `\n`;
              });
            }
            
            // Destaques/citações importantes
            if (highlights && highlights.length > 0) {
              responseContent += `### 💡 Destaques Importantes\n\n`;
              highlights.slice(0, 5).forEach((h: string, idx: number) => {
                responseContent += `> "${h}"\n\n`;
              });
            }
            
            // Banco de imagens completo
            if (imageUrlsFromNewsletter.length > 0) {
              responseContent += `### 🖼️ BANCO DE IMAGENS (${images?.length || 0} encontradas)\n\n`;
              responseContent += `Use estas imagens nos slides do carrossel:\n\n`;
              
              imageUrlsFromNewsletter.forEach((imgUrl: string, idx: number) => {
                responseContent += `**Imagem ${idx + 1}:**\n`;
                responseContent += `![Img ${idx + 1}](${imgUrl})\n`;
                responseContent += `\`${imgUrl}\`\n\n`;
              });
            }
            
            // Salvar resposta com as imagens para galeria
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: responseContent,
              image_urls: imageUrlsFromNewsletter.length > 0 ? imageUrlsFromNewsletter : null,
            });
            
            queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          } else {
            throw new Error(newsletterData?.error || "Erro ao extrair newsletter");
          }
        } catch (nlError: any) {
          console.error("Newsletter extraction error:", nlError);
          
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: `Não foi possível extrair a newsletter. ${nlError.message || "Verifique se o link está correto e tente novamente."}`,
          });
          
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
        }
        
        setIsLoading(false);
        setCurrentStep(null);
        return;
      }

      // =================================================================
      // MODO CHAT LIVRE (Free Chat Mode) - COM BUSCA INTELIGENTE EM DOCUMENTOS
      // =================================================================
      if (isFreeChatModeExplicit) {
        console.log("[CHAT] Free Chat Mode - building comprehensive context with document search");
        
        // Extrair palavras-chave da pergunta do usuário para busca
        const extractKeywords = (text: string): string[] => {
          const stopWords = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em', 'no', 'na', 'para', 'com', 'que', 'é', 'por', 'se', 'como', 'qual', 'quais', 'quanto', 'quando', 'onde', 'quem', 'e', 'ou', 'mas', 'mais', 'menos', 'sobre', 'foi', 'ser', 'ter', 'isso', 'esse', 'essa', 'este', 'esta', 'aquele', 'aquela', 'me', 'te', 'seu', 'sua', 'meu', 'minha', 'nosso', 'nossa', 'dele', 'dela', 'ao', 'aos', 'às', 'pelo', 'pela', 'pelos', 'pelas']);
          return text.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word))
            .slice(0, 10);
        };

        // Extrair datas mencionadas na mensagem
        const extractDateRange = (text: string): { startDate?: string; endDate?: string; period?: string } => {
          const monthNames: Record<string, number> = {
            'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2, 'abril': 3, 'maio': 4, 'junho': 5,
            'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
          };
          
          // Detectar "primeira semana de novembro", "última semana de março", etc
          const weekMatch = text.toLowerCase().match(/(primeira|segunda|terceira|quarta|última|ultima)\s*semana\s*de\s*(\w+)(?:\s*de\s*(\d{4}))?/);
          if (weekMatch) {
            const weekNum = { 'primeira': 0, 'segunda': 1, 'terceira': 2, 'quarta': 3, 'última': 3, 'ultima': 3 }[weekMatch[1]] || 0;
            const month = monthNames[weekMatch[2]];
            const year = weekMatch[3] ? parseInt(weekMatch[3]) : new Date().getFullYear();
            
            if (month !== undefined) {
              const startDay = 1 + (weekNum * 7);
              const endDay = Math.min(startDay + 6, new Date(year, month + 1, 0).getDate());
              return {
                startDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
                endDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
                period: `${weekMatch[1]} semana de ${weekMatch[2]}${weekMatch[3] ? ` de ${weekMatch[3]}` : ''}`
              };
            }
          }
          
          // Detectar "mês de novembro", "em abril", etc
          const monthMatch = text.toLowerCase().match(/(?:mês\s*de|em)\s*(\w+)(?:\s*de\s*(\d{4}))?/);
          if (monthMatch) {
            const month = monthNames[monthMatch[1]];
            const year = monthMatch[2] ? parseInt(monthMatch[2]) : new Date().getFullYear();
            if (month !== undefined) {
              return {
                startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
                endDate: `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`,
                period: `${monthMatch[1]}${monthMatch[2] ? ` de ${monthMatch[2]}` : ''}`
              };
            }
          }
          
          return {};
        };
        
        const keywords = extractKeywords(content);
        const dateRange = extractDateRange(content);
        console.log("[CHAT] Search keywords:", keywords);
        console.log("[CHAT] Date range detected:", dateRange);
        
        // Função para buscar trechos relevantes em documentos
        const searchDocumentContent = (docContent: string | null, searchKeywords: string[]): { relevantSnippets: string[], hasMatch: boolean } => {
          if (!docContent) return { relevantSnippets: [], hasMatch: false };
          
          const normalizedContent = docContent.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const relevantSnippets: string[] = [];
          let hasMatch = false;
          
          for (const keyword of searchKeywords) {
            const index = normalizedContent.indexOf(keyword);
            if (index !== -1) {
              hasMatch = true;
              const start = Math.max(0, index - 500);
              const end = Math.min(docContent.length, index + keyword.length + 500);
              const snippet = docContent.substring(start, end).trim();
              if (!relevantSnippets.some(s => s.includes(snippet.substring(100, 200)))) {
                relevantSnippets.push(`...${snippet}...`);
              }
            }
          }
          
          return { relevantSnippets: relevantSnippets.slice(0, 3), hasMatch };
        };
        
        setCurrentStep("analyzing");
        
        // Rastrear quais fontes foram consultadas
        const sourcesConsulted: { type: string; name: string; count: number; dateRange?: string }[] = [];
        
        // Buscar métricas de performance - com filtro de data se especificado
        let metricsQuery = supabase
          .from("platform_metrics")
          .select("*")
          .eq("client_id", clientId)
          .order("metric_date", { ascending: false });
        
        // Aplicar filtro de data se detectado
        if (dateRange.startDate && dateRange.endDate) {
          metricsQuery = metricsQuery
            .gte("metric_date", dateRange.startDate)
            .lte("metric_date", dateRange.endDate);
        } else {
          metricsQuery = metricsQuery.limit(90);
        }
        
        const { data: platformMetrics } = await metricsQuery;
        
        // Verificar range de dados disponíveis
        const { data: metricsRange } = await supabase
          .from("platform_metrics")
          .select("platform, metric_date")
          .eq("client_id", clientId)
          .order("metric_date", { ascending: true })
          .limit(1);
        
        const { data: metricsRangeMax } = await supabase
          .from("platform_metrics")
          .select("platform, metric_date")
          .eq("client_id", clientId)
          .order("metric_date", { ascending: false })
          .limit(1);
        
        const dataAvailability = metricsRange?.[0] && metricsRangeMax?.[0] 
          ? `Dados disponíveis de ${metricsRange[0].metric_date} até ${metricsRangeMax[0].metric_date}`
          : 'Sem dados de métricas disponíveis';
        
        // Buscar vídeos do YouTube
        const { data: youtubeVideos } = await supabase
          .from("youtube_videos")
          .select("*")
          .eq("client_id", clientId)
          .order("published_at", { ascending: false })
          .limit(20);
        
        // Buscar posts do Instagram
        const { data: instagramPosts } = await supabase
          .from("instagram_posts")
          .select("*")
          .eq("client_id", clientId)
          .order("posted_at", { ascending: false })
          .limit(30);
        
        // Registrar fontes consultadas
        if (platformMetrics && platformMetrics.length > 0) {
          const platforms = [...new Set(platformMetrics.map(m => m.platform))];
          platforms.forEach(p => {
            sourcesConsulted.push({ 
              type: 'metrics', 
              name: `Métricas ${p}`, 
              count: platformMetrics.filter(m => m.platform === p).length,
              dateRange: dateRange.period
            });
          });
        }
        if (youtubeVideos && youtubeVideos.length > 0) {
          sourcesConsulted.push({ type: 'youtube', name: 'Vídeos YouTube', count: youtubeVideos.length });
        }
        if (instagramPosts && instagramPosts.length > 0) {
          sourcesConsulted.push({ type: 'instagram', name: 'Posts Instagram', count: instagramPosts.length });
        }
        if (contentLibrary.length > 0) {
          sourcesConsulted.push({ type: 'content', name: 'Biblioteca de Conteúdo', count: contentLibrary.length });
        }
        if (referenceLibrary.length > 0) {
          sourcesConsulted.push({ type: 'references', name: 'Biblioteca de Referências', count: referenceLibrary.length });
        }
        if (documents.length > 0) {
          sourcesConsulted.push({ type: 'documents', name: 'Documentos', count: documents.length });
        }
        
        console.log("[CHAT] Sources consulted:", sourcesConsulted);
        
        // Formatar métricas por plataforma
        const metricsByPlatform = (platformMetrics || []).reduce((acc, m) => {
          if (!acc[m.platform]) acc[m.platform] = [];
          acc[m.platform].push(m);
          return acc;
        }, {} as Record<string, any[]>);
        
        // Construir contexto de métricas com informação sobre disponibilidade
        let metricsContext = '';
        
        if (dateRange.period && (!platformMetrics || platformMetrics.length === 0)) {
          // Usuário pediu dados de uma data específica mas não há dados
          metricsContext = `⚠️ ATENÇÃO: Você perguntou sobre "${dateRange.period}", mas NÃO há dados de métricas para este período.\n${dataAvailability}\n\nSe precisar de dados de outro período, especifique uma data dentro do range disponível.`;
        } else if (Object.keys(metricsByPlatform).length > 0) {
          metricsContext = Object.entries(metricsByPlatform).map(([platform, metrics]) => {
            const sortedMetrics = metrics.sort((a, b) => new Date(b.metric_date).getTime() - new Date(a.metric_date).getTime());
            const latest = sortedMetrics[0];
            const oldest = sortedMetrics[sortedMetrics.length - 1];
            
            let summary = `📈 ${platform.toUpperCase()} (${sortedMetrics.length} registros, de ${oldest?.metric_date} a ${latest?.metric_date}):\n`;
            
            // Subscribers já é o crescimento diário, então somamos todos
            const totalSubscribersGrowth = metrics.reduce((sum: number, m: any) => sum + (m.subscribers || 0), 0);
            if (totalSubscribersGrowth !== 0) {
              summary += `- Crescimento de seguidores no período: ${totalSubscribersGrowth >= 0 ? '+' : ''}${totalSubscribersGrowth.toLocaleString()}\n`;
            }
            if (latest.views) summary += `- Visualizações (último registro): ${latest.views.toLocaleString()}\n`;
            if (latest.engagement_rate) summary += `- Engajamento: ${(latest.engagement_rate * 100).toFixed(2)}%\n`;
            if (latest.open_rate) summary += `- Taxa de abertura: ${(latest.open_rate * 100).toFixed(2)}%\n`;
            
            // Calcular totais do período
            const totalViews = metrics.reduce((sum: number, m: any) => sum + (m.views || 0), 0);
            const totalLikes = metrics.reduce((sum: number, m: any) => sum + (m.likes || 0), 0);
            if (totalViews > 0) summary += `- Views acumuladas no período: ${totalViews.toLocaleString()}\n`;
            if (totalLikes > 0) summary += `- Curtidas acumuladas no período: ${totalLikes.toLocaleString()}\n`;
            
            return summary;
          }).join('\n');
        } else {
          metricsContext = `Sem métricas disponíveis para análise. ${dataAvailability}`;
        }
        
        const youtubeContext = youtubeVideos && youtubeVideos.length > 0
          ? `📺 VÍDEOS DO YOUTUBE (${youtubeVideos.length} vídeos):\n` +
            youtubeVideos.map((v, i) => 
              `${i + 1}. "${v.title}" (${v.published_at?.split('T')[0] || 'sem data'}) - ${v.total_views?.toLocaleString() || 0} views, ${v.watch_hours?.toFixed(1) || 0}h assistidas, +${v.subscribers_gained || 0} inscritos`
            ).join('\n')
          : '';
        
        const instagramContext = instagramPosts && instagramPosts.length > 0
          ? `📸 POSTS DO INSTAGRAM (${instagramPosts.length} posts):\n` +
            instagramPosts.slice(0, 10).map((p, i) => 
              `${i + 1}. [${p.post_type || 'post'}] (${p.posted_at?.split('T')[0] || 'sem data'}) - ${p.likes || 0} likes, ${p.comments || 0} comments, ${p.saves || 0} saves`
            ).join('\n')
          : '';
        
        // Documentos com busca inteligente
        let documentsContext = '';
        const MAX_CHARS_PER_DOC = 4000;
        
        if (documents.length > 0) {
          const docParts: string[] = [];
          
          for (const doc of documents) {
            const { relevantSnippets, hasMatch } = searchDocumentContent(doc.extracted_content, keywords);
            
            if (hasMatch && relevantSnippets.length > 0) {
              docParts.push(`📄 **${doc.name}** (RELEVANTE):\n${relevantSnippets.join('\n\n')}`);
            } else if (doc.extracted_content) {
              const truncatedContent = doc.extracted_content.length > MAX_CHARS_PER_DOC 
                ? doc.extracted_content.substring(0, MAX_CHARS_PER_DOC) + '...[documento continua]'
                : doc.extracted_content;
              docParts.push(`📄 **${doc.name}**:\n${truncatedContent}`);
            }
          }
          
          documentsContext = docParts.join('\n\n---\n\n');
        }
        
        // Preparar contexto completo
        const freeChatContext = `Você é o kAI, assistente de IA especializado para o cliente ${client.name}.

## ⚠️ REGRA CRÍTICA: NUNCA INVENTE DADOS
- Se uma informação não estiver listada abaixo, diga: "Não encontrei essa informação nas fontes disponíveis"
- NUNCA crie números, estatísticas ou dados que não estejam explicitamente fornecidos
- Cite a fonte quando responder (ex: "Segundo as métricas de Instagram...", "No documento X...")
- Se perguntado sobre algo que não está nas fontes, seja honesto

## 🔍 FONTES CONSULTADAS PARA ESTA RESPOSTA:
${sourcesConsulted.map(s => `- ${s.name}: ${s.count} registros${s.dateRange ? ` (${s.dateRange})` : ''}`).join('\n') || 'Nenhuma fonte encontrada'}

## 📋 IDENTIDADE DO CLIENTE:
${client.identity_guide || client.context_notes || 'Sem guia de identidade cadastrado'}

## 📊 MÉTRICAS DE PERFORMANCE:
${metricsContext}

${youtubeContext}

${instagramContext}

## 📚 BIBLIOTECA DE CONTEÚDO (${contentLibrary.length} itens):
${contentLibrary.slice(0, 20).map((c, i) => `[${i + 1}] "${c.title}" (${c.content_type})`).join('\n') || 'Biblioteca vazia'}

## 📖 BIBLIOTECA DE REFERÊNCIAS (${referenceLibrary.length} itens):
${referenceLibrary.slice(0, 15).map((r, i) => `[REF ${i + 1}] "${r.title}" (${r.reference_type})`).join('\n') || 'Sem referências'}

## 📄 DOCUMENTOS (${documents.length} documentos):
${documentsContext || 'Sem documentos'}

## 📱 REDES SOCIAIS:
${client.social_media ? Object.entries(client.social_media).filter(([_, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n') : 'Não cadastradas'}

---

INSTRUÇÕES:
- Sempre cite quais fontes você usou para responder
- Se o usuário perguntar sobre um período sem dados, informe claramente que não há dados
- Para métricas: ${dataAvailability}
- Seja direto e preciso`;

        setCurrentStep("creating");

        // Chamar IA diretamente - modelo rápido e barato
        const freeChatMessages = [
          { role: "system", content: freeChatContext },
          ...messages
            .filter((m) => m.content && m.content.trim() !== '')
            .map((m) => ({ role: m.role, content: m.content })),
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

      // Detectar referência contextual ("isso", "essa ideia", etc.)
      const contextualRef = detectContextualReference(messages || [], content);
      let enrichedContent = contextualRef.hasReference ? contextualRef.enrichedPrompt : content;
      
      console.log("[CHAT] Contextual reference detected:", contextualRef.hasReference);
      
      // ENRIQUECER MENSAGEM COM CONTEÚDO EXTRAÍDO DA URL (se houver)
      if (extractedUrlContent && extractedUrlContent.content) {
        console.log("[CHAT] Enriching message with extracted URL content");
        
        // Adicionar o conteúdo extraído como material de referência
        const highlightsText = extractedUrlContent.highlights && extractedUrlContent.highlights.length > 0
          ? `\n\n### Destaques:\n${extractedUrlContent.highlights.map(h => `- ${h}`).join('\n')}`
          : '';
        
        enrichedContent = `${content}

## MATERIAL DE REFERÊNCIA EXTRAÍDO DA URL:
**Título:** ${extractedUrlContent.title}
**Fonte:** ${extractedUrlContent.url}

### Conteúdo:
${extractedUrlContent.content.substring(0, 15000)}${highlightsText}

---
Por favor, use este material como base para criar o conteúdo solicitado, adaptando ao tom e estilo do cliente.`;
        
        console.log("[CHAT] Enriched content length:", enrichedContent.length);
      }
      
      // Detectar tipo de conteúdo para multi-agente (apenas se NÃO estiver em modo ideias)
      const earlyDetectedType = detectContentType(enrichedContent);
      
      // Usar pipeline multi-agente QUANDO:
      // 1. NÃO está em modo ideias explícito E
      // 2. (Usuário escolheu "Alta Qualidade" OU é conteúdo longo com modelo premium OU tem conteúdo extraído de URL)
      const shouldUseMultiAgent = !isExplicitIdeaMode && (
        quality === "high" || 
        extractedUrlContent !== null ||
        (MULTI_AGENT_CONTENT_TYPES.includes(earlyDetectedType || "") &&
        (selectedModel.includes("pro") || selectedModel.includes("gpt-5")))
      );

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
              userMessage: enrichedContent, // Usar conteúdo enriquecido com contexto
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
          ...messages
            .filter((m) => m.content && m.content.trim() !== '')
            .map((m) => ({ role: m.role, content: m.content })),
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
      // FLUXO NORMAL PARA CRIAÇÃO DE CONTEÚDO (MODO HÍBRIDO)
      // =====================================================
      console.log("[CHAT] MODO CONTEÚDO - Fluxo híbrido");
      
      // Verificar se há citações manuais do usuário
      const hasManualCitations = citations && citations.length > 0;
      let selection: any = null;
      let manualCitationContents: ParsedCitation[] = [];
      
      if (hasManualCitations) {
        // =====================================================
        // MODO CITAÇÃO MANUAL - Pular seleção automática
        // =====================================================
        console.log("[CHAT] Citações manuais detectadas:", citations.length, "- Pulando seleção automática");
        setCurrentStep("selecting");
        
        // Buscar conteúdo completo das citações
        manualCitationContents = await fetchCitationContents(citations);
        console.log("[CHAT] Conteúdos das citações carregados:", manualCitationContents.length);
        
        // Criar "seleção" a partir das citações manuais
        selection = {
          detected_content_type: detectContentType(enrichedContent) || 'general',
          selected_references: citations.map(c => ({
            id: c.id,
            type: c.type,
            reason: "Citado manualmente pelo usuário",
            priority: "high"
          })),
          analysis_needed: true,
          use_context_notes: !!client.context_notes,
          use_websites: websites.length > 0,
          strategy: "follow_structure",
          reasoning: "Conteúdos selecionados manualmente pelo usuário como referência principal"
        };
        
        // Atualizar workflow state
        setWorkflowState({
          selectedMaterials: selection.selected_references,
          reasoning: selection.reasoning,
          strategy: selection.strategy,
          patternAnalysis: ""
        });
        
      } else {
        // =====================================================
        // MODO SELEÇÃO AUTOMÁTICA (com modelo mais barato)
        // =====================================================
        console.log("[CHAT] Sem citações manuais - Usando seleção automática");
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

${contentLibrary.length === 0 ? 'ATENÇÃO: Biblioteca vazia! Selecione analysis_needed: false' : contentLibrary.slice(0, 10).map((c, i) => `
### [${i + 1}] ${c.title}
- ID: ${c.id}
- Tipo: ${c.content_type}
- Preview: "${c.content.substring(0, 200)}..."
`).join('\n')}

## BIBLIOTECA DE REFERÊNCIAS (${referenceLibrary.length} itens):

${referenceLibrary.length === 0 ? 'Sem referências cadastradas' : referenceLibrary.slice(0, 5).map((r, i) => `
### [REF ${i + 1}] ${r.title}
- ID: ${r.id}
- Tipo: ${r.reference_type}
- Preview: "${r.content.substring(0, 150)}..."
`).join('\n')}

## DOCUMENTOS (${documents.length} itens):
${documents.length === 0 ? 'Sem documentos' : documents.slice(0, 5).map(d => `- ${d.name} (${d.file_type})`).join('\n')}

---
AGORA CHAME A FUNÇÃO select_relevant_content com:
- detected_content_type: "${selectionDetectedType || 'general'}"
- selected_references: array com IDs dos materiais relevantes (máximo 5)
- analysis_needed: ${contentLibrary.length > 0 || referenceLibrary.length > 0 ? 'true' : 'false'}
- use_context_notes: ${client.context_notes ? 'true' : 'false'}
- use_websites: ${websites.length > 0 ? 'true' : 'false'}
- strategy: "follow_structure" ou "adapt_tone"
- reasoning: explique brevemente porque selecionou esses materiais`;

        // Histórico completo de mensagens para contexto
        const selectionMessages = [
          { role: "system", content: selectionSystemMessage },
          ...messages
            .filter((m) => m.content && m.content.trim() !== '')
            .map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: `TAREFA: Analise a biblioteca acima e use a função select_relevant_content para selecionar materiais relevantes para: "${enrichedContent}"` }
        ];

        // USAR MODELO MAIS BARATO para seleção automática
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

        selection = selectionData.selection;
        console.log("[CHAT] Seleção automática:", selection);

        // Atualizar workflow state com materiais selecionados
        setWorkflowState({
          selectedMaterials: selection.selected_references || [],
          reasoning: selection.reasoning || "",
          strategy: selection.strategy || "",
          patternAnalysis: ""
        });
      }

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

      // Se tem citações manuais, adicionar contexto prioritário
      const manualCitationContext = hasManualCitations && manualCitationContents.length > 0
        ? formatCitationsForContext(manualCitationContents)
        : "";
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

      // Add MANUAL CITATIONS FIRST (highest priority - user explicitly selected these)
      if (manualCitationContext) {
        contextParts.push(manualCitationContext);
        contextParts.push(``);
      }

      // Add identity guide and knowledge files (high priority context)
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
      const ideaRequest = parseIdeaRequest(enrichedContent);
      let isAskingForIdeas = ideaRequest.isIdea;
      const requestedQuantity = ideaRequest.quantity || 5;

      // NOVO: Detectar tipo de conteúdo a partir de citações de formato PRIMEIRO
      const formatCitation = citations?.find(c => c.type === 'format' && c.id.startsWith('format_'));
      let detectedTypeFromCitation: ContentFormatType | null = null;
      
      if (formatCitation) {
        const formatMap: Record<string, ContentFormatType> = {
          'format_tweet': 'tweet',
          'format_thread': 'thread',
          'format_carrossel': 'carousel',
          'format_newsletter': 'newsletter',
          'format_linkedin': 'linkedin_post',
          'format_post_linkedin': 'linkedin_post',
          'format_instagram': 'static_image',
          'format_post_instagram': 'instagram_post',
          'format_reels': 'short_video',
          'format_blog': 'blog_post',
          'format_stories': 'stories',
          'format_video_longo': 'long_video',
          'format_script': 'long_video',
          'format_artigo_x': 'x_article',
        };
        detectedTypeFromCitation = formatMap[formatCitation.id] || null;
        console.log("[CHAT] Format detected from citation:", formatCitation.id, "->", detectedTypeFromCitation);
      }
      

      // Priorizar: citação manual > detecção no texto > seleção automática
      const detectedType = detectedTypeFromCitation || ideaRequest.contentType || detectContentType(enrichedContent) || selection.detected_content_type;

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
          content: enrichedContent, // Usar conteúdo enriquecido com contexto
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

      // Clean AI response - remove internal agent steps and process markers
      const cleanAIResponse = (response: string): string => {
        // Remove multi-agent step markers
        let cleaned = response
          // Remove agent headers like "**Agente Escritor:**", "**Agente Revisor:**", etc.
          .replace(/\*\*Agente [^*]+:\*\*/gi, '')
          // Remove thinking/process markers
          .replace(/\*\*Analisando[^*]*\*\*/gi, '')
          .replace(/\*\*Processando[^*]*\*\*/gi, '')
          .replace(/\*\*Revisando[^*]*\*\*/gi, '')
          .replace(/\*\*Gerando[^*]*\*\*/gi, '')
          .replace(/\*\*Selecionando[^*]*\*\*/gi, '')
          // Remove step indicators
          .replace(/Passo \d+:/gi, '')
          .replace(/Etapa \d+:/gi, '')
          // Remove internal reasoning markers
          .replace(/\[Raciocínio:[^\]]*\]/gi, '')
          .replace(/\[Análise:[^\]]*\]/gi, '')
          .replace(/\[Estratégia:[^\]]*\]/gi, '')
          // Clean up excessive newlines
          .replace(/\n{4,}/g, '\n\n\n')
          .trim();
        
        return cleaned;
      };

      const cleanedResponse = cleanAIResponse(aiResponse);

      // Save AI response
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: cleanedResponse,
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
    setConversationId,
    templateName: template?.name || null,
    setSelectedModel,
    sendMessage,
    regenerateLastMessage,
    clearConversation,
    contentLibrary,
    referenceLibrary,
  };
};
