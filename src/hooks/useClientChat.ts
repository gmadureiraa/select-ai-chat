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

  // Get client context with all structured data
  const { data: client } = useQuery({
    queryKey: ["client-context", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("name, context_notes, social_media, tags, function_templates")
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

      // System message para seleção inteligente
      const selectionSystemMessage = `Você é o kAI, assistente especializado da Kaleidos para o cliente ${client.name}.

Sua tarefa é ANALISAR a pergunta do usuário e SELECIONAR os materiais mais RELEVANTES da biblioteca e documentos.

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
1. Identifique o tipo de conteúdo que o usuário quer (newsletter, carousel, etc)
2. Busque exemplos RELEVANTES desse tipo na biblioteca
3. Selecione materiais que ajudem a entender PADRÕES, TOM e ESTRUTURA
4. Priorize conteúdos similares ao que o usuário pediu`;

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
          model: "gemini-2.5-flash-8b", // Modelo mais barato e rápido
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
          // Criar prompt de análise de padrões
          const analysisPrompt = `Analise profundamente os seguintes conteúdos de referência do cliente ${client.name} e extraia os padrões essenciais:

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
      let contextParts = [
        `# Identidade kAI - Assistente Estratégico para ${client.name}`,
        ``,
        `Você é o kAI, assistente de IA especializado em marketing digital da Kaleidos.`,
        ``,
        `## 🎯 INFORMAÇÕES SELECIONADAS PARA ESTA TAREFA`,
        ``,
        `**Raciocínio da Seleção:** ${selection.reasoning}`,
        `**Estratégia:** ${selection.strategy || 'Seguir padrões estabelecidos'}`,
        ``
      ];

      // Adicionar regra obrigatória para carrosséis
      if (selection.detected_content_type === "carousel") {
        contextParts.push(`## 🎴 REGRA OBRIGATÓRIA PARA CARROSSÉIS`);
        contextParts.push(``);
        contextParts.push(`**TODO carrossel DEVE seguir esta estrutura:**`);
        contextParts.push(``);
        contextParts.push(`**Página 1 (Hook Inicial):**`);
        contextParts.push(`- Título ou hook que chame atenção`);
        contextParts.push(`- SEMPRE apresentar 2-3 opções fortes e chamativas`);
        contextParts.push(`- Exemplo: "Qual dessas dores você sente?" seguido de 3 opções`);
        contextParts.push(``);
        contextParts.push(`**Páginas 2 até n-1 (Desenvolvimento):**`);
        contextParts.push(`- Uma ideia/conceito por página`);
        contextParts.push(`- Desenvolvimento lógico do conteúdo`);
        contextParts.push(``);
        contextParts.push(`**Última Página (CTA):**`);
        contextParts.push(`- SEMPRE finalizar com CTA clara e direta`);
        contextParts.push(`- Pedir APENAS UMA ação: curtir OU seguir OU salvar`);
        contextParts.push(`- A CTA deve conectar com o gancho inicial do carrossel`);
        contextParts.push(`- Escolha a ação que fizer mais sentido para o conteúdo`);
        contextParts.push(``);
        contextParts.push(`**IMPORTANTE:** Esta estrutura NÃO se aplica em Engenharia Reversa.`);
        contextParts.push(``);
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
