import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const useClientChat = (clientId: string) => {
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Get client context
  const { data: client } = useQuery({
    queryKey: ["client-context", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("name, context_notes")
        .eq("id", clientId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const sendMessage = async (content: string) => {
    if (!conversationId || !client) return;

    setIsLoading(true);

    try {
      // Save user message
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content,
      });

      if (insertError) throw insertError;

      // Invalidate to show user message immediately
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });

      // Build messages with context
      const contextMessage = client.context_notes
        ? `Contexto fixo sobre o cliente ${client.name}: ${client.context_notes}\n\n`
        : "";

      const messagesWithContext = [
        {
          role: "system" as const,
          content: `${contextMessage}Você é um assistente útil para ajudar com tarefas relacionadas ao cliente ${client.name}.`,
        },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content },
      ];

      // Call AI
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: messagesWithContext,
          model: selectedModel,
        },
      });

      if (error) throw error;

      const reader = data.body?.getReader();
      const decoder = new TextDecoder();
      let aiResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || "";
                aiResponse += content;
              } catch (e) {
                console.error("Error parsing chunk:", e);
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

      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    isLoading,
    selectedModel,
    setSelectedModel,
    sendMessage,
  };
};
