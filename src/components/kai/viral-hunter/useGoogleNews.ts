/**
 * Busca notícias via Google News RSS.
 *
 * RSS do Google News não tem CORS liberado — usar um proxy público
 * (rss2json.com) pra resolver. Gratuito com rate limit ~10k/dia.
 */

import { useQuery } from "@tanstack/react-query";
import type { NewsItem } from "./types";

const GNEWS_URL = (q: string, lang = "pt-BR", region = "BR") =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${lang}&gl=${region}&ceid=${region}:${lang.split("-")[0]}`;

const RSS2JSON = (rssUrl: string) =>
  `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

interface RSS2JSONResponse {
  status: string;
  items: Array<{
    title: string;
    link: string;
    pubDate: string;
    description: string;
    thumbnail?: string;
    author?: string;
    guid?: string;
  }>;
}

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
      const rssUrl = GNEWS_URL(query, lang, region);
      const res = await fetch(RSS2JSON(rssUrl));
      if (!res.ok) throw new Error(`News proxy ${res.status}`);
      const data = (await res.json()) as RSS2JSONResponse;
      if (data.status !== "ok") return [];

      return (data.items ?? []).slice(0, 24).map((it, i): NewsItem => {
        // Google News title vem com formato "Título - Fonte"
        const parts = it.title.split(" - ");
        const source = parts.length > 1 ? parts[parts.length - 1] : it.author ?? "Fonte desconhecida";
        const title = parts.length > 1 ? parts.slice(0, -1).join(" - ") : it.title;
        // Strip HTML do snippet
        const snippet = it.description
          ?.replace(/<[^>]+>/g, "")
          .slice(0, 280)
          .trim();
        return {
          id: it.guid ?? `${it.link}-${i}`,
          title,
          source,
          url: it.link,
          publishedAt: it.pubDate,
          snippet,
          thumbnailUrl: it.thumbnail,
        };
      });
    },
    enabled: enabled && !!query.trim(),
    staleTime: 5 * 60 * 1000,
  });
}
