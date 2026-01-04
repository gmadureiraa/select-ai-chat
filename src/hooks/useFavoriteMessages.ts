import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export interface FavoriteMessage {
  id: string;
  message_id: string;
  client_id: string;
  user_id: string;
  note: string | null;
  created_at: string;
  message?: {
    content: string;
    role: string;
    created_at: string;
  };
}

export function useFavoriteMessages(clientId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["favorite-messages", clientId],
    queryFn: async () => {
      if (!clientId || !user?.id) return [];

      const { data, error } = await supabase
        .from("favorite_messages")
        .select(`
          *,
          message:messages!favorite_messages_message_id_fkey(content, role, created_at)
        `)
        .eq("client_id", clientId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as FavoriteMessage[];
    },
    enabled: !!clientId && !!user?.id
  });

  const isFavorite = (messageId: string): boolean => {
    return favorites.some(f => f.message_id === messageId);
  };

  const toggleFavorite = useMutation({
    mutationFn: async ({ messageId, note }: { messageId: string; note?: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const existing = favorites.find(f => f.message_id === messageId);

      if (existing) {
        // Remove favorite
        const { error } = await supabase
          .from("favorite_messages")
          .delete()
          .eq("id", existing.id);

        if (error) throw error;
        return { action: "removed" };
      } else {
        // Add favorite
        const { error } = await supabase
          .from("favorite_messages")
          .insert({
            message_id: messageId,
            client_id: clientId,
            user_id: user.id,
            note: note || null
          });

        if (error) throw error;
        return { action: "added" };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["favorite-messages", clientId] });
      toast({
        title: result.action === "added" ? "Adicionado aos favoritos" : "Removido dos favoritos"
      });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar favoritos",
        variant: "destructive"
      });
    }
  });

  return {
    favorites,
    isLoading,
    isFavorite,
    toggleFavorite: toggleFavorite.mutate,
    isToggling: toggleFavorite.isPending
  };
}
