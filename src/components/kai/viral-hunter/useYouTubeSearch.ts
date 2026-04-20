/**
 * Busca vídeos do YouTube Data API v3 direto do client (CORS liberado).
 *
 * API key vem de `import.meta.env.VITE_YT_API_KEY` quando configurada.
 * Se não configurada, retorna vazio com aviso — tab mostra empty state.
 */

import { useQuery } from "@tanstack/react-query";
import type { YouTubeVideoItem } from "./types";

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

interface YTSearchItem {
  id: { kind: string; videoId?: string; channelId?: string };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
    channelTitle: string;
  };
}

interface YTVideoStats {
  id: string;
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

export function getYoutubeApiKey(): string | null {
  const key = (import.meta.env.VITE_YT_API_KEY as string | undefined) ?? null;
  return key && key.length > 10 ? key : null;
}

export function useYouTubeSearch(params: {
  query: string;
  maxResults?: number;
  order?: "relevance" | "date" | "viewCount" | "rating";
  publishedAfter?: string; // ISO
  enabled?: boolean;
}) {
  const { query, maxResults = 12, order = "viewCount", publishedAfter, enabled = true } = params;
  const apiKey = getYoutubeApiKey();

  return useQuery<YouTubeVideoItem[]>({
    queryKey: ["yt-search", query, maxResults, order, publishedAfter],
    queryFn: async (): Promise<YouTubeVideoItem[]> => {
      if (!apiKey) return [];
      if (!query.trim()) return [];

      // 1. Search endpoint — retorna ids + snippet
      const searchUrl = new URL(`${YT_API_BASE}/search`);
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("maxResults", String(maxResults));
      searchUrl.searchParams.set("order", order);
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("key", apiKey);
      if (publishedAfter) searchUrl.searchParams.set("publishedAfter", publishedAfter);

      const searchRes = await fetch(searchUrl.toString());
      if (!searchRes.ok) {
        const errText = await searchRes.text().catch(() => "");
        throw new Error(`YouTube API ${searchRes.status}: ${errText.slice(0, 200)}`);
      }
      const searchJson = await searchRes.json();
      const items: YTSearchItem[] = searchJson.items ?? [];
      const videoIds = items.map((i) => i.id.videoId).filter(Boolean) as string[];
      if (videoIds.length === 0) return [];

      // 2. Videos endpoint — busca statistics (views, likes, comments)
      const videosUrl = new URL(`${YT_API_BASE}/videos`);
      videosUrl.searchParams.set("part", "statistics");
      videosUrl.searchParams.set("id", videoIds.join(","));
      videosUrl.searchParams.set("key", apiKey);
      const videosRes = await fetch(videosUrl.toString());
      const videosJson = await videosRes.json();
      const statsById = new Map<string, YTVideoStats>();
      for (const v of (videosJson.items ?? []) as YTVideoStats[]) {
        statsById.set(v.id, v);
      }

      return items
        .filter((i) => i.id.videoId)
        .map((i): YouTubeVideoItem => {
          const id = i.id.videoId!;
          const stats = statsById.get(id)?.statistics;
          const thumb =
            i.snippet.thumbnails.high?.url ??
            i.snippet.thumbnails.medium?.url ??
            i.snippet.thumbnails.default?.url ??
            "";
          return {
            id,
            title: i.snippet.title,
            channelTitle: i.snippet.channelTitle,
            channelId: i.snippet.channelId,
            thumbnailUrl: thumb,
            publishedAt: i.snippet.publishedAt,
            description: i.snippet.description,
            url: `https://www.youtube.com/watch?v=${id}`,
            viewCount: stats?.viewCount ? parseInt(stats.viewCount, 10) : undefined,
            likeCount: stats?.likeCount ? parseInt(stats.likeCount, 10) : undefined,
            commentCount: stats?.commentCount ? parseInt(stats.commentCount, 10) : undefined,
          };
        });
    },
    enabled: enabled && !!query.trim() && !!apiKey,
    staleTime: 10 * 60 * 1000,
  });
}
