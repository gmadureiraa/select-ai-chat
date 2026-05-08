/**
 * Cliente Perplexity — fact-check live com citations.
 *
 * API é OpenAI-compatible (`/chat/completions`). Usamos pra injetar um
 * bloco "FACT CHECK LIVE" no writer quando o briefing pede dados recentes
 * ou factoides verificáveis. Opt-in via flag `useFactCheck` na requisição
 * de geração, ou auto-detect quando NER traz dataPoints com datas/números
 * específicos recentes.
 *
 * Docs: https://docs.perplexity.ai/api-reference/chat-completions-post
 */

export interface PerplexityResult {
  /** Resposta textual do modelo, já com fontes citadas inline como [1] [2]. */
  answer: string;
  /** Lista de URLs das fontes citadas (em ordem). */
  citations: string[];
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

type PerplexityModel = "sonar" | "sonar-pro";

interface PerplexityQueryOptions {
  timeoutMs?: number;
  model?: PerplexityModel;
  maxTokens?: number;
}

const PRICING: Record<PerplexityModel, { input: number; output: number }> = {
  // Sonar (small) — $1/M input, $1/M output. Base pra fact-check simples.
  sonar: { input: 0.000001, output: 0.000001 },
  // Sonar Pro — $3/M input, $15/M output. Usar só quando precisar raciocínio
  // mais pesado (não é o default).
  "sonar-pro": { input: 0.000003, output: 0.000015 },
};

export function isPerplexityConfigured(): boolean {
  return Boolean(process.env.PERPLEXITY_API_KEY);
}

/**
 * Faz uma pergunta pro Perplexity e retorna a resposta + citations + custo.
 * Retorna `null` em qualquer falha (api key faltando, HTTP error, timeout,
 * payload inválido). Caller trata a ausência do bloco silenciosamente.
 */
export async function perplexityQuery(
  question: string,
  options: PerplexityQueryOptions = {}
): Promise<PerplexityResult | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return null;

  const model: PerplexityModel = options.model ?? "sonar";
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maxTokens = options.maxTokens ?? 600;

  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "Responda em português brasileiro, direto, com fatos verificáveis. Cite as fontes. Se não houver dado confiável, diga explicitamente.",
      },
      {
        role: "user",
        content: question,
      },
    ],
    max_tokens: maxTokens,
    temperature: 0.2,
  };

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn(
        `[perplexity] HTTP ${res.status}: ${errBody.slice(0, 200)}`
      );
      return null;
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: { content?: string };
      }>;
      citations?: string[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
      model?: string;
    };

    const answer = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!answer) {
      console.warn("[perplexity] resposta vazia");
      return null;
    }

    const citations = Array.isArray(json.citations)
      ? json.citations.filter(
          (c): c is string => typeof c === "string" && c.length > 0
        )
      : [];

    const inputTokens = json.usage?.prompt_tokens ?? 0;
    const outputTokens = json.usage?.completion_tokens ?? 0;
    const pricing = PRICING[model];
    const costUsd =
      Math.round(
        (inputTokens * pricing.input + outputTokens * pricing.output) *
          1_000_000
      ) / 1_000_000;

    return {
      answer,
      citations,
      modelUsed: json.model || model,
      inputTokens,
      outputTokens,
      costUsd,
    };
  } catch (err) {
    console.warn(
      "[perplexity] falha silenciosa:",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}
