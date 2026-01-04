import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { Message } from "@/types/chat";
import { 
  KAIContextValue, 
  KAIGlobalState, 
  KAIFileAttachment,
  KAIActionType,
  KAIActionStatus,
  PendingAction 
} from "@/types/kaiActions";
import { useClients } from "@/hooks/useClients";

const initialState: KAIGlobalState = {
  isOpen: false,
  messages: [],
  isProcessing: false,
  currentAction: null,
  actionStatus: "idle",
  pendingAction: null,
  attachedFiles: [],
  selectedClientId: null,
};

const GlobalKAIContext = createContext<KAIContextValue | null>(null);

interface GlobalKAIProviderProps {
  children: ReactNode;
}

export function GlobalKAIProvider({ children }: GlobalKAIProviderProps) {
  const [state, setState] = useState<KAIGlobalState>(initialState);
  const { clients } = useClients();

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

  // Message handling
  const sendMessage = useCallback(async (text: string, files?: File[]) => {
    if (!text.trim() && (!files || files.length === 0)) return;

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isProcessing: true,
      attachedFiles: [], // Clear files after sending
    }));

    // TODO: Integrate with actual AI processing
    // For now, simulate a response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Recebi sua mensagem: "${text}"${files && files.length > 0 ? ` com ${files.length} arquivo(s) anexado(s)` : ""}. Esta é uma resposta de placeholder - a integração completa com o kAI será implementada na próxima fase.`,
        created_at: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isProcessing: false,
      }));
    }, 1500);
  }, []);

  const clearConversation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
      currentAction: null,
      actionStatus: "idle",
      pendingAction: null,
    }));
  }, []);

  // Action handling
  const confirmAction = useCallback(async () => {
    if (!state.pendingAction) return;

    setState((prev) => ({
      ...prev,
      actionStatus: "executing",
    }));

    // TODO: Execute the pending action
    // This will be implemented in phase 3

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
