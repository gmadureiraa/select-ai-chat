/**
 * Busca de imagens via Unsplash (público, sem auth pra demo).
 *
 * Unsplash Source API (unsplash.com/source) devolve uma imagem aleatória
 * pro termo. Zero auth, zero rate limit documentado (best-effort).
 *
 * Pro futuro: se quiser galeria com múltiplas opções, migrar pra
 * Unsplash API oficial (precisa API key). Por ora Source é suficiente
 * pro user ver algo decente no card.
 */

interface SearchImageParams {
  query: string;
  orientation?: "landscape" | "portrait" | "squarish";
}

export function buildUnsplashSourceUrl({
  query,
  orientation = "landscape",
}: SearchImageParams): string {
  const size = orientation === "landscape"
    ? "1600x900"
    : orientation === "portrait"
      ? "900x1200"
      : "1200x1200";
  const q = encodeURIComponent(query.trim() || "abstract");
  return `https://source.unsplash.com/${size}/?${q}`;
}

/**
 * "Busca" uma imagem: retorna a URL do Source (que redireciona pra imagem
 * aleatória que combina com o termo). Adiciona um parâmetro de cache-bust
 * pra permitir "buscar outra" ao clicar de novo.
 */
export function searchImage(query: string): string {
  const base = buildUnsplashSourceUrl({ query, orientation: "landscape" });
  const bust = Math.floor(Math.random() * 10000);
  return `${base}&sig=${bust}`;
}
