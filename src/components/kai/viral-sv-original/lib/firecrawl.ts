/**
 * Cliente Firecrawl — scraping LLM-ready de blogs/artigos.
 *
 * Firecrawl extrai o conteúdo principal em markdown limpo, removendo nav,
 * footer, cookie banners, ads etc. Usado como primeiro tentativa quando a
 * fonte é uma URL genérica (blog, notícia, landing). Se falhar, caller faz
 * fallback para `lib/url-extractor.ts` (fetch + regex) ou scraper legado.
 *
 * Docs: https://docs.firecrawl.dev/api-reference/endpoint/scrape
 */

export interface FirecrawlResult {
  /** Conteúdo principal em markdown. Limpo, sem HTML, sem ads. */
  markdown: string;
  title?: string;
  description?: string;
  sourceUrl: string;
  publishedAt?: string;
  author?: string;
}

export function isFirecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

interface FirecrawlScrapeOptions {
  /** Timeout total da chamada em ms. Default: 20s. */
  timeoutMs?: number;
  /** Se true, Firecrawl tenta extrair só o main content. Default: true. */
  onlyMainContent?: boolean;
}

interface FirecrawlMetadata {
  title?: string;
  description?: string;
  publishedTime?: string;
  author?: string;
  sourceURL?: string;
  ogTitle?: string;
}

interface FirecrawlScrapeResponse {
  success?: boolean;
  data?: {
    markdown?: string;
    metadata?: FirecrawlMetadata;
  };
  error?: string;
}

/**
 * Chama `POST /v1/scrape` do Firecrawl. Retorna markdown + metadata.
 * Retorna `null` em qualquer falha (API key faltando, timeout, HTTP error,
 * payload inválido) — caller deve fazer fallback pra scraper local.
 */
export async function firecrawlScrape(
  url: string,
  options: FirecrawlScrapeOptions = {}
): Promise<FirecrawlResult | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  const timeoutMs = options.timeoutMs ?? 20_000;
  const onlyMainContent =
    typeof options.onlyMainContent === "boolean" ? options.onlyMainContent : true;

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        `[firecrawl] HTTP ${res.status}: ${body.slice(0, 200)}`
      );
      return null;
    }

    const json = (await res.json()) as FirecrawlScrapeResponse;
    if (!json || json.success === false || !json.data) {
      console.warn(
        `[firecrawl] resposta inválida: ${json?.error ?? "sem data"}`
      );
      return null;
    }

    const markdown = (json.data.markdown || "").trim();
    if (!markdown) {
      console.warn("[firecrawl] markdown vazio");
      return null;
    }

    const meta = json.data.metadata ?? {};
    return {
      markdown,
      title: meta.title || meta.ogTitle,
      description: meta.description,
      sourceUrl: meta.sourceURL || url,
      publishedAt: meta.publishedTime,
      author: meta.author,
    };
  } catch (err) {
    console.warn(
      "[firecrawl] falha silenciosa:",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

/**
 * Helper que monta um bloco formatado de texto a partir do resultado
 * do Firecrawl — compatível com o formato de saída de
 * `lib/url-extractor.ts::extractContentFromUrl` (URL, Title, Description,
 * Content: ...). Usado quando o caller quer usar Firecrawl como drop-in
 * pra scraper legado.
 */
export function formatFirecrawlAsExtractorOutput(
  result: FirecrawlResult,
  options: { maxChars?: number } = {}
): string {
  const maxChars = options.maxChars ?? 8000;
  const body =
    result.markdown.length > maxChars
      ? `${result.markdown.slice(0, maxChars)}…`
      : result.markdown;

  const parts: string[] = [];
  parts.push(`URL: ${result.sourceUrl}`);
  if (result.title) parts.push(`Title: ${result.title}`);
  if (result.description) parts.push(`Description: ${result.description}`);
  if (result.author) parts.push(`Author: ${result.author}`);
  if (result.publishedAt) parts.push(`Published: ${result.publishedAt}`);
  parts.push("");
  parts.push(`Content:\n${body}`);

  return parts.join("\n");
}
