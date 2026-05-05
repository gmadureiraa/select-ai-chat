/**
 * Busca vídeos do YouTube via edge function `youtube-search` com paginação
 * (infinite scroll) + cache automático no banco.
 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { YouTubeVideoItem } from "./types";

interface SearchPage {
  items: YouTubeVideoItem[];
  nextPageToken: string | null;
  source: "youtube-api" | "apify-fallback" | string;
}

export function useYouTubeSearchInfinite(params: {
  query: string;
  maxResults?: number;
  order?: "relevance" | "date" | "viewCount" | "rating";
  publishedAfter?: string;
  enabled?: boolean;
  clientId?: string;
  workspaceId?: string;
}) {
  const { query, maxResults = 12, order = "viewCount", publishedAfter, enabled = true, clientId, workspaceId } = params;

  return useInfiniteQuery<SearchPage>({
    queryKey: ["yt-search-infinite", query, maxResults, order, publishedAfter],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<SearchPage> => {
      if (!query.trim()) return { items: [], nextPageToken: null, source: "empty" };
      const { data, error } = await supabase.functions.invoke("youtube-search", {
        body: { query, maxResults, order, publishedAfter, pageToken: pageParam, clientId, workspaceId },
      });
      if (error) throw new Error((error as any)?.message ?? "Erro YouTube");
      if (data?.error) throw new Error(data.hint ? `${data.error} — ${data.hint}` : data.error);
      return {
        items: (data?.items ?? []) as YouTubeVideoItem[],
        nextPageToken: data?.nextPageToken ?? null,
        source: data?.source ?? "youtube-api",
      };
    },
    getNextPageParam: (last) => last.nextPageToken ?? undefined,
    enabled: enabled && !!query.trim(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** Busca o último cache do banco — fallback quando a busca live falha. */
export function useYouTubeSearchHistory(params: {
  clientId: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["yt-search-history", params.clientId],
    queryFn: async (): Promise<{ items: YouTubeVideoItem[]; query: string; cachedAt: string } | null> => {
      const { data, error } = await supabase
        .from("viral_search_cache")
        .select("items, query, created_at")
        .eq("client_id", params.clientId)
        .eq("source", "youtube")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return {
        items: (data.items as unknown as YouTubeVideoItem[]) ?? [],
        query: data.query,
        cachedAt: data.created_at,
      };
    },
    enabled: params.enabled !== false && !!params.clientId,
    staleTime: 60 * 1000,
  });
}

// Backward-compat (single-page) — used elsewhere if needed.
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
      if (error) throw new Error((error as any)?.message ?? "Erro YouTube");
      if (data?.error) throw new Error(data.hint ? `${data.error} — ${data.hint}` : data.error);
      return (data?.items ?? []) as YouTubeVideoItem[];
    },
    enabled: enabled && !!query.trim(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
