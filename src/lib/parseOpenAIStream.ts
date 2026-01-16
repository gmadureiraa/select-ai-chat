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
          options?.onProgress?.(deltaContent);
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
          options?.onProgress?.(deltaContent);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  return finalContent.trim();
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
  onProgress?: (chunk: string) => void;
  onChunk?: (chunkIndex: number) => void;
}): Promise<string> {
  const { clientId, request, format, platform, accessToken, onProgress, onChunk } = params;

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
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Não foi possível ler a resposta");
  }

  return parseOpenAIStream(reader, { onProgress, onChunk });
}
