import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ResearchMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export const useResearchChat = (projectId?: string, model: string = "google/gemini-2.5-flash") => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);

  // Get or create conversation
  const { data: conversation } = useQuery({
    queryKey: ["research-conversation", projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const { data: existing } = await supabase
        .from("research_conversations")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (existing) return existing;

      const { data: newConv, error } = await supabase
        .from("research_conversations")
        .insert({ project_id: projectId, model })
        .select()
        .single();

      if (error) throw error;
      return newConv;
    },
    enabled: !!projectId,
  });

  // Get messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["research-messages", conversation?.id],
    queryFn: async () => {
      if (!conversation?.id) return [];

      const { data, error } = await supabase
        .from("research_messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as ResearchMessage[];
    },
    enabled: !!conversation?.id,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!conversation?.id || !projectId) throw new Error("No conversation");

      // Save user message
      const { data: userMsg, error: userError } = await supabase
        .from("research_messages")
        .insert({
          conversation_id: conversation.id,
          role: "user",
          content,
        })
        .select()
        .single();

      if (userError) throw userError;

      // Invalidate to show user message immediately
      queryClient.invalidateQueries({ queryKey: ["research-messages", conversation.id] });

      // Call edge function to get AI response
      setIsStreaming(true);
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke("analyze-research", {
        body: { projectId, conversationId: conversation.id, userMessage: content, model },
      });

      setIsStreaming(false);

      if (aiError) throw aiError;

      // Save assistant response
      const { error: assistantError } = await supabase
        .from("research_messages")
        .insert({
          conversation_id: conversation.id,
          role: "assistant",
          content: aiResponse.response,
        });

      if (assistantError) throw assistantError;

      return aiResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-messages", conversation?.id] });
    },
    onError: (error: any) => {
      setIsStreaming(false);
      toast({
        title: "Erro no chat",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    messages,
    isLoading,
    isStreaming,
    sendMessage,
    conversationId: conversation?.id,
  };
};
