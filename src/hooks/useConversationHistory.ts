import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Conversation } from "@/types/chat";

/**
 * Hook para gerenciar histórico de conversas por cliente
 */
export const useConversationHistory = (clientId: string) => {
  return useQuery({
    queryKey: ["conversation-history", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};

export const createNewConversation = async (
  clientId: string,
  model: string,
  title: string = "Nova Conversa",
  templateId?: string | null
) => {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      client_id: clientId,
      title,
      model,
      template_id: templateId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Conversation;
};

export const updateConversationTitle = async (
  conversationId: string,
  title: string
) => {
  const { error } = await supabase
    .from("conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) throw error;
};
