// =====================================================
// LLM MODULE - Centralized AI calls with retry + fallback
// Supports: Google Gemini & OpenAI
// =====================================================

/**
 * Message format for LLM calls
 */
export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
  image_urls?: string[];
}

/**
 * Options for LLM calls
 */
export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  provider?: "google" | "openai" | "auto";
  model?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Result from LLM call
 */
export interface LLMResult {
  content: string;
  tokens: number;
  provider: "google" | "openai";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Error thrown when all providers fail
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly isRetryable: boolean = false,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = "LLMError";
  }
}

// =====================================================
// PROVIDER DETECTION
// =====================================================

function getGoogleApiKey(): string | undefined {
  return Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
}

function getOpenAIApiKey(): string | undefined {
  return Deno.env.get("OPENAI_API_KEY");
}

/**
 * Check if at least one LLM provider is configured
 */
export function isLLMConfigured(): boolean {
  return !!(getGoogleApiKey() || getOpenAIApiKey());
}

/**
 * Get the primary provider based on available keys
 */
function getPrimaryProvider(): "google" | "openai" | null {
  if (getGoogleApiKey()) return "google";
  if (getOpenAIApiKey()) return "openai";
  return null;
}

/**
 * Get the fallback provider (opposite of primary)
 */
function getFallbackProvider(primary: "google" | "openai"): "google" | "openai" | null {
  if (primary === "google" && getOpenAIApiKey()) return "openai";
  if (primary === "openai" && getGoogleApiKey()) return "google";
  return null;
}

// =====================================================
// RETRY LOGIC
// =====================================================

const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];
const DEFAULT_RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(status: number): boolean {
  return RETRYABLE_STATUS_CODES.includes(status);
}

// =====================================================
// GOOGLE GEMINI IMPLEMENTATION
// =====================================================

async function callGemini(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResult> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    throw new LLMError("GOOGLE_AI_STUDIO_API_KEY não configurada");
  }

  const model = options.model?.replace("google/", "") || "gemini-2.5-flash";
  const maxRetries = options.maxRetries ?? 3;

  // Convert messages to Gemini format
  const geminiContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  let systemInstruction = "";

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction += (systemInstruction ? "\n\n" : "") + msg.content;
      continue;
    }

    const role = msg.role === "assistant" ? "model" : "user";

    if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
      // Merge consecutive same-role messages
      geminiContents[geminiContents.length - 1].parts[0].text += "\n\n" + msg.content;
    } else {
      geminiContents.push({
        role,
        parts: [{ text: msg.content }],
      });
    }
  }

  const requestBody: any = {
    contents: geminiContents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 8192,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLM] Gemini error (attempt ${attempt + 1}):`, response.status, errorText);

        if (isRetryableError(response.status) && attempt < maxRetries) {
          const delay = DEFAULT_RETRY_DELAYS[attempt] || 4000;
          console.log(`[LLM] Retrying Gemini in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        throw new LLMError(
          `Gemini API error: ${response.status}`,
          isRetryableError(response.status),
          response.status === 429 ? 60 : undefined
        );
      }

      const result = await response.json();
      const content = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const inputTokens = result?.usageMetadata?.promptTokenCount || 0;
      const outputTokens = result?.usageMetadata?.candidatesTokenCount || 0;

      return {
        content,
        tokens: inputTokens + outputTokens,
        provider: "google",
        model,
        inputTokens,
        outputTokens,
      };
    } catch (error) {
      lastError = error as Error;

      if (error instanceof LLMError) {
        throw error;
      }

      // Network or timeout error - retry
      if (attempt < maxRetries) {
        const delay = DEFAULT_RETRY_DELAYS[attempt] || 4000;
        console.log(`[LLM] Network error, retrying Gemini in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError || new LLMError("Gemini call failed after retries");
}

// =====================================================
// OPENAI IMPLEMENTATION
// =====================================================

async function callOpenAI(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResult> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new LLMError("OPENAI_API_KEY não configurada");
  }

  const model = options.model?.replace("openai/", "") || "gpt-4o";
  const maxRetries = options.maxRetries ?? 3;

  // Convert messages to OpenAI format
  const openAIMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const requestBody = {
    model,
    messages: openAIMessages,
    max_tokens: options.maxTokens ?? 8192,
    temperature: options.temperature ?? 0.7,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLM] OpenAI error (attempt ${attempt + 1}):`, response.status, errorText);

        if (isRetryableError(response.status) && attempt < maxRetries) {
          const delay = DEFAULT_RETRY_DELAYS[attempt] || 4000;
          console.log(`[LLM] Retrying OpenAI in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        throw new LLMError(
          `OpenAI API error: ${response.status}`,
          isRetryableError(response.status),
          response.status === 429 ? 60 : undefined
        );
      }

      const result = await response.json();
      const content = result?.choices?.[0]?.message?.content || "";
      const inputTokens = result?.usage?.prompt_tokens || 0;
      const outputTokens = result?.usage?.completion_tokens || 0;

      return {
        content,
        tokens: inputTokens + outputTokens,
        provider: "openai",
        model,
        inputTokens,
        outputTokens,
      };
    } catch (error) {
      lastError = error as Error;

      if (error instanceof LLMError) {
        throw error;
      }

      // Network or timeout error - retry
      if (attempt < maxRetries) {
        const delay = DEFAULT_RETRY_DELAYS[attempt] || 4000;
        console.log(`[LLM] Network error, retrying OpenAI in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError || new LLMError("OpenAI call failed after retries");
}

// =====================================================
// MAIN ENTRY POINT - CALL LLM WITH FALLBACK
// =====================================================

/**
 * Call LLM with automatic retry and provider fallback
 *
 * @param messages - Array of messages in conversation format
 * @param options - Configuration options
 * @returns LLMResult with content and metadata
 * @throws LLMError if all providers fail
 *
 * @example
 * const result = await callLLM([
 *   { role: "system", content: "You are a helpful assistant" },
 *   { role: "user", content: "Hello!" }
 * ]);
 * console.log(result.content); // AI response
 */
export async function callLLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResult> {
  // Check if any provider is configured
  const primaryProvider =
    options.provider === "auto" || !options.provider
      ? getPrimaryProvider()
      : options.provider;

  if (!primaryProvider) {
    throw new LLMError(
      "Nenhuma chave de IA configurada. Configure GOOGLE_AI_STUDIO_API_KEY ou OPENAI_API_KEY.",
      false
    );
  }

  console.log(`[LLM] Using primary provider: ${primaryProvider}`);

  // Try primary provider
  try {
    if (primaryProvider === "google") {
      return await callGemini(messages, options);
    } else {
      return await callOpenAI(messages, options);
    }
  } catch (primaryError) {
    console.error(`[LLM] Primary provider (${primaryProvider}) failed:`, primaryError);

    // Try fallback provider
    const fallbackProvider = getFallbackProvider(primaryProvider);

    if (fallbackProvider) {
      console.log(`[LLM] Trying fallback provider: ${fallbackProvider}`);

      try {
        if (fallbackProvider === "google") {
          return await callGemini(messages, options);
        } else {
          return await callOpenAI(messages, options);
        }
      } catch (fallbackError) {
        console.error(`[LLM] Fallback provider (${fallbackProvider}) also failed:`, fallbackError);

        // Both providers failed
        throw new LLMError(
          "Serviço de IA temporariamente indisponível. Tente novamente.",
          true,
          60
        );
      }
    }

    // No fallback available, throw original error
    if (primaryError instanceof LLMError) {
      throw primaryError;
    }

    throw new LLMError(
      "Serviço de IA temporariamente indisponível. Tente novamente.",
      true,
      60
    );
  }
}

// =====================================================
// STREAMING VERSION (For chat applications)
// =====================================================

/**
 * Stream LLM response using SSE format
 *
 * @param messages - Array of messages in conversation format
 * @param options - Configuration options
 * @returns ReadableStream in OpenAI SSE format
 */
export async function streamLLM(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<{ stream: ReadableStream; provider: "google" | "openai"; model: string }> {
  const primaryProvider =
    options.provider === "auto" || !options.provider
      ? getPrimaryProvider()
      : options.provider;

  if (!primaryProvider) {
    throw new LLMError(
      "Nenhuma chave de IA configurada. Configure GOOGLE_AI_STUDIO_API_KEY ou OPENAI_API_KEY.",
      false
    );
  }

  // For streaming, we use Gemini's native streaming
  if (primaryProvider === "google") {
    return streamGemini(messages, options);
  } else {
    return streamOpenAI(messages, options);
  }
}

async function streamGemini(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<{ stream: ReadableStream; provider: "google"; model: string }> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    throw new LLMError("GOOGLE_AI_STUDIO_API_KEY não configurada");
  }

  const model = options.model?.replace("google/", "") || "gemini-2.5-flash";

  // Convert messages to Gemini format
  const geminiContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  let systemInstruction = "";

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction += (systemInstruction ? "\n\n" : "") + msg.content;
      continue;
    }

    const role = msg.role === "assistant" ? "model" : "user";

    if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
      geminiContents[geminiContents.length - 1].parts[0].text += "\n\n" + msg.content;
    } else {
      geminiContents.push({
        role,
        parts: [{ text: msg.content }],
      });
    }
  }

  const requestBody: any = {
    contents: geminiContents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 8192,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[LLM] Gemini stream error:", response.status, errorText);
    throw new LLMError(
      `Gemini streaming error: ${response.status}`,
      isRetryableError(response.status),
      response.status === 429 ? 60 : undefined
    );
  }

  if (!response.body) {
    throw new LLMError("No response body from Gemini");
  }

  // Transform Gemini SSE format to OpenAI format
  const transformStream = new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          try {
            const parsed = JSON.parse(data);
            if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
              const textChunk = parsed.candidates[0].content.parts[0].text;
              const openAIFormat = {
                choices: [{ delta: { content: textChunk } }],
              };
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify(openAIFormat)}\n\n`)
              );
            }
          } catch {
            // Ignore parsing errors for partial chunks
          }
        }
      }
    },
  });

  return {
    stream: response.body.pipeThrough(transformStream),
    provider: "google",
    model,
  };
}

async function streamOpenAI(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<{ stream: ReadableStream; provider: "openai"; model: string }> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new LLMError("OPENAI_API_KEY não configurada");
  }

  const model = options.model?.replace("openai/", "") || "gpt-4o";

  const openAIMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: openAIMessages,
      max_tokens: options.maxTokens ?? 8192,
      temperature: options.temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[LLM] OpenAI stream error:", response.status, errorText);
    throw new LLMError(
      `OpenAI streaming error: ${response.status}`,
      isRetryableError(response.status),
      response.status === 429 ? 60 : undefined
    );
  }

  if (!response.body) {
    throw new LLMError("No response body from OpenAI");
  }

  // OpenAI already returns in the correct format
  return {
    stream: response.body,
    provider: "openai",
    model,
  };
}

// =====================================================
// GROUNDING - WEB SEARCH VIA GEMINI
// =====================================================

/**
 * Call Gemini with Google Search Grounding for real-time web search
 * Uses Gemini 2.0 Flash with native Google Search integration
 * 
 * @param query - Search query or topic to research
 * @param systemContext - Optional system context for the research
 * @returns Research results with citations
 */
export async function callLLMWithGrounding(
  query: string,
  systemContext?: string
): Promise<{ content: string; sources: string[]; tokens: number }> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    throw new LLMError("GOOGLE_AI_STUDIO_API_KEY não configurada para Grounding");
  }

  const model = "gemini-2.0-flash";
  
  const requestBody: any = {
    contents: [
      {
        role: "user",
        parts: [{ text: query }],
      },
    ],
    tools: [
      {
        google_search: {},
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  };

  if (systemContext) {
    requestBody.systemInstruction = {
      parts: [{ text: systemContext }],
    };
  }

  console.log(`[LLM] Calling Gemini with Grounding for query: ${query.substring(0, 100)}...`);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LLM] Gemini Grounding error:`, response.status, errorText);
    throw new LLMError(
      `Gemini Grounding error: ${response.status}`,
      isRetryableError(response.status)
    );
  }

  const result = await response.json();
  
  // Extract content
  const content = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  // Extract grounding sources from metadata
  const sources: string[] = [];
  const groundingMetadata = result?.candidates?.[0]?.groundingMetadata;
  
  if (groundingMetadata?.groundingChunks) {
    for (const chunk of groundingMetadata.groundingChunks) {
      if (chunk.web?.uri) {
        sources.push(chunk.web.uri);
      }
    }
  }
  
  // Also check searchEntryPoint for search results
  if (groundingMetadata?.webSearchQueries) {
    console.log(`[LLM] Grounding performed ${groundingMetadata.webSearchQueries.length} web searches`);
  }

  const inputTokens = result?.usageMetadata?.promptTokenCount || 0;
  const outputTokens = result?.usageMetadata?.candidatesTokenCount || 0;

  console.log(`[LLM] Grounding complete: ${content.length} chars, ${sources.length} sources`);

  return {
    content,
    sources: [...new Set(sources)], // Remove duplicates
    tokens: inputTokens + outputTokens,
  };
}

// =====================================================
// HTTP RESPONSE HELPERS
// =====================================================

/**
 * Create a 503 Service Unavailable response for LLM failures
 */
export function createLLMUnavailableResponse(
  error: LLMError | Error,
  corsHeaders: Record<string, string>,
  partialContent?: string
): Response {
  const isLLMErr = error instanceof LLMError;
  const retryAfter = isLLMErr ? error.retryAfter : 60;

  const responseBody: Record<string, any> = {
    error: error.message || "Serviço de IA temporariamente indisponível",
    isRetryable: isLLMErr ? error.isRetryable : true,
  };

  // Include partial content if available
  if (partialContent) {
    responseBody.partial_content = partialContent;
    responseBody.warning = "Conteúdo gerado parcialmente devido a falha na API";
  }

  const headers: Record<string, string> = {
    ...corsHeaders,
    "Content-Type": "application/json",
  };

  if (retryAfter) {
    headers["Retry-After"] = String(retryAfter);
    responseBody.retry_after = retryAfter;
  }

  return new Response(JSON.stringify(responseBody), {
    status: 503,
    headers,
  });
}
