/**
 * Busca imagens stock via handler `image-search` (Pexels primary, Openverse fallback).
 */

import { apiInvoke } from "@/lib/apiInvoke";

export interface ImageSearchResult {
  id: string;
  url: string;
  thumbnail: string;
  attribution: string;
  sourceUrl: string;
  source: "openverse" | "pexels";
}

export interface ImageSearchResponse {
  items: ImageSearchResult[];
  source: "openverse" | "pexels";
}

export async function searchImages(
  query: string,
  opts: { perPage?: number; source?: "openverse" | "pexels" } = {},
): Promise<ImageSearchResponse> {
  const q = query.trim();
  if (!q) return { items: [], source: "pexels" };

  const { data, error } = await apiInvoke("image-search", {
    body: {
      query: q,
      perPage: opts.perPage ?? 12,
      source: opts.source ?? "pexels",
    },
  });
  if (error) throw new Error(error.message);
  return {
    items: (data?.items ?? []) as ImageSearchResult[],
    source: (data?.source ?? "pexels") as "openverse" | "pexels",
  };
}
