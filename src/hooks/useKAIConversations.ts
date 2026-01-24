import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KAIConversation {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

interface UseKAIConversationsOptions {
  clientId: string | null;
}

export function useKAIConversations({ clientId }: UseKAIConversationsOptions) {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Fetch conversations for this client
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["kai-conversations", clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from("kai_chat_conversations")
        .select("*")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("[useKAIConversations] Error fetching:", error);
        return [];
      }

      return data as KAIConversation[];
    },
    enabled: !!clientId,
    staleTime: 30000,
  });

  // Create new conversation
  const createConversationMutation = useMutation({
    mutationFn: async ({ title = "Nova conversa" }: { title?: string }) => {
      if (!clientId) throw new Error("No client selected");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("kai_chat_conversations")
        .insert({
          user_id: user.id,
          client_id: clientId,
          title,
        })
        .select()
        .single();

      if (error) throw error;
      return data as KAIConversation;
    },
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ["kai-conversations", clientId] });
      setActiveConversationId(newConversation.id);
    },
  });

  // Update conversation title
  const updateTitleMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("kai_chat_conversations")
        .update({ title })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kai-conversations", clientId] });
    },
  });

  // Delete conversation
  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("kai_chat_conversations")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["kai-conversations", clientId] });
      if (activeConversationId === deletedId) {
        setActiveConversationId(null);
      }
    },
  });

  // Get or create conversation for the client
  const getOrCreateConversation = useCallback(async () => {
    if (!clientId) return null;

    // If there's an active conversation, use it
    if (activeConversationId) {
      return activeConversationId;
    }

    // Check if there are existing conversations
    if (conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
      return conversations[0].id;
    }

    // Create a new conversation
    try {
      const newConv = await createConversationMutation.mutateAsync({ title: "Nova conversa" });
      return newConv.id;
    } catch (error) {
      console.error("[useKAIConversations] Error creating conversation:", error);
      return null;
    }
  }, [clientId, activeConversationId, conversations, createConversationMutation]);

  return {
    conversations,
    isLoading,
    activeConversationId,
    setActiveConversationId,
    createConversation: createConversationMutation.mutateAsync,
    updateTitle: updateTitleMutation.mutateAsync,
    deleteConversation: deleteConversationMutation.mutateAsync,
    getOrCreateConversation,
  };
}
