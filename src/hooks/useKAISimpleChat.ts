import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { streamSSEToCallback } from "@/lib/parseOpenAIStream";
import { toast } from "sonner";
import type { KAIActionCard } from "@/types/kai-stream";

export interface SimpleMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageUrl?: string;
  /** Cards produzidos pelo agente operador (F0.3b+). Map por card.id pra
      suportar updates incrementais quando o card muda de status. */
  actionCards?: KAIActionCard[];
}

export interface SimpleCitation {
  id: string;
  type: "content" | "reference" | "format";
  title: string;
}

interface UseKAISimpleChatOptions {
  clientId: string;
  conversationId?: string | null;
  onConversationCreated?: (id: string) => void;
  /** F0.3b — quando true, o edge usa Gemini function calling com ToolRegistry.
      Ativado via ?tools=1 na URL pelo KaiAssistantTab. Default false (fluxo atual). */
  useTools?: boolean;
}

/** Shape que o front envia pra executar uma tool direto (clique em card). */
export interface ForceToolCall {
  name: string;
  args: Record<string, unknown>;
}

export function useKAISimpleChat({
  clientId,
  conversationId: externalConversationId,
  onConversationCreated,
  useTools = false,
}: UseKAISimpleChatOptions) {
  const [messages, setMessages] = useState<SimpleMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(externalConversationId || null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingMessagesRef = useRef(false);

  // Load messages from database when conversationId changes
  useEffect(() => {
    if (externalConversationId && externalConversationId !== conversationId) {
      setConversationId(externalConversationId);
      loadMessages(externalConversationId);
    }
  }, [externalConversationId]);

  // Load messages from database
  const loadMessages = useCallback(async (convId: string) => {
    if (isLoadingMessagesRef.current) return;
    isLoadingMessagesRef.current = true;

    try {
      const { data, error } = await supabase
        .from("kai_chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[useKAISimpleChat] Error loading messages:", error);
        return;
      }

      if (data) {
        setMessages(data.map(m => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.created_at),
          imageUrl: m.image_url || undefined,
        })));
      }
    } catch (error) {
      console.error("[useKAISimpleChat] Error loading messages:", error);
    } finally {
      isLoadingMessagesRef.current = false;
    }
  }, []);

  // Save message to database
  const saveMessage = useCallback(async (
    message: SimpleMessage, 
    convId: string
  ) => {
    try {
      const { error } = await supabase
        .from("kai_chat_messages")
        .insert({
          conversation_id: convId,
          role: message.role,
          content: message.content,
          image_url: message.imageUrl || null,
        });

      if (error) {
        console.error("[useKAISimpleChat] Error saving message:", error);
      }
    } catch (error) {
      console.error("[useKAISimpleChat] Error saving message:", error);
    }
  }, []);

  // Create a new conversation
  const createConversation = useCallback(async (): Promise<string | null> => {
    if (!clientId) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return null;
      }

      const { data, error } = await supabase
        .from("kai_chat_conversations")
        .insert({
          user_id: user.id,
          client_id: clientId,
          title: "Nova conversa",
        })
        .select()
        .single();

      if (error) {
        console.error("[useKAISimpleChat] Error creating conversation:", error);
        return null;
      }

      const newId = data.id;
      setConversationId(newId);
      onConversationCreated?.(newId);
      return newId;
    } catch (error) {
      console.error("[useKAISimpleChat] Error creating conversation:", error);
      return null;
    }
  }, [clientId, onConversationCreated]);

  // Clear chat history
  const clearHistory = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  // Cancel ongoing request
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  // Send message and stream response
  const sendMessage = useCallback(async (
    content: string,
    citations?: SimpleCitation[],
    imageUrls?: string[],
    /** F5/UX — se o user clicou num botão de ActionCard (ex: "Aprovar e
        publicar"), o front passa a tool_call desejada. O edge injeta uma
        system nudge pro LLM chamar exatamente essa tool. */
    forceTool?: ForceToolCall,
  ) => {
    if (!content.trim() && (!imageUrls || imageUrls.length === 0)) return;
    if (!clientId) {
      toast.error("Selecione um cliente primeiro");
      return;
    }

    // Cancel any ongoing request
    cancelRequest();

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Ensure we have a conversation
    let activeConversationId = conversationId;
    if (!activeConversationId) {
      activeConversationId = await createConversation();
      if (!activeConversationId) {
        toast.error("Erro ao criar conversa");
        return;
      }
    }

    // Add user message immediately
    const userMessage: SimpleMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
      imageUrl: imageUrls?.[0], // Store first image for display
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Save user message to database
    saveMessage(userMessage, activeConversationId);

    // Prepare assistant message placeholder
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: SimpleMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Não autenticado");
      }

      // Call the simple chat endpoint
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kai-simple-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: content,
            clientId,
            conversationId: activeConversationId,
            imageUrls: imageUrls?.length ? imageUrls : undefined,
            citations: citations?.map(c => ({
              id: c.id,
              type: c.type,
              title: c.title,
            })),
            history: messages.map(m => ({
              role: m.role,
              content: m.content,
              imageUrl: m.imageUrl,
            })),
            // F0.3b — flag de tool-calling mode
            useTools,
            // F5 — dirigir o LLM a chamar uma tool específica (clique em card)
            forceTool,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 402) {
          toast.error("Créditos insuficientes. Adicione mais créditos para continuar.");
          throw new Error("insufficient_credits");
        }
        
        if (response.status === 429) {
          toast.error("Limite de requisições atingido. Aguarde um momento.");
          throw new Error("rate_limited");
        }
        
        if (response.status === 403) {
          toast.error("O kAI Chat requer o plano Pro.");
          throw new Error("upgrade_required");
        }
        
        throw new Error(errorData.error || "Erro ao processar mensagem");
      }

      // Process SSE stream using robust utility
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      let imageUrl: string | undefined;
      // Track tools rodando — usado pra reconciliar se o stream cair (ex:
      // publishNow leva 40s e o proxy derruba a conexão; o post pode ter
      // sido publicado mesmo assim).
      const runningTools = new Map<string, { name: string; startedAt: number }>();
      let streamFailed = false;

      let fullContent = "";
      try {
        fullContent = await streamSSEToCallback(reader, {
          onDelta: (content) => {
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? { ...m, content }
                : m
            ));
          },
          onImage: (url) => {
            imageUrl = url;
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? { ...m, imageUrl: url }
                : m
            ));
          },
          // F0.3b — action cards emitidos pelo tool-loop.
          onActionCard: (card) => {
            // Card chegou — tool terminou, remove do tracking.
            if (card.planning_item_id) {
              runningTools.delete(card.planning_item_id);
            }
            setMessages(prev => prev.map(m => {
              if (m.id !== assistantId) return m;
              const cards = m.actionCards ?? [];
              const idx = cards.findIndex(c => c.id === card.id);
              const next = idx >= 0
                ? cards.map((c, i) => i === idx ? { ...c, ...card } : c)
                : [...cards, card];
              return { ...m, actionCards: next };
            }));
          },
          onToolRunning: (running) => {
            console.log("[KAI] tool running:", running.name, running.label);
            // Tracking de tools longas pra reconciliação em caso de timeout.
            runningTools.set(running.id, { name: running.name, startedAt: Date.now() });
          },
          onError: (errorMsg) => {
            console.error("[KAI] stream error:", errorMsg);
            toast.error(errorMsg);
          },
        });
      } catch (streamErr) {
        // Stream caiu mid-flight. Se havia uma publicação em andamento, pode
        // ter dado certo no backend mesmo assim — confere antes de mostrar erro.
        streamFailed = true;
        const wasPublishing = Array.from(runningTools.values()).some(
          (t) => t.name === "publishNow" || t.name === "scheduleFor" || t.name === "createViralCarousel",
        );
        if (!wasPublishing) throw streamErr;

        console.warn("[KAI] stream caiu durante publicação — reconciliando status no banco…");
        toast.info("Conexão caiu, conferindo se a publicação foi…");

        // Espera 3s pro backend terminar e confere o status do item mais recente
        // do cliente em status publishing/scheduled/published nos últimos 2min.
        await new Promise((r) => setTimeout(r, 3000));
        const since = new Date(Date.now() - 2 * 60_000).toISOString();
        const { data: recent } = await supabase
          .from("planning_items")
          .select("id, status, platform, content, published_at, metadata, media_urls")
          .eq("client_id", clientId)
          .gte("updated_at", since)
          .in("status", ["published", "scheduled", "publishing", "failed"])
          .order("updated_at", { ascending: false })
          .limit(1);

        const item = recent?.[0];
        if (item && (item.status === "published" || item.status === "scheduled")) {
          const meta = (item.metadata ?? {}) as Record<string, unknown>;
          const publishedUrls = (meta.published_urls ?? {}) as Record<string, string>;
          const reconciledCard: KAIActionCard = {
            id: `card_reconciled_${item.id}`,
            planning_item_id: item.id,
            type: item.status === "published" ? "published" : "scheduled",
            status: "done",
            data: item.status === "published"
              ? {
                  kind: "published",
                  clientId,
                  platform: item.platform ?? "",
                  externalUrl: publishedUrls[item.platform ?? ""],
                  publishedAt: item.published_at ?? new Date().toISOString(),
                  body: item.content ?? "",
                  mediaUrls: Array.isArray(item.media_urls) ? (item.media_urls as string[]) : undefined,
                }
              : {
                  kind: "scheduled",
                  clientId,
                  platform: item.platform ?? "",
                  scheduledFor: (item as { scheduled_at?: string }).scheduled_at ?? new Date().toISOString(),
                  body: item.content ?? "",
                  mediaUrls: Array.isArray(item.media_urls) ? (item.media_urls as string[]) : undefined,
                  planningItemId: item.id,
                },
            requires_approval: false,
            available_actions: [],
          };
          fullContent = "Publicação confirmada (a conexão caiu mas o post foi enviado).";
          setMessages(prev => prev.map(m => m.id === assistantId ? {
            ...m,
            content: fullContent,
            actionCards: [...(m.actionCards ?? []), reconciledCard],
          } : m));
          toast.success("Publicado com sucesso ✓");
        } else {
          // Não confirmamos sucesso — propaga o erro original.
          throw streamErr;
        }
      }

      // Ensure final content is set — preserva actionCards acumulados durante o stream
      if (!streamFailed) {
        setMessages(prev => prev.map(m => {
          if (m.id !== assistantId) return m;
          return {
            ...m,
            content: fullContent || m.content || "Desculpe, não consegui gerar uma resposta.",
            timestamp: new Date(),
            imageUrl,
          };
        }));
      }

      // Save assistant message to database (actionCards não persistem por ora
      // — quando o user recarregar a conversa, os cards somem. Persistência de
      // cards vai na F1 junto com planning_items real.)
      saveMessage(
        {
          id: assistantId,
          role: "assistant",
          content: fullContent || "Desculpe, não consegui gerar uma resposta.",
          timestamp: new Date(),
          imageUrl,
        },
        activeConversationId,
      );

    } catch (error) {
      if ((error as Error).name === "AbortError") {
        // Request was cancelled, remove empty assistant message
        setMessages(prev => prev.filter(m => m.id !== assistantId));
        return;
      }

      console.error("[useKAISimpleChat] Error:", error);
      
      // Update assistant message with error
      const errorMessage = (error as Error).message === "insufficient_credits"
        ? "Créditos insuficientes para continuar. Por favor, adicione mais créditos."
        : (error as Error).message === "upgrade_required"
        ? "O kAI Chat está disponível apenas no plano Pro."
        : "Desculpe, ocorreu um erro. Tente novamente.";

      setMessages(prev => prev.map(m => 
        m.id === assistantId 
          ? { ...m, content: errorMessage }
          : m
      ));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [clientId, messages, cancelRequest, conversationId, createConversation, saveMessage]);

  return {
    messages,
    isLoading,
    sendMessage,
    clearHistory,
    cancelRequest,
    conversationId,
    loadMessages,
  };
}
