/**
 * Cliente Supadata — transcrição universal de vídeo (YouTube, Instagram, TikTok, X).
 *
 * Quando o video não tem legenda manual e o innertube/apify bloqueia, Supadata
 * extrai o texto via ASR. Requer env `SUPADATA_API_KEY`.
 *
 * Fallback: se `SUPADATA_API_KEY_BACKUP` estiver setado, a helper tenta a
 * backup key quando a primary retorna 429 (rate limit) ou 401 (auth inválida).
 * Evita ficar parado quando a primary bateu quota.
 *
 * Docs: https://supadata.ai/documentation
 */

const BASE = "https://api.supadata.ai/v1";

export type SupadataTranscriptResult = {
  content: string;
  lang: string;
  availableLangs: string[];
};

/** Considera configurado se pelo menos uma das duas keys estiver setada. */
export function isSupadataConfigured(): boolean {
  return Boolean(
    process.env.SUPADATA_API_KEY || process.env.SUPADATA_API_KEY_BACKUP
  );
}

function getSupadataKeys(): string[] {
  const primary = process.env.SUPADATA_API_KEY;
  const backup = process.env.SUPADATA_API_KEY_BACKUP;
  // Ordem: primary antes, backup como fallback. Mantém compatibilidade pra
  // deploys que não têm backup ainda.
  return [primary, backup].filter(
    (k): k is string => typeof k === "string" && k.length > 0
  );
}

/**
 * Fetch helper que tenta primary → backup quando primary retorna 429/401.
 * Lança `Error` pra status não-recuperáveis (404, 5xx). Retorna Response
 * pronta pra o caller interpretar.
 */
async function supadataFetch(
  path: string,
  init: { qs?: URLSearchParams; timeoutMs: number }
): Promise<{ res: Response; key: string }> {
  const keys = getSupadataKeys();
  if (keys.length === 0) {
    throw new Error("Supadata: nenhuma API key configurada");
  }

  const url = init.qs ? `${BASE}${path}?${init.qs.toString()}` : `${BASE}${path}`;
  let lastErr: Error | null = null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const res = await fetch(url, {
        headers: {
          "x-api-key": key,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(init.timeoutMs),
      });

      if ((res.status === 429 || res.status === 401) && i < keys.length - 1) {
        console.warn(
          `[supadata] key #${i + 1} retornou ${res.status}, tentando fallback #${i + 2}`
        );
        continue;
      }
      return { res, key };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (i < keys.length - 1) {
        console.warn(
          `[supadata] key #${i + 1} erro (${lastErr.message}), tentando fallback`
        );
        continue;
      }
    }
  }

  throw lastErr ?? new Error("Supadata: todas as keys falharam");
}

/**
 * Busca transcript de qualquer URL suportada (YouTube/Instagram/TikTok/X/arquivo).
 * Retorna `null` quando a API está desconfigurada — nunca lança por conta disso.
 * Lança `Error` para 4xx/5xx reais (rate limit, video not found, etc.).
 */
export async function fetchSupadataTranscript(
  url: string,
  options: { lang?: string; timeoutMs?: number; mode?: "auto" | "native" | "generate" } = {}
): Promise<SupadataTranscriptResult | null> {
  if (!isSupadataConfigured()) return null;

  const qs = new URLSearchParams({
    url,
    text: "true",
    mode: options.mode ?? "auto",
  });
  if (options.lang) qs.set("lang", options.lang);

  const totalTimeout = options.timeoutMs ?? 55_000;
  const { res } = await supadataFetch("/transcript", {
    qs,
    timeoutMs: 20_000,
  });

  if (res.status === 404) {
    throw new Error("Supadata: vídeo não encontrado.");
  }
  if (res.status === 429) {
    throw new Error("Supadata: rate limit atingido (todas as keys).");
  }
  if (res.status === 401) {
    throw new Error("Supadata: todas as keys rejeitadas (401).");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supadata HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content?: string | { text?: string }[];
    lang?: string;
    availableLangs?: string[];
    jobId?: string;
  };

  if (data.jobId) {
    return await pollJob(data.jobId, totalTimeout);
  }

  const content =
    typeof data.content === "string"
      ? data.content
      : Array.isArray(data.content)
        ? data.content.map((c) => c?.text || "").join(" ")
        : "";
  if (!content.trim()) return null;

  return {
    content: content.trim(),
    lang: data.lang || "",
    availableLangs: data.availableLangs || [],
  };
}

const PENDING_STATUSES = new Set([
  "queued",
  "processing",
  "active",
  "waiting",
  "pending",
]);

async function pollJob(
  jobId: string,
  overallTimeoutMs: number
): Promise<SupadataTranscriptResult | null> {
  const deadline = Date.now() + overallTimeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    const wait = Math.min(2000 * attempt, 6000);
    await new Promise((r) => setTimeout(r, wait));

    let res: Response;
    try {
      const out = await supadataFetch(`/transcript/${jobId}`, {
        timeoutMs: 15_000,
      });
      res = out.res;
    } catch {
      // Erro transiente — tenta de novo no próximo tick.
      continue;
    }
    if (res.status === 404) return null;
    if (!res.ok) continue;
    const data = (await res.json()) as {
      status?: string;
      content?: string | { text?: string }[];
      lang?: string;
      availableLangs?: string[];
      error?: string;
    };
    if (data.status && PENDING_STATUSES.has(data.status)) continue;
    if (data.status === "failed" || data.error) {
      throw new Error(`Supadata job falhou: ${data.error || data.status}`);
    }
    const content =
      typeof data.content === "string"
        ? data.content
        : Array.isArray(data.content)
          ? data.content.map((c) => c?.text || "").join(" ")
          : "";
    if (!content) return null;
    return {
      content: content.trim(),
      lang: data.lang || "",
      availableLangs: data.availableLangs || [],
    };
  }
  throw new Error("Supadata: timeout no polling do job");
}
