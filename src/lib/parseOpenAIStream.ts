/**
 * Utility for parsing OpenAI-compatible SSE streams
 * Used by kai-content-agent and other edge functions that return streamed responses
 */

export interface StreamParseOptions {
  onProgress?: (chunk: string) => void;
  onChunk?: (chunkIndex: number) => void;
}

/**
 * Parse an OpenAI-compatible SSE stream and extract the final content
 * Handles the delta.content format used by Lovable AI gateway
 */
export async function parseOpenAIStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  options?: StreamParseOptions
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  let finalContent = "";
  let chunkCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (!trimmed.startsWith("data: ")) continue;

      const jsonStr = trimmed.slice(6).trim();
      if (jsonStr === "[DONE]") continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const deltaContent = parsed.choices?.[0]?.delta?.content;
        if (deltaContent) {
          finalContent += deltaContent;
          chunkCount++;
          options?.onProgress?.(finalContent);
          options?.onChunk?.(chunkCount);
        }
      } catch {
        // Ignore parse errors for incomplete chunks
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    for (const rawLine of buffer.split("\n")) {
      let line = rawLine.trim();
      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const deltaContent = parsed.choices?.[0]?.delta?.content;
        if (deltaContent) {
          finalContent += deltaContent;
          options?.onProgress?.(finalContent);
          
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  return finalContent.trim();
}

/**
 * Stream SSE to callbacks — robust parser with proper buffering for CRLF and partial chunks.
 *
 * Extende o protocolo pra incluir eventos do KAI operator (tool_running, action_card, error).
 * Callbacks novos são opcionais — consumidores antigos continuam funcionando com onDelta.
 */
import type {
  KAIActionCard,
  KAIToolRunning,
} from "@/types/kai-stream";

export interface StreamSSECallbacks {
  onDelta: (fullContent: string) => void;
  onDone?: () => void;
  onImage?: (url: string) => void;
  /** Tool em execução — ex: mostra chip "Gerando rascunho…" no UI. */
  onToolRunning?: (running: KAIToolRunning) => void;
  /** Card novo ou atualizado pra renderizar no chat. Match por card.id. */
  onActionCard?: (card: KAIActionCard) => void;
  /** Erro irrecuperável vindo do servidor. Stream será encerrado. */
  onError?: (message: string) => void;
}

function handleDelta(
  delta: Record<string, unknown> | undefined,
  state: { fullContent: string },
  callbacks: StreamSSECallbacks,
): void {
  if (!delta) return;

  if (typeof delta.content === "string") {
    state.fullContent += delta.content;
    callbacks.onDelta(state.fullContent);
  }

  if (typeof delta.image === "string") {
    callbacks.onImage?.(delta.image);
  }

  if (delta.tool_running && typeof delta.tool_running === "object") {
    callbacks.onToolRunning?.(delta.tool_running as KAIToolRunning);
  }

  if (delta.action_card && typeof delta.action_card === "object") {
    callbacks.onActionCard?.(delta.action_card as KAIActionCard);
  }

  if (typeof delta.error === "string") {
    callbacks.onError?.(delta.error);
  }
}

export async function streamSSEToCallback(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: StreamSSECallbacks
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  const state = { fullContent: "" };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (!trimmed.startsWith("data: ")) continue;

      const jsonStr = trimmed.slice(6).trim();
      if (jsonStr === "[DONE]") continue;

      try {
        const parsed = JSON.parse(jsonStr);
        handleDelta(parsed.choices?.[0]?.delta, state, callbacks);
      } catch {
        // Ignore parse errors for incomplete chunks
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim()) {
    for (const rawLine of buffer.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith(":") || !line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        handleDelta(parsed.choices?.[0]?.delta, state, callbacks);
      } catch { /* ignore */ }
    }
  }

  callbacks.onDone?.();
  return state.fullContent;
}

/**
 * Make a streaming request to kai-content-agent and parse the response
 */
export async function callKaiContentAgent(params: {
  clientId: string;
  request: string;
  format?: string;
  platform?: string;
  accessToken: string;
  additionalMaterial?: string; // Pre-extracted reference content
  onProgress?: (chunk: string) => void;
  onChunk?: (chunkIndex: number) => void;
}): Promise<string> {
  const { clientId, request, format, platform, accessToken, additionalMaterial, onProgress, onChunk } = params;

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kai-content-agent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        clientId,
        request,
        format,
        platform,
        additionalMaterial,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    
    // Handle 402 Payment Required - insufficient tokens
    if (response.status === 402) {
      const error = new Error("Créditos insuficientes") as Error & { status: number; code: string };
      error.status = 402;
      error.code = "TOKENS_EXHAUSTED";
      throw error;
    }
    
    throw new Error(`Erro na API: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Não foi possível ler a resposta");
  }

  return parseOpenAIStream(reader, { onProgress, onChunk });
}
