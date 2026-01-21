import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SimpleMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface SimpleCitation {
  id: string;
  type: "content" | "reference" | "format";
  title: string;
}

interface UseKAISimpleChatOptions {
  clientId: string;
}

export function useKAISimpleChat({ clientId }: UseKAISimpleChatOptions) {
  const [messages, setMessages] = useState<SimpleMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clear chat history
  const clearHistory = useCallback(() => {
    setMessages([]);
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

    // Add user message immediately
    const userMessage: SimpleMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Prepare assistant message placeholder
    const assistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }]);

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
            const delta = parsed.choices?.[0]?.delta?.content;
            
            if (delta) {
              fullContent += delta;
              // Update message content
              setMessages(prev => prev.map(m => 
                m.id === assistantId 
                  ? { ...m, content: fullContent }
                  : m
              ));
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }

      // Ensure final content is set
      setMessages(prev => prev.map(m => 
        m.id === assistantId 
          ? { ...m, content: fullContent || "Desculpe, não consegui gerar uma resposta." }
          : m
      ));

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
  }, [clientId, messages, cancelRequest]);

  return {
    messages,
    isLoading,
    sendMessage,
    clearHistory,
    cancelRequest,
  };
}
