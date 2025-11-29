import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: Date;
}

export const useChat = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
  const { toast } = useToast();

  const currentConversation = conversations.find((c) => c.id === currentConversationId);

  const createNewConversation = useCallback(() => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: "Nova conversa",
      messages: [],
      timestamp: new Date(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentConversationId) {
        createNewConversation();
        return;
      }

      const userMessage: Message = { role: "user", content };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === currentConversationId
            ? {
                ...conv,
                messages: [...conv.messages, userMessage],
                title: conv.messages.length === 0 ? content.slice(0, 50) : conv.title,
              }
            : conv
        )
      );

      setIsLoading(true);

      try {
        const conv = conversations.find((c) => c.id === currentConversationId);
        const messages = [...(conv?.messages || []), userMessage];

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ messages, model: selectedModel }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Erro ao enviar mensagem");
        }

        if (!response.body) {
          throw new Error("Sem resposta do servidor");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        let textBuffer = "";

        // Add empty assistant message
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === currentConversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, { role: "assistant", content: "" }],
                }
              : conv
          )
        );

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              
              if (delta) {
                assistantContent += delta;
                setConversations((prev) =>
                  prev.map((conv) =>
                    conv.id === currentConversationId
                      ? {
                          ...conv,
                          messages: conv.messages.map((msg, idx) =>
                            idx === conv.messages.length - 1
                              ? { ...msg, content: assistantContent }
                              : msg
                          ),
                        }
                      : conv
                  )
                );
              }
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }
      } catch (error) {
        console.error("Error sending message:", error);
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro ao enviar mensagem",
          variant: "destructive",
        });

        // Remove the empty assistant message on error
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === currentConversationId
              ? {
                  ...conv,
                  messages: conv.messages.slice(0, -1),
                }
              : conv
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [currentConversationId, conversations, selectedModel, createNewConversation, toast]
  );

  return {
    conversations,
    currentConversation,
    currentConversationId,
    isLoading,
    selectedModel,
    setSelectedModel,
    createNewConversation,
    setCurrentConversationId,
    sendMessage,
  };
};
