// useTopViralContent — top conteúdos do cliente ranqueados por engagement.
// Fonte: materialized view `client_top_content` (migration 0011).
// Usado por TopViralContentCard no Home + ClientAnalyticsTab.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TopViralContentRow {
  id: string;
  client_id: string;
  title: string | null;
  content: string | null;
  content_type: string | null;
  metadata: Record<string, any> | null;
  engagement_score: number | null;
  created_at: string;
  rank: number;
}

export function useTopViralContent(opts: {
  clientId?: string | null;
  limit?: number;
} = {}) {
  const limit = opts.limit ?? 5;

  return useQuery<TopViralContentRow[]>({
    queryKey: ["top-viral-content", opts.clientId ?? null, limit],
    enabled: !!opts.clientId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!opts.clientId) return [];
      const { data, error } = await (supabase as any)
        .from("client_top_content")
        .select("*")
        .eq("client_id", opts.clientId)
        .order("rank", { ascending: true })
        .limit(limit);
      if (error) {
        console.warn("[useTopViralContent] error:", error.message);
        return [];
      }
      return (data || []) as TopViralContentRow[];
    },
  });
}
