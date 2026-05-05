/**
 * Hook de busca por hashtag no Instagram com paginação (infinite scroll)
 * + fallback de histórico salvo.
 */
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InstagramPostItem {
  id: string;
  shortCode: string | null;
  url: string;
  type: string;
  caption: string;
  hashtags: string[];
  ownerUsername: string;
  ownerFullName: string;
  thumbnailUrl: string;
  videoUrl: string | null;
  likesCount: number | null;
  commentsCount: number | null;
  videoPlayCount: number | null;
  videoViewCount: number | null;
  timestamp: string | null;
}

interface Page {
  items: InstagramPostItem[];
  nextPageToken: string | null;
  source: string;
}

export function useInstagramSearchInfinite(params: {
  hashtag: string;
  limit?: number;
  enabled?: boolean;
  clientId?: string;
  workspaceId?: string;
}) {
  const { hashtag, limit = 12, enabled = true, clientId, workspaceId } = params;
  return useInfiniteQuery<Page>({
    queryKey: ["ig-search", hashtag, limit],
    initialPageParam: 0 as number,
    queryFn: async ({ pageParam }): Promise<Page> => {
      if (!hashtag.trim()) return { items: [], nextPageToken: null, source: "empty" };
      const { data, error } = await supabase.functions.invoke("instagram-search", {
        body: { hashtag, limit, offset: pageParam, clientId, workspaceId },
      });
      if (error) throw new Error((error as any)?.message ?? "Erro Instagram");
      if (data?.error) throw new Error(data.error);
      return {
        items: (data?.items ?? []) as InstagramPostItem[],
        nextPageToken: data?.nextPageToken ?? null,
        source: data?.source ?? "apify-instagram",
      };
    },
    getNextPageParam: (last) => (last.nextPageToken ? Number(last.nextPageToken) : undefined),
    enabled: enabled && !!hashtag.trim(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useInstagramSearchHistory(params: { clientId: string; enabled?: boolean }) {
  return useQuery({
    queryKey: ["ig-search-history", params.clientId],
    queryFn: async (): Promise<{ items: InstagramPostItem[]; query: string; cachedAt: string } | null> => {
      const { data, error } = await supabase
        .from("viral_search_cache")
        .select("items, query, created_at")
        .eq("client_id", params.clientId)
        .eq("source", "instagram")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return {
        items: (data.items as unknown as InstagramPostItem[]) ?? [],
        query: data.query,
        cachedAt: data.created_at,
      };
    },
    enabled: params.enabled !== false && !!params.clientId,
    staleTime: 60 * 1000,
  });
}
