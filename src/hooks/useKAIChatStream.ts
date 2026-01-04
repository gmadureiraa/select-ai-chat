import { useState, useCallback, useRef } from "react";
import { Message } from "@/types/chat";

interface UseKAIChatStreamReturn {
  streamChat: (
    messages: Message[],
    clientId?: string | null,
    workspaceId?: string | null
  ) => Promise<string>;
  isStreaming: boolean;
  currentResponse: string;
  stopStream: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kai-chat`;

/**
 * Hook for streaming chat responses from kAI
 */
export function useKAIChatStream(): UseKAIChatStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const streamChat = useCallback(
    async (
      messages: Message[],
      clientId?: string | null,
      workspaceId?: string | null
    ): Promise<string> => {
      setIsStreaming(true);
      setCurrentResponse("");
      
      abortControllerRef.current = new AbortController();
      let fullResponse = "";

      try {
        const chatMessages = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: chatMessages,
            clientId,
            workspaceId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({}));
          throw new Error(errorData.error || `Erro: ${resp.status}`);
        }

        if (!resp.body) {
          throw new Error("Stream não disponível");
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                fullResponse += content;
                setCurrentResponse(fullResponse);
              }
            } catch {
              // Incomplete JSON, put back and wait
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Flush remaining buffer
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                fullResponse += content;
                setCurrentResponse(fullResponse);
              }
            } catch {
              // Ignore partial leftovers
            }
          }
        }

        return fullResponse;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return fullResponse;
        }
        throw error;
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  return {
    streamChat,
    isStreaming,
    currentResponse,
    stopStream,
  };
}
