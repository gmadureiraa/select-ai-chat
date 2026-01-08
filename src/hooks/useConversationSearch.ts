import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  message_id: string;
  content: string;
  role: string;
  created_at: string;
  conversation_id: string;
  conversation_title: string;
  rank: number;
}

export const useConversationSearch = (clientId: string) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const { data: results, refetch, isLoading } = useQuery({
    queryKey: ["conversation-search", clientId, searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 3) return [];

      const { data, error } = await supabase.rpc("search_messages", {
        p_client_id: clientId,
        p_query: searchQuery,
        p_limit: 50,
      });

      if (error) throw error;
      return (data as SearchResult[]) || [];
    },
    enabled: false,
  });

  const search = async (query: string) => {
    setSearchQuery(query);
    if (query.length >= 3) {
      setIsSearching(true);
      await refetch();
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  return {
    searchQuery,
    results: results || [],
    isSearching: isSearching || isLoading,
    search,
    clearSearch,
  };
};
