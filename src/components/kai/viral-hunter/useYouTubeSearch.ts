/**
 * Busca vídeos do YouTube via edge function `youtube-search`.
 * A API key fica no servidor (segurança).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { YouTubeVideoItem } from "./types";

export function useYouTubeSearch(params: {
  query: string;
  maxResults?: number;
  order?: "relevance" | "date" | "viewCount" | "rating";
  publishedAfter?: string;
  enabled?: boolean;
}) {
  const { query, maxResults = 12, order = "viewCount", publishedAfter, enabled = true } = params;

  return useQuery<YouTubeVideoItem[]>({
    queryKey: ["yt-search", query, maxResults, order, publishedAfter],
    queryFn: async (): Promise<YouTubeVideoItem[]> => {
      if (!query.trim()) return [];
      const { data, error } = await supabase.functions.invoke("youtube-search", {
        body: { query, maxResults, order, publishedAfter },
      });
      if (error) {
        // Bubble up to UI so user sees real cause (403, etc)
        throw new Error((error as any)?.message ?? "Erro YouTube");
      }
      if (data?.error) {
        throw new Error(data.hint ? `${data.error} — ${data.hint}` : data.error);
      }
      return (data?.items ?? []) as YouTubeVideoItem[];
    },
    enabled: enabled && !!query.trim(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
