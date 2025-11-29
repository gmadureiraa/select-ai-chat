import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Message, Client, Website, Document, ProcessStep } from "@/types/chat";
import { createChatError, getErrorMessage } from "@/lib/errors";
import { validateMessage, validateModelId } from "@/lib/validation";
import { withRetry, RetryError } from "@/lib/retry";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";

export const useClientChat = (clientId: string, templateId?: string) => {
  const [selectedModel, setSelectedModel] = useState("gpt-5-mini-2025-08-07");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<ProcessStep>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Ativar realtime para mensagens
  useRealtimeMessages(conversationId);

  // Get template if templateId is provided
  const { data: template } = useQuery({
    queryKey: ["client-template", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_templates")
        .select("*")
        .eq("id", templateId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });

  // Get or create conversation
  const { data: conversation } = useQuery({
    queryKey: ["conversation", clientId],
    queryFn: async () => {
      // Try to get existing conversation
      const { data: existing, error: fetchError } = await supabase
        .from("conversations")
        .select("*")
        .eq("client_id", clientId)
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

      // Realtime vai atualizar automaticamente
      setCurrentStep("reviewing");

      // Build comprehensive context with structured workflow
      let contextParts = [
        `# Identidade kAI - Assistente Estratégico para ${client.name}`,
        ``,
        `Você é o kAI, assistente de IA especializado em marketing digital da Kaleidos. Sua função é ajudar a criar conteúdo estratégico e executar tarefas para o cliente ${client.name}.`,
        ``,
        `## PROCESSO DE CRIAÇÃO (SIGA ESTAS ETAPAS):`,
        ``,
        `### 1️⃣ ANALISAR A DEMANDA`,
        `- Identifique claramente o que o usuário está pedindo`,
        `- Confirme os objetivos e requisitos específicos`,
        `- Faça perguntas se necessário para entender melhor`,
        ``,
        `### 2️⃣ ANALISAR O CONTEXTO DO CLIENTE`,
        `- Revise as informações do cliente (segmento, tom, objetivos, público)`,
        `- Consulte websites e conteúdo extraído`,
        `- Considere as redes sociais e estilo de comunicação`,
        `- Verifique documentos e materiais de referência`,
        ``,
        `### 3️⃣ APLICAR REGRAS E CRIAR`,
        `- Use os padrões e funções recorrentes definidos`,
        `- Mantenha consistência com o tom de voz do cliente`,
        `- Siga as diretrizes estratégicas estabelecidas`,
        `- Crie conteúdo alinhado com os objetivos`,
        ``
      ];

      if (client.context_notes) {
        contextParts.push(`## 📋 Contexto Fixo:`);
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

      // Add template rules if template is being used
      if (template && template.rules) {
        const rules = Array.isArray(template.rules) ? template.rules : [];
        if (rules.length > 0) {
          contextParts.push(`## 📝 Regras do Template "${template.name}":`);
          contextParts.push("**IMPORTANTE: Siga estas regras ao criar o conteúdo:**");
          
          for (const rule of rules) {
            const ruleData = rule as any;
            if (ruleData.type === 'content_reference' && ruleData.file_url) {
              contextParts.push(`\n**Referência de Estrutura e Linguagem:**`);
              contextParts.push(`${ruleData.content}`);
              contextParts.push(`IMPORTANTE: Use este exemplo APENAS para entender estrutura, formato e linguagem. NÃO copie o tema ou assunto - adapte para o contexto atual.`);
              contextParts.push(`URL de referência: ${ruleData.file_url}`);
            } else {
              contextParts.push(`- ${ruleData.content}`);
            }
          }
          contextParts.push('');
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

      if (client.social_media && Object.values(client.social_media).some(v => v)) {
        contextParts.push("## 📱 Redes Sociais:");
        if (client.social_media.instagram) contextParts.push(`- Instagram: ${client.social_media.instagram}`);
        if (client.social_media.linkedin) contextParts.push(`- LinkedIn: ${client.social_media.linkedin}`);
        if (client.social_media.facebook) contextParts.push(`- Facebook: ${client.social_media.facebook}`);
        if (client.social_media.twitter) contextParts.push(`- Twitter: ${client.social_media.twitter}`);
        contextParts.push('');
      }

      if (websites.length > 0) {
        contextParts.push("## 🌐 Websites e Conteúdo Extraído:");
        websites.forEach(w => {
          contextParts.push(`### ${w.url}`);
          if (w.scraped_markdown) {
            contextParts.push(w.scraped_markdown.substring(0, 3000));
          }
          contextParts.push('');
        });
      }

      if (documents.length > 0) {
        contextParts.push(`## 📄 Documentos de Referência (${documents.length}):`);
        documents.forEach(d => contextParts.push(`- ${d.name} (${d.file_type})`));
        contextParts.push('');
      }

      const systemMessage = contextParts.join("\n");

      const messagesWithContext = [
        { role: "system" as const, content: systemMessage },
        ...messages.map((m) => {
          const msg: any = { role: m.role, content: m.content };
          // Add image URLs for multimodal support
          if (m.image_urls && m.image_urls.length > 0) {
            msg.images = m.image_urls;
          }
          return msg;
        }),
        { 
          role: "user" as const, 
          content,
          ...(imageUrls && imageUrls.length > 0 ? { images: imageUrls } : {})
        },
      ];

      setCurrentStep("creating");

      // Call AI com retry automático
      const { data, error } = await withRetry(
        () =>
          supabase.functions.invoke("chat", {
            body: {
              messages: messagesWithContext,
              model: selectedModel,
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
  }, [conversationId, client, selectedModel, messages, websites, documents, template, queryClient, toast]);

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

  return {
    messages,
    isLoading,
    currentStep,
    selectedModel,
    setSelectedModel,
    sendMessage,
    regenerateLastMessage,
  };
};
