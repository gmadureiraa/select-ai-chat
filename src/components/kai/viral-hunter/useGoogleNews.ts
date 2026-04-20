/**
 * Busca notícias via edge function `google-news-search` (parsing direto do RSS
 * do Google News no servidor, sem proxies de terceiros frágeis).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NewsItem } from "./types";

export function useGoogleNews(params: {
  query: string;
  lang?: string;
  region?: string;
  enabled?: boolean;
}) {
  const { query, lang = "pt-BR", region = "BR", enabled = true } = params;

  return useQuery<NewsItem[]>({
    queryKey: ["google-news", query, lang, region],
    queryFn: async (): Promise<NewsItem[]> => {
      if (!query.trim()) return [];
      const { data, error } = await supabase.functions.invoke("google-news-search", {
        body: { query, lang, region },
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
