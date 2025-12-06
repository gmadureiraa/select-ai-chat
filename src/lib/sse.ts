/**
 * Utilitários para parsing de Server-Sent Events (SSE)
 */

export interface SSEParseResult {
  content: string;
  done: boolean;
}

/**
 * Lê e processa um stream SSE completo
 * @param reader ReadableStreamDefaultReader do response body
 * @returns Promise com o conteúdo acumulado
 */
export const parseSSEStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<string> => {
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;

      if (trimmed.startsWith("data: ")) {
        const jsonStr = trimmed.slice(6);
        if (jsonStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const tokenContent = parsed.choices?.[0]?.delta?.content || "";
          content += tokenContent;
        } catch {
          // Ignorar erros de parse de JSON incompleto
        }
      }
    }
  }

  return content;
};

/**
 * Processa stream SSE com callback para progresso em tempo real
 * @param reader ReadableStreamDefaultReader do response body
 * @param onProgress Callback chamado a cada novo token
 * @returns Promise com o conteúdo acumulado
 */
export const parseSSEStreamWithProgress = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onProgress?: (partialContent: string) => void
): Promise<string> => {
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;

      if (trimmed.startsWith("data: ")) {
        const jsonStr = trimmed.slice(6);
        if (jsonStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const tokenContent = parsed.choices?.[0]?.delta?.content || "";
          content += tokenContent;
          onProgress?.(content);
        } catch {
          // Ignorar erros de parse de JSON incompleto
        }
      }
    }
  }

  return content;
};
