/**
 * Cliente Unsplash — busca de fotos editoriais stock como alternativa barata
 * à geração de imagens via IA. Usado quando o image-decider decide
 * `mode="stock"` (conceito abstrato clássico: produtividade, café, foco,
 * trabalho, leitura, fim de semana etc).
 *
 * Só server-side — requer `UNSPLASH_ACCESS_KEY`. Sem OAuth: a API pública
 * do Unsplash autentica via header `Authorization: Client-ID <key>`.
 *
 * Silent-fail em todos os handlers: se a API falhar, o caller cai pra
 * geração de imagem com IA. Nunca lança pra não quebrar o pipeline.
 *
 * ⚠️ ATRIBUIÇÃO OBRIGATÓRIA (Unsplash API Guidelines):
 *   Quando uma foto é efetivamente usada (persistida num carrossel, baixada
 *   ou exposta ao user final), o caller DEVE chamar
 *   `unsplashTriggerDownload(photo.downloadLocation)`. Esse ping é
 *   fire-and-forget — não bloqueia o pipeline, mas é requisito pra passar
 *   de demo tier (50 req/h) pra production tier (5000 req/h).
 *
 * Docs: https://unsplash.com/documentation
 */

const BASE = "https://api.unsplash.com";
const DEFAULT_TIMEOUT_MS = 6_000;

export interface UnsplashPhoto {
  /** ID único da foto no Unsplash. */
  id: string;
  /** URL principal em alta resolução (raw ou regular). Ideal pra carrossel. */
  url: string;
  /** Thumbnail pra previews/picker (small_s3). */
  thumbUrl: string;
  /** Nome do autor (obrigatório na atribuição). */
  author: string;
  /** Link do perfil do autor no Unsplash (obrigatório na atribuição). */
  authorUrl: string;
  /**
   * Endpoint `/photos/:id/download` retornado pela API. Quando a foto é
   * efetivamente usada, chamar `unsplashTriggerDownload(downloadLocation)`
   * pra cumprir o guideline de atribuição do Unsplash.
   */
  downloadLocation: string;
  /** Largura original da foto em pixels. */
  width: number;
  /** Altura original da foto em pixels. */
  height: number;
  /** Descrição textual (`description` ou `alt_description`, nessa ordem). */
  description?: string;
}

/** Considera configurado se a key estiver setada. */
export function isUnsplashConfigured(): boolean {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY);
}

interface UnsplashSearchResponse {
  results?: Array<{
    id?: string;
    description?: string | null;
    alt_description?: string | null;
    width?: number;
    height?: number;
    urls?: {
      raw?: string;
      full?: string;
      regular?: string;
      small?: string;
      small_s3?: string;
      thumb?: string;
    };
    user?: {
      name?: string;
      username?: string;
      links?: {
        html?: string;
      };
    };
    links?: {
      download_location?: string;
    };
  }>;
}

/**
 * Busca fotos no Unsplash via `/search/photos`. Retorna array vazio em
 * qualquer erro (timeout, 4xx, 5xx, parse) — silent-fail.
 *
 * Defaults:
 *  - perPage: 5 (suficiente pro picker sem inflar payload)
 *  - orientation: "squarish" (melhor match pra carrossel 1:1)
 *  - timeoutMs: 6000
 */
export async function unsplashSearch(
  query: string,
  options: {
    perPage?: number;
    orientation?: "landscape" | "portrait" | "squarish";
    timeoutMs?: number;
  } = {}
): Promise<UnsplashPhoto[]> {
  if (!isUnsplashConfigured()) return [];
  const trimmed = query.trim();
  if (!trimmed) return [];

  const perPage = Math.max(1, Math.min(30, options.perPage ?? 5));
  const orientation = options.orientation ?? "squarish";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const qs = new URLSearchParams({
    query: trimmed,
    per_page: String(perPage),
    orientation,
  });

  const url = `${BASE}/search/photos?${qs.toString()}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
        "Accept-Version": "v1",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      console.warn(
        `[unsplash] search non-ok status=${res.status} query="${trimmed.slice(0, 60)}"`
      );
      return [];
    }

    const data = (await res.json()) as UnsplashSearchResponse;
    const results = Array.isArray(data.results) ? data.results : [];

    const photos: UnsplashPhoto[] = [];
    for (const r of results) {
      const id = r.id;
      const primary =
        r.urls?.regular || r.urls?.full || r.urls?.raw || r.urls?.small || "";
      const thumb = r.urls?.small_s3 || r.urls?.thumb || r.urls?.small || primary;
      const author = r.user?.name || r.user?.username || "Unknown";
      const authorUrl = r.user?.links?.html || "https://unsplash.com";
      const downloadLocation = r.links?.download_location || "";

      if (!id || !primary || !downloadLocation) continue;

      photos.push({
        id,
        url: primary,
        thumbUrl: thumb,
        author,
        authorUrl,
        downloadLocation,
        width: typeof r.width === "number" ? r.width : 0,
        height: typeof r.height === "number" ? r.height : 0,
        description:
          (typeof r.description === "string" && r.description.trim()) ||
          (typeof r.alt_description === "string" && r.alt_description.trim()) ||
          undefined,
      });
    }

    return photos;
  } catch (err) {
    console.warn(
      "[unsplash] search exception:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

/**
 * Trigger obrigatório pra atribuição do Unsplash quando a foto é
 * efetivamente usada. Fire-and-forget — nunca lança, timeout curto.
 * Sem isso, o app não passa revisão pra production tier (5000 req/h).
 */
export async function unsplashTriggerDownload(
  downloadLocation: string
): Promise<void> {
  if (!isUnsplashConfigured()) return;
  if (!downloadLocation || typeof downloadLocation !== "string") return;

  try {
    await fetch(downloadLocation, {
      method: "GET",
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
        "Accept-Version": "v1",
      },
      signal: AbortSignal.timeout(4_000),
    });
  } catch (err) {
    // Silent — trigger é best-effort. Logamos só pra auditoria.
    console.warn(
      "[unsplash] triggerDownload falhou (não-bloqueante):",
      err instanceof Error ? err.message : err
    );
  }
}
