/**
 * Busca notícias via edge function `google-news-search` com cache automático.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NewsItem } from "./types";

export function useGoogleNews(params: {
  query: string;
  lang?: string;
  region?: string;
  enabled?: boolean;
  clientId?: string;
  workspaceId?: string;
}) {
  const { query, lang = "pt-BR", region = "BR", enabled = true, clientId, workspaceId } = params;

  return useQuery<NewsItem[]>({
    queryKey: ["google-news", query, lang, region],
    queryFn: async (): Promise<NewsItem[]> => {
      if (!query.trim()) return [];
      const { data, error } = await supabase.functions.invoke("google-news-search", {
        body: { query, lang, region, clientId, workspaceId },
      });
      if (error) {
        console.warn("[useGoogleNews] erro:", error);
        return [];
      }
      return (data?.items ?? []) as NewsItem[];
    },
    enabled: enabled && !!query.trim(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGoogleNewsHistory(params: { clientId: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ["google-news-history", params.clientId],
    queryFn: async (): Promise<{ items: NewsItem[]; query: string; cachedAt: string } | null> => {
      const { data, error } = await supabase
        .from("viral_search_cache")
        .select("items, query, created_at")
        .eq("client_id", params.clientId)
        .eq("source", "news")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return {
        items: (data.items as unknown as NewsItem[]) ?? [],
        query: data.query,
        cachedAt: data.created_at,
      };
    },
    enabled: params.enabled !== false && !!params.clientId,
    staleTime: 60 * 1000,
  });
}
