/**
 * Busca imagens via edge function `image-search`.
 *
 * Fonte padrão: Openverse (Creative Commons, sem cadastro nem API key).
 * Fonte alternativa: Pexels (se PEXELS_API_KEY estiver configurada no backend).
 *
 * Retorna lista de imagens normalizadas pra exibir numa galeria — usuário
 * clica na que prefere e a URL grande vai pro slide.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ImageSearchResult {
  id: string;
  url: string;          // imagem em tamanho grande (vai pro slide)
  thumbnail: string;    // thumbnail pra galeria
  attribution: string;  // crédito do autor / licença
  sourceUrl: string;    // página de origem (link de crédito)
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

  const { data, error } = await supabase.functions.invoke("image-search", {
    body: {
      query: q,
      perPage: opts.perPage ?? 12,
      // Pexels é o default agora (qualidade fotográfica superior).
      // Openverse fica como fallback automático no backend.
      source: opts.source ?? "pexels",
    },
  });
  if (error) throw new Error(error.message);
  return {
    items: (data?.items ?? []) as ImageSearchResult[],
    source: (data?.source ?? "pexels") as "openverse" | "pexels",
  };
}
