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

export const useResearchChat = (
  projectId?: string, 
  itemId?: string, 
  model: string = "google/gemini-2.5-flash",
  clientId?: string,
  onProgressUpdate?: (progress: string[]) => void
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);

  // Se itemId for fornecido, cria conversa isolada para aquele item específico
  const conversationKey = itemId || projectId;

  // Get or create conversation
  const { data: conversation } = useQuery({
    queryKey: ["research-conversation", conversationKey],
    queryFn: async () => {
      if (!conversationKey || !projectId) return null;

      // Se temos itemId, buscar conversa específica desse item
      // Senão, buscar conversa geral do projeto
      const { data: existingConversations } = await supabase
        .from("research_conversations")
        .select("*")
        .eq("project_id", projectId);
      
      let existing = null;
      if (itemId && existingConversations) {
        // Filtrar por itemId no metadata
        existing = existingConversations.find((conv: any) => 
          conv.metadata && conv.metadata.itemId === itemId
        );
      } else if (!itemId && existingConversations) {
        // Buscar conversa sem itemId no metadata
        existing = existingConversations.find((conv: any) => 
          !conv.metadata || !conv.metadata.itemId
        );
      }

      if (existing) return existing;

      const insertData: any = {
        project_id: projectId,
        model,
      };
      
      if (itemId) {
        insertData.metadata = { itemId };
      }

      const { data: newConv, error } = await supabase
        .from("research_conversations")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return newConv;
    },
    enabled: !!conversationKey,
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

      // Se temos itemId, passar connectedItemIds para a edge function
      let connectedItemIds: string[] | undefined;
      if (itemId) {
        // Buscar conexões deste item
        const { data: connections } = await supabase
          .from("research_connections")
          .select("source_id, target_id")
          .or(`source_id.eq.${itemId},target_id.eq.${itemId}`);
        
        if (connections && connections.length > 0) {
          connectedItemIds = Array.from(
            new Set(
              connections.flatMap(c => [
                c.source_id === itemId ? c.target_id : c.source_id
              ])
            )
          );
        }
      }

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
        body: {
          projectId,
          conversationId: conversation.id,
          userMessage: content,
          model,
          clientId,
          connectedItemIds, // Passar IDs dos items conectados
        },
      });

      setIsStreaming(false);

      if (aiError) throw aiError;
      
      // Update progress if available
      if (onProgressUpdate && aiResponse.progress) {
        onProgressUpdate(aiResponse.progress);
      }

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