import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Message, Client, Website, Document, ProcessStep } from "@/types/chat";
import { createChatError, getErrorMessage } from "@/lib/errors";
import { validateMessage, validateModelId } from "@/lib/validation";
import { withRetry, RetryError } from "@/lib/retry";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useTemplateReferences } from "@/hooks/useTemplateReferences";
import { useActivities } from "@/hooks/useActivities";
import { useAuth } from "@/hooks/useAuth";
import { useClientKnowledge, formatKnowledgeForContext } from "@/hooks/useClientKnowledge";
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
  detectContentType,
  parseIdeaRequest,
  ContentFormatType
} from "@/types/template";

export const useClientChat = (clientId: string, templateId?: string) => {
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<ProcessStep>(null);
  const [conversationRules, setConversationRules] = useState<string[]>([]);
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

  // Get or create conversation (separada por template)
  const { data: conversation } = useQuery({
    queryKey: ["conversation", clientId, templateId],
    queryFn: async () => {
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

  // Get documents
  const { data: documents = [] } = useQuery({
    queryKey: ["client-documents", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("*")
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

  const sendMessage = useCallback(async (content: string, imageUrls?: string[]) => {
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

    try {
      // Save user message
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content,
        image_urls: imageUrls || null,
      });

      if (insertError) throw insertError;

      // FASE 1: Análise e seleção de materiais relevantes (biblioteca + documentos)
      setCurrentStep("analyzing");
      
      // Preparar lista completa de materiais disponíveis
      const availableMaterials = [
        // Conteúdos da biblioteca (com preview do conteúdo)
        ...contentLibrary.map(c => ({
          id: c.id,
          type: 'content_library',
          category: c.content_type, // 'newsletter', 'carousel', 'reel_script', etc
          title: c.title,
          preview: c.content.substring(0, 300), // Preview para IA decidir
          hasFullContent: true
        })),
        // Documentos do storage
        ...documents.map(d => ({
          id: d.id,
          type: 'document',
          category: d.file_type,
          title: d.name,
          preview: `Documento: ${d.name}`,
          hasFullContent: false // Precisa buscar do storage se necessário
        })),
        // NOVO: Biblioteca de Referências (tweets, threads, etc)
        ...referenceLibrary.map(r => ({
          id: r.id,
          type: 'reference_library',
          category: r.reference_type, // 'tweet', 'thread', 'video', etc
          title: r.title,
          preview: `${r.reference_type.toUpperCase()}: ${r.content.substring(0, 250)}`,
          hasFullContent: true,
          source_url: r.source_url
        }))
      ];

      // Detectar pedido de ideias ANTES da seleção para otimizar a busca
      const preliminaryIdeaCheck = parseIdeaRequest(content);

      // System message para seleção inteligente
      const selectionSystemMessage = `Você é o kAI, assistente especializado da Kaleidos para o cliente ${client.name}.

${preliminaryIdeaCheck.isIdea ? `
## ⚠️ MODO IDEIAS DETECTADO
O usuário está pedindo IDEIAS de conteúdo (${preliminaryIdeaCheck.quantity || 5} ideias${preliminaryIdeaCheck.contentType ? ` de ${preliminaryIdeaCheck.contentType}` : ''}).
Selecione materiais que sirvam de INSPIRAÇÃO para criar ideias NOVAS e DIFERENTES.
Analise os TEMAS e ABORDAGENS que funcionam para identificar padrões de sucesso.
IMPORTANTE: Os materiais selecionados serão usados como BASE - o assistente NÃO deve copiar essas ideias.
` : `
Sua tarefa é ANALISAR a pergunta do usuário e SELECIONAR os materiais mais RELEVANTES da biblioteca e documentos.
`}

## Materiais Disponíveis (${availableMaterials.length} total):

### Biblioteca de Conteúdo (${contentLibrary.length}):
${contentLibrary.map(c => `- ID: ${c.id}
  Tipo: ${c.content_type}
  Título: ${c.title}
  Preview: ${c.content.substring(0, 200)}...`).join('\n\n')}

### Documentos (${documents.length}):
${documents.map(d => `- ID: ${d.id}
  Nome: ${d.name}
  Tipo: ${d.file_type}`).join('\n')}

### Biblioteca de Referências (${referenceLibrary.length}):
${referenceLibrary.map(r => `- ID: ${r.id}
  Tipo: ${r.reference_type}
  Título: ${r.title}
  Preview: ${r.content.substring(0, 150)}...
  ${r.source_url ? `URL: ${r.source_url}` : ''}`).join('\n\n')}

## Outras Informações:
- Websites: ${websites.length} website(s)
- Notas de Contexto: ${client.context_notes ? 'Sim' : 'Não'}
- Redes Sociais: ${Object.keys(client.social_media || {}).length}
- Tags: ${Object.keys(client.tags || {}).length}

ESTRATÉGIA:
${preliminaryIdeaCheck.isIdea ? `
1. Identifique o tipo de conteúdo das ideias pedidas (carousel, stories, etc)
2. Busque exemplos VARIADOS desse tipo para inspiração (não só os mais recentes)
3. Selecione materiais com TEMAS DIFERENTES entre si para ampliar possibilidades
4. Priorize conteúdos que tiveram sucesso para entender o que funciona
` : `
1. Identifique o tipo de conteúdo que o usuário quer (newsletter, carousel, etc)
2. Busque exemplos RELEVANTES desse tipo na biblioteca
3. Selecione materiais que ajudem a entender PADRÕES, TOM e ESTRUTURA
4. Priorize conteúdos similares ao que o usuário pediu
`}`;

      // Histórico completo de mensagens para contexto
      const selectionMessages = [
        { role: "system", content: selectionSystemMessage },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content }
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
          // Criar prompt de análise de padrões (diferente para modo ideias vs criação de conteúdo)
          const analysisPrompt = preliminaryIdeaCheck.isIdea 
            ? `Analise os seguintes conteúdos de referência do cliente ${client.name} para IDENTIFICAR OPORTUNIDADES DE NOVAS IDEIAS:

## CONTEÚDOS PARA ANÁLISE:
${selectedContents.map((c: any, idx: number) => `
### ${idx + 1}. ${c.title} (${c.content_type})
${c.source_url ? `**Fonte:** ${c.source_url}\n` : ''}
${c.content}
---
`).join('\n')}

## EXTRAIA PARA GERAR IDEIAS NOVAS:
1. **Temas que Funcionam**: Quais assuntos/tópicos geram engajamento para este cliente?
2. **Ângulos Já Explorados**: Como esses temas foram abordados? (para NÃO repetir)
3. **Oportunidades Não Exploradas**: Que variações ou novos ângulos poderiam ser criados?
4. **Padrões de Sucesso**: O que esses conteúdos têm em comum que funciona bem?
5. **Gaps/Lacunas**: Que temas relacionados ainda não foram cobertos?

IMPORTANTE: Esta análise serve para INSPIRAR ideias NOVAS - nunca para repetir ou copiar as existentes.
Retorne insights claros que ajudem a criar ideias ORIGINAIS e DIFERENTES.`
            : `Analise profundamente os seguintes conteúdos de referência do cliente ${client.name} e extraia os padrões essenciais:

## CONTEÚDOS PARA ANÁLISE:
${selectedContents.map((c: any, idx: number) => `
### ${idx + 1}. ${c.title} (${c.content_type})
${c.source_url ? `**Fonte:** ${c.source_url}\n` : ''}
${c.content}
---
`).join('\n')}

## EXTRAIA:
1. **Estrutura Padrão**: Como o conteúdo é organizado (abertura, desenvolvimento, fechamento)
2. **Tom de Voz**: Formal/informal, uso de pronomes, estilo de escrita, linguagem característica
3. **Elementos Recorrentes**: CTAs, perguntas, citações, metáforas, emojis, formatação
4. **Comprimento Típico**: Número aproximado de parágrafos, extensão das seções
5. **Padrões de Engajamento**: O que chama atenção, como conecta com o leitor
6. **Vocabulário Específico**: Palavras, expressões ou termos recorrentes

Retorne uma análise clara e estruturada para guiar a criação de novo conteúdo similar.`;

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
            const decoder = new TextDecoder();
            let analysisText = "";
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;

              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(":")) continue;
                
                if (trimmed.startsWith("data: ")) {
                  const jsonStr = trimmed.slice(6);
                  if (jsonStr === "[DONE]") continue;

                  try {
                    const parsed = JSON.parse(jsonStr);
                    const content = parsed.choices[0]?.delta?.content || "";
                    analysisText += content;
                  } catch (e) {
                    // Ignorar erros de parse
                  }
                }
              }
            }

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
      const knowledgeContext = formatKnowledgeForContext(
        identityGuide || client.identity_guide || null, 
        knowledgeFiles
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
        
        // IMPORTANTE: Instruir sobre uso da biblioteca como inspiração
        if (selection.selected_references?.length > 0) {
          contextParts.push(`## 📚 REFERÊNCIAS PARA INSPIRAÇÃO (NÃO COPIAR)`);
          contextParts.push(``);
          contextParts.push(`Use os conteúdos selecionados como BASE para criar ideias NOVAS e DIFERENTES:`);
          contextParts.push(`- Analise os TEMAS abordados para entender o que funciona para este cliente`);
          contextParts.push(`- Note os ÂNGULOS e ABORDAGENS usados`);
          contextParts.push(`- Crie variações e combinações ORIGINAIS`);
          contextParts.push(`- NUNCA sugira a mesma ideia que já existe na biblioteca`);
          contextParts.push(``);
        }
      } else {
        // REGRAS GLOBAIS DE CONTEÚDO (apenas para criação de conteúdo, não para ideias)
        contextParts.push(`## REGRAS GLOBAIS DE CONTEÚDO`);
        contextParts.push(``);
        contextParts.push(`- ${GLOBAL_CONTENT_RULES.emoji}`);
        contextParts.push(`- ${GLOBAL_CONTENT_RULES.clarity}`);
        contextParts.push(`- ${GLOBAL_CONTENT_RULES.specificity}`);
        contextParts.push(`- ${GLOBAL_CONTENT_RULES.hook}`);
        contextParts.push(`- ${GLOBAL_CONTENT_RULES.cta}`);
        contextParts.push(`- ${GLOBAL_CONTENT_RULES.value}`);
        contextParts.push(``);

        // Aplicar regras específicas do formato detectado APENAS SE NÃO FOR PEDIDO DE IDEIAS
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
        } else if (detectedType === "short_video" || detectedType === "reel_script" || 
                   content.toLowerCase().includes("reel") || content.toLowerCase().includes("tiktok")) {
          contextParts.push(REELS_FORMAT_RULES);
          contextParts.push(``);
        } else if (detectedType === "linkedin" || content.toLowerCase().includes("linkedin")) {
          contextParts.push(LINKEDIN_FORMAT_RULES);
          contextParts.push(``);
        } else if (detectedType === "newsletter" || detectedType === "blog_post" || 
                   content.toLowerCase().includes("legenda")) {
          contextParts.push(CAPTION_FORMAT_RULES);
          contextParts.push(``);
        }
      }

      // Adicionar análise de padrões se disponível
      if (patternAnalysis) {
        contextParts.push(`## 📊 ANÁLISE DE PADRÕES DO CLIENTE`);
        contextParts.push(``);
        contextParts.push(`**IMPORTANTE:** Os conteúdos selecionados foram analisados para identificar padrões. Use esta análise como guia:`);
        contextParts.push(``);
        contextParts.push(patternAnalysis);
        contextParts.push(``);
        contextParts.push(`**INSTRUÇÕES CRÍTICAS:**`);
        contextParts.push(`1. SIGA a estrutura e organização identificada`);
        contextParts.push(`2. MANTENHA o tom de voz característico`);
        contextParts.push(`3. USE elementos recorrentes e vocabulário específico`);
        contextParts.push(`4. ADAPTE para o tema solicitado pelo usuário`);
        contextParts.push(`5. NÃO COPIE conteúdo, apenas padrões e estilo`);
        contextParts.push(``);
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

      const reader = data.body?.getReader();
      const decoder = new TextDecoder();
      let aiResponse = "";
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep last incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;
            
            if (trimmed.startsWith("data: ")) {
              const jsonStr = trimmed.slice(6);
              if (jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices[0]?.delta?.content || "";
                aiResponse += content;
              } catch (e) {
                // Silently ignore JSON parse errors in streaming
              }
            }
          }
        }
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
    selectedModel,
    conversationRules,
    workflowState,
    setSelectedModel,
    sendMessage,
    regenerateLastMessage,
    clearConversation,
  };
};
