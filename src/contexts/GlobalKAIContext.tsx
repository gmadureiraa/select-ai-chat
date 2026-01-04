import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from "react";
import { Message, ProcessStep, MultiAgentStep } from "@/types/chat";
import { 
  KAIContextValue, 
  KAIGlobalState, 
  KAIFileAttachment,
  KAIActionStatus,
  PendingAction,
  DetectedAction,
} from "@/types/kaiActions";
import { toast } from "sonner";
import { useKAIActions } from "@/hooks/useKAIActions";
import { useKAICSVAnalysis } from "@/hooks/useKAICSVAnalysis";
import { useKAIURLAnalysis } from "@/hooks/useKAIURLAnalysis";
import { useKAIExecuteAction } from "@/hooks/useKAIExecuteAction";
import { useCSVValidation, ValidationResult } from "@/hooks/useCSVValidation";
import { supabase } from "@/integrations/supabase/client";
import { Citation } from "@/components/chat/CitationChip";

// Library item types
interface ContentLibraryItem {
  id: string;
  title: string;
  content_type: string;
  content: string;
}

interface ReferenceLibraryItem {
  id: string;
  title: string;
  reference_type: string;
  content: string;
}

interface AssigneeItem {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
}

interface ClientItem {
  id: string;
  name: string;
  avatar_url?: string;
}

// Extended state with streaming response and libraries
interface ExtendedKAIState extends KAIGlobalState {
  streamingResponse: string;
  workspaceId: string | null;
  contentLibrary: ContentLibraryItem[];
  referenceLibrary: ReferenceLibraryItem[];
  assignees: AssigneeItem[];
  clients: ClientItem[];
  csvValidationResults: ValidationResult[];
  pendingCSVFiles: File[];
}

// Extended context value with libraries
interface ExtendedKAIContextValue extends KAIContextValue {
  contentLibrary: ContentLibraryItem[];
  referenceLibrary: ReferenceLibraryItem[];
  assignees: AssigneeItem[];
  clients: ClientItem[];
  csvValidationResults: ValidationResult[];
  sendMessage: (text: string, files?: File[], citations?: Citation[]) => Promise<void>;
  proceedCSVImport: () => void;
  cancelCSVValidation: () => void;
  applyCSVFix: (fileIndex: number, warningIndex: number) => void;
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
  workspaceId: null,
  contentLibrary: [],
  referenceLibrary: [],
  assignees: [],
  clients: [],
  csvValidationResults: [],
  pendingCSVFiles: [],
};

// Export context for external use
export const GlobalKAIContext = createContext<ExtendedKAIContextValue | null>(null);

interface GlobalKAIProviderProps {
  children: ReactNode;
}

export function GlobalKAIProvider({ children }: GlobalKAIProviderProps) {
  const [state, setState] = useState<ExtendedKAIState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Hooks for action handling
  const { detectAction, isDetecting } = useKAIActions();
  const { analyzeCSV, isAnalyzing: isAnalyzingCSV } = useKAICSVAnalysis();
  const { analyzeURL, isAnalyzing: isAnalyzingURL } = useKAIURLAnalysis();
  const { executeAction: executeActionHook, isExecuting } = useKAIExecuteAction();
  const { validateFiles, applyFix } = useCSVValidation();

  // Fetch user's workspace on mount
  useEffect(() => {
    const fetchWorkspace = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: membership } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", userData.user.id)
          .limit(1)
          .single();
        
        if (membership) {
          setState(prev => ({ ...prev, workspaceId: membership.workspace_id }));
        }
      }
    };
    fetchWorkspace();
  }, []);

  // Fetch assignees (workspace members) and clients when workspace is set
  useEffect(() => {
    if (!state.workspaceId) {
      setState(prev => ({
        ...prev,
        assignees: [],
        clients: [],
      }));
      return;
    }

    const fetchWorkspaceData = async () => {
      try {
        // Fetch workspace members
        const { data: members } = await supabase
          .from("workspace_members")
          .select("user_id, role")
          .eq("workspace_id", state.workspaceId);

        if (members && members.length > 0) {
          const userIds = members.map(m => m.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, email")
            .in("id", userIds);

          if (profiles) {
            const assignees = profiles.map(profile => ({
              id: profile.id,
              name: profile.full_name || profile.email || "Usuário",
              email: profile.email || undefined,
              avatar_url: profile.avatar_url || undefined,
            }));
            setState(prev => ({ ...prev, assignees }));
          }
        }

        // Fetch clients
        const { data: clientsData } = await supabase
          .from("clients")
          .select("id, name, avatar_url")
          .eq("workspace_id", state.workspaceId)
          .order("name", { ascending: true });

        if (clientsData) {
          const clients = clientsData.map(c => ({
            id: c.id,
            name: c.name,
            avatar_url: c.avatar_url || undefined,
          }));
          setState(prev => ({ ...prev, clients }));
        }
      } catch (error) {
        console.error("Error fetching workspace data:", error);
      }
    };

    fetchWorkspaceData();
  }, [state.workspaceId]);

  // Fetch libraries when client is selected
  useEffect(() => {
    if (!state.selectedClientId) {
      setState(prev => ({
        ...prev,
        contentLibrary: [],
        referenceLibrary: [],
      }));
      return;
    }

    const fetchLibraries = async () => {
      try {
        // Fetch content library
        const { data: contentData } = await supabase
          .from("client_content_library")
          .select("id, title, content_type, content")
          .eq("client_id", state.selectedClientId)
          .order("created_at", { ascending: false })
          .limit(50);

        // Fetch reference library
        const { data: referenceData } = await supabase
          .from("client_reference_library")
          .select("id, title, reference_type, content")
          .eq("client_id", state.selectedClientId)
          .order("created_at", { ascending: false })
          .limit(50);

        setState(prev => ({
          ...prev,
          contentLibrary: contentData || [],
          referenceLibrary: referenceData || [],
        }));
      } catch (error) {
        console.error("Error fetching libraries:", error);
      }
    };

    fetchLibraries();
  }, [state.selectedClientId]);

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

  // Process detected action to prepare pending action
  const prepareAction = useCallback(async (
    detected: DetectedAction,
    files?: KAIFileAttachment[]
  ): Promise<PendingAction | null> => {
    const pendingAction: PendingAction = {
      id: crypto.randomUUID(),
      type: detected.type,
      status: "previewing",
      params: detected.params,
      files,
      createdAt: new Date(),
    };

    try {
      // Analyze files or URLs to build preview
      if (detected.type === "upload_metrics" && files && files.length > 0) {
        const csvFile = files.find(f => f.type === "text/csv" || f.name.endsWith(".csv"));
        if (csvFile) {
          const analysis = await analyzeCSV(csvFile.file);
          pendingAction.preview = {
            title: `Importar métricas de ${analysis.platform || "plataforma desconhecida"}`,
            description: `${analysis.preview?.totalRows || 0} registros encontrados`,
            data: analysis as unknown as Record<string, unknown>,
          };
        }
      } else if ((detected.type === "upload_to_library" || detected.type === "upload_to_references" || detected.type === "analyze_url") && detected.params.url) {
        const analysis = await analyzeURL(detected.params.url);
        pendingAction.preview = {
          title: analysis.title || "Conteúdo extraído",
          description: analysis.description || "Conteúdo da URL foi analisado",
          data: {
            content: analysis.content,
            thumbnailUrl: analysis.thumbnailUrl,
            type: analysis.type,
          },
        };
        pendingAction.params = { ...pendingAction.params, title: analysis.title };
      } else if (detected.type === "create_planning_card") {
        pendingAction.preview = {
          title: detected.params.title || "Novo card",
          description: detected.params.description || "Card será criado no planejamento",
        };
      } else if (detected.type === "create_content") {
        pendingAction.preview = {
          title: `Criar ${detected.params.format || "post"}`,
          description: detected.params.description || "Conteúdo será gerado com IA",
        };
      }

      return pendingAction;
    } catch (error) {
      console.error("Error preparing action:", error);
      return pendingAction;
    }
  }, [analyzeCSV, analyzeURL]);

  // Message handling with real streaming
  const sendMessage = useCallback(async (text: string, files?: File[], citations?: Citation[]) => {
    if (!text.trim() && (!files || files.length === 0)) return;

    // Convert files to attachments
    const fileAttachments: KAIFileAttachment[] = files?.map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    })) || [];

    const allAttachments = [...state.attachedFiles, ...fileAttachments];

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

    try {
      // Step 1: Detect action intent
      const detected = await detectAction(text, allAttachments, {
        clientId: state.selectedClientId || undefined,
        currentPage: window.location.pathname,
      });

      // Step 2: If action requires confirmation, prepare and show dialog
      if (detected.requiresConfirmation && detected.type !== "general_chat") {
        setState(prev => ({ ...prev, actionStatus: "analyzing" }));
        
        const preparedAction = await prepareAction(detected, allAttachments);
        
        if (preparedAction) {
          setState(prev => ({
            ...prev,
            pendingAction: preparedAction,
            actionStatus: "confirming",
            isProcessing: false,
          }));
          return; // Wait for user confirmation
        }
      }

      // Step 3: For general chat or non-confirmation actions, proceed with streaming
      await streamChatResponse(allMessages, citations);

    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setState((prev) => ({ ...prev, isProcessing: false, actionStatus: "idle" }));
        return;
      }
      
      console.error("kAI chat error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao processar mensagem");
      
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
    }
  }, [state.messages, state.selectedClientId, state.attachedFiles, detectAction, prepareAction]);

  // Stream chat response
  const streamChatResponse = useCallback(async (allMessages: Message[], citations?: Citation[]) => {
    abortControllerRef.current = new AbortController();
    let fullResponse = "";

    try {
      const chatMessages = allMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Prepare citations data for the edge function
      const citationsData = citations?.map(c => ({
        id: c.id,
        type: c.type,
        title: c.title,
        category: c.category,
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
          workspaceId: state.workspaceId,
          citations: citationsData,
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
        actionStatus: "idle",
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
        return;
      }
      throw error;
    } finally {
      abortControllerRef.current = null;
    }
  }, [state.selectedClientId, state.workspaceId]);

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

  // Action confirmation handler
  const confirmAction = useCallback(async () => {
    if (!state.pendingAction || !state.selectedClientId || !state.workspaceId) {
      toast.error("Selecione um cliente antes de executar a ação");
      return;
    }

    setState((prev) => ({
      ...prev,
      actionStatus: "executing",
      isProcessing: true,
    }));

    try {
      const result = await executeActionHook({
        action: state.pendingAction,
        clientId: state.selectedClientId,
        workspaceId: state.workspaceId,
      });

      // Add success message
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.success 
            ? `✅ ${result.message}` 
            : `❌ ${result.message}`,
          created_at: new Date().toISOString(),
        }],
        actionStatus: "completed",
        pendingAction: null,
        isProcessing: false,
      }));
    } catch (error) {
      console.error("Error executing action:", error);
      toast.error("Erro ao executar ação");
      setState((prev) => ({
        ...prev,
        actionStatus: "idle",
        pendingAction: null,
        isProcessing: false,
      }));
    }
  }, [state.pendingAction, state.selectedClientId, state.workspaceId, executeActionHook]);

  const cancelAction = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentAction: null,
      actionStatus: "idle",
      pendingAction: null,
      isProcessing: false,
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

  // CSV Validation handlers
  const proceedCSVImport = useCallback(() => {
    // TODO: Implement actual import using useSmartInstagramImport
    toast.success("Importação de CSV iniciada");
    setState((prev) => ({
      ...prev,
      csvValidationResults: [],
      pendingCSVFiles: [],
    }));
  }, []);

  const cancelCSVValidation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      csvValidationResults: [],
      pendingCSVFiles: [],
    }));
  }, []);

  const applyCSVFix = useCallback((fileIndex: number, warningIndex: number) => {
    applyFix(fileIndex, warningIndex);
  }, [applyFix]);

  const value: ExtendedKAIContextValue = {
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
    proceedCSVImport,
    cancelCSVValidation,
    applyCSVFix,
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
