import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from "react";
import { Message, ProcessStep, MultiAgentStep } from "@/types/chat";
import { 
  KAIContextValue, 
  KAIGlobalState, 
  KAIFileAttachment,
  KAIActionStatus,
} from "@/types/kaiActions";
import { toast } from "sonner";

// Extended state with processing steps
interface ExtendedKAIState extends KAIGlobalState {
  currentStep: ProcessStep;
  multiAgentStep: MultiAgentStep;
  streamingResponse: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kai-chat`;

const initialState: ExtendedKAIState = {
  isOpen: false,
  messages: [],
  isProcessing: false,
  currentAction: null,
  actionStatus: "idle",
  pendingAction: null,
  attachedFiles: [],
  selectedClientId: null,
  currentStep: null,
  multiAgentStep: null,
  streamingResponse: "",
};

// Export context for external use
export const GlobalKAIContext = createContext<KAIContextValue | null>(null);

interface GlobalKAIProviderProps {
  children: ReactNode;
}

export function GlobalKAIProvider({ children }: GlobalKAIProviderProps) {
  const [state, setState] = useState<ExtendedKAIState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Panel controls
  const openPanel = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true }));
  }, []);

  const closePanel = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const togglePanel = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  // Message handling with real streaming
  const sendMessage = useCallback(async (text: string, files?: File[]) => {
    if (!text.trim() && (!files || files.length === 0)) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    const allMessages = [...state.messages, userMessage];

    setState((prev) => ({
      ...prev,
      messages: allMessages,
      isProcessing: true,
      actionStatus: "detecting",
      attachedFiles: [],
      streamingResponse: "",
    }));

    abortControllerRef.current = new AbortController();
    let fullResponse = "";

    try {
      const chatMessages = allMessages.map((m) => ({
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
          clientId: state.selectedClientId,
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

      // Create assistant message placeholder
      const assistantMessageId = crypto.randomUUID();
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
        }],
      }));

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
              // Update the last message with streaming content
              setState((prev) => {
                const msgs = [...prev.messages];
                const lastIdx = msgs.length - 1;
                if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
                  msgs[lastIdx] = { ...msgs[lastIdx], content: fullResponse };
                }
                return { ...prev, messages: msgs, streamingResponse: fullResponse };
              });
            }
          } catch {
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
            }
          } catch {
            // Ignore
          }
        }
      }

      // Final update
      setState((prev) => {
        const msgs = [...prev.messages];
        const lastIdx = msgs.length - 1;
        if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
          msgs[lastIdx] = { ...msgs[lastIdx], content: fullResponse };
        }
        return { ...prev, messages: msgs, isProcessing: false, actionStatus: "idle" };
      });
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setState((prev) => ({ ...prev, isProcessing: false, actionStatus: "idle" }));
        return;
      }
      
      console.error("kAI chat error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao processar mensagem");
      
      // Add error message
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
          created_at: new Date().toISOString(),
        }],
        isProcessing: false,
        actionStatus: "idle",
      }));
    } finally {
      abortControllerRef.current = null;
    }
  }, [state.messages, state.selectedClientId]);

  const clearConversation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState((prev) => ({
      ...prev,
      messages: [],
      currentAction: null,
      actionStatus: "idle",
      pendingAction: null,
      streamingResponse: "",
    }));
  }, []);

  // Action handling
  const confirmAction = useCallback(async () => {
    if (!state.pendingAction) return;

    setState((prev) => ({
      ...prev,
      actionStatus: "executing",
    }));

    // TODO: Execute the pending action with useKAIExecuteAction

    setState((prev) => ({
      ...prev,
      actionStatus: "completed",
      pendingAction: null,
    }));
  }, [state.pendingAction]);

  const cancelAction = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentAction: null,
      actionStatus: "idle",
      pendingAction: null,
    }));
  }, []);

  // File handling
  const attachFiles = useCallback((files: File[]) => {
    const newAttachments: KAIFileAttachment[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      previewUrl: file.type.startsWith("image/") 
        ? URL.createObjectURL(file) 
        : undefined,
    }));

    setState((prev) => ({
      ...prev,
      attachedFiles: [...prev.attachedFiles, ...newAttachments],
    }));
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setState((prev) => {
      const file = prev.attachedFiles.find((f) => f.id === fileId);
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return {
        ...prev,
        attachedFiles: prev.attachedFiles.filter((f) => f.id !== fileId),
      };
    });
  }, []);

  const clearFiles = useCallback(() => {
    setState((prev) => {
      prev.attachedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      return {
        ...prev,
        attachedFiles: [],
      };
    });
  }, []);

  // Client selection
  const setSelectedClientId = useCallback((clientId: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedClientId: clientId,
    }));
  }, []);

  const value: KAIContextValue = {
    ...state,
    openPanel,
    closePanel,
    togglePanel,
    sendMessage,
    clearConversation,
    confirmAction,
    cancelAction,
    attachFiles,
    removeFile,
    clearFiles,
    setSelectedClientId,
  };

  return (
    <GlobalKAIContext.Provider value={value}>
      {children}
    </GlobalKAIContext.Provider>
  );
}

export function useGlobalKAI() {
  const context = useContext(GlobalKAIContext);
  if (!context) {
    throw new Error("useGlobalKAI must be used within a GlobalKAIProvider");
  }
  return context;
}
