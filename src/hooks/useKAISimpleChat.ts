import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SimpleMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageUrl?: string;
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
}

export function useKAISimpleChat({ 
  clientId, 
  conversationId: externalConversationId,
  onConversationCreated 
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
    citations?: SimpleCitation[]
  ) => {
    if (!content.trim()) return;
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
            citations: citations?.map(c => ({
              id: c.id,
              type: c.type,
              title: c.title,
            })),
            history: messages.slice(-10).map(m => ({
              role: m.role,
              content: m.content,
            })),
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

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let imageUrl: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          
          if (data === "[DONE]") continue;
          
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            
            if (delta?.content) {
              fullContent += delta.content;
              // Update message content
              setMessages(prev => prev.map(m => 
                m.id === assistantId 
                  ? { ...m, content: fullContent }
                  : m
              ));
            }
            
            // Check for image in response
            if (delta?.image) {
              imageUrl = delta.image;
              setMessages(prev => prev.map(m => 
                m.id === assistantId 
                  ? { ...m, imageUrl }
                  : m
              ));
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }

      // Ensure final content is set
      const finalAssistantMessage: SimpleMessage = {
        id: assistantId,
        role: "assistant",
        content: fullContent || "Desculpe, não consegui gerar uma resposta.",
        timestamp: new Date(),
        imageUrl,
      };

      setMessages(prev => prev.map(m => 
        m.id === assistantId ? finalAssistantMessage : m
      ));

      // Save assistant message to database
      saveMessage(finalAssistantMessage, activeConversationId);

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
