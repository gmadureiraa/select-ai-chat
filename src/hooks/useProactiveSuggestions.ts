import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProactiveSuggestion {
  id: string;
  client_id: string;
  suggestion_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  is_dismissed: boolean;
  is_used: boolean;
  created_at: string;
}

export const useProactiveSuggestions = (clientId: string) => {
  const queryClient = useQueryClient();

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["proactive-suggestions", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proactive_suggestions")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_dismissed", false)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as ProactiveSuggestion[];
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 5,
  });

  const dismissMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabase
        .from("proactive_suggestions")
        .update({ is_dismissed: true })
        .eq("id", suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proactive-suggestions", clientId] });
    },
  });

  const useSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabase
        .from("proactive_suggestions")
        .update({ is_used: true })
        .eq("id", suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proactive-suggestions", clientId] });
    },
  });

  return {
    suggestions: suggestions || [],
    isLoading,
    dismissSuggestion: dismissMutation.mutate,
    useSuggestion: useSuggestionMutation.mutate,
  };
};
