import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Message, ProcessStep, MultiAgentStep } from "@/types/chat";
import { 
  KAIActionType,
  KAIActionStatus,
  KAIFileAttachment,
  PendingAction,
  DetectedAction,
} from "@/types/kaiActions";
import { toast } from "sonner";
import { useKAIActions } from "@/hooks/useKAIActions";
import { useKAICSVAnalysis } from "@/hooks/useKAICSVAnalysis";
import { useKAIURLAnalysis } from "@/hooks/useKAIURLAnalysis";
import { useKAIExecuteAction } from "@/hooks/useKAIExecuteAction";
import { useClientChat } from "@/hooks/useClientChat";
import { supabase } from "@/integrations/supabase/client";
import { Citation } from "@/components/chat/CitationChip";

const LOCAL_STORAGE_KEY = "kai-selected-client";

// Library item types (matching useClientChat return types)
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

// Extended context value with all features
interface GlobalKAIContextValue {
  // Panel state
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  
  // Chat state (from useClientChat)
  messages: Message[];
  isProcessing: boolean;
  currentStep: ProcessStep;
  multiAgentStep: MultiAgentStep;
  multiAgentDetails: Record<string, string>;
  conversationId: string | null;
  
  // Libraries (from useClientChat)
  contentLibrary: ContentLibraryItem[];
  referenceLibrary: ReferenceLibraryItem[];
  
  // Workspace data
  assignees: AssigneeItem[];
  clients: ClientItem[];
  
  // Client selection
  selectedClientId: string | null;
  setSelectedClientId: (clientId: string | null) => void;
  
  // Message handling (delegates to useClientChat)
  sendMessage: (text: string, files?: File[], citations?: Citation[]) => Promise<void>;
  clearConversation: () => void;
  startNewConversation: () => Promise<void>;
  regenerateLastMessage: () => Promise<void>;
  
  // Action handling
  actionStatus: KAIActionStatus;
  pendingAction: PendingAction | null;
  confirmAction: () => Promise<void>;
  cancelAction: () => void;
  
  // File handling
  attachedFiles: KAIFileAttachment[];
  attachFiles: (files: File[]) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  
  // Mode selection
  chatMode: "content" | "ideas" | "free_chat";
  setChatMode: (mode: "content" | "ideas" | "free_chat") => void;
  
  // Workflow state
  isIdeaMode: boolean;
  isFreeChatMode: boolean;
}

// Export context for external use
export const GlobalKAIContext = createContext<GlobalKAIContextValue | null>(null);

interface GlobalKAIProviderProps {
  children: ReactNode;
}

export function GlobalKAIProvider({ children }: GlobalKAIProviderProps) {
  const [searchParams] = useSearchParams();
  
  // Panel state
  const [isOpen, setIsOpen] = useState(false);
  
  // Client and workspace state - initialize from URL or localStorage
  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(() => {
    const fromUrl = searchParams.get("client");
    if (fromUrl) return fromUrl;
    return localStorage.getItem(LOCAL_STORAGE_KEY);
  });
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Action handling state
  const [actionStatus, setActionStatus] = useState<KAIActionStatus>("idle");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<KAIFileAttachment[]>([]);
  
  // Chat mode
  const [chatMode, setChatMode] = useState<"content" | "ideas" | "free_chat">("content");
  
  // Workspace data
  const [assignees, setAssignees] = useState<AssigneeItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);

  // Hooks for action handling
  const { detectAction, isDetecting } = useKAIActions();
  const { analyzeCSV, isAnalyzing: isAnalyzingCSV } = useKAICSVAnalysis();
  const { analyzeURL, isAnalyzing: isAnalyzingURL } = useKAIURLAnalysis();
  const { executeAction: executeActionHook, isExecuting } = useKAIExecuteAction();

  // ============================================
  // USE THE MAIN useClientChat HOOK
  // This gives us: persistence, multi-agent pipeline, libraries, etc.
  // ============================================
  const clientChat = useClientChat(
    selectedClientId || "",
    undefined, // templateId - global doesn't use templates
    undefined  // conversationIdParam
  );

  // Destructure all the goodies from useClientChat
  const {
    messages,
    isLoading: isClientChatLoading,
    currentStep,
    multiAgentStep,
    multiAgentDetails,
    conversationId,
    contentLibrary,
    referenceLibrary,
    sendMessage: clientChatSendMessage,
    clearConversation: clientChatClearConversation,
    startNewConversation: clientChatStartNewConversation,
    regenerateLastMessage: clientChatRegenerateLastMessage,
    isIdeaMode,
    isFreeChatMode,
  } = clientChat;

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
          setWorkspaceId(membership.workspace_id);
        }
      }
    };
    fetchWorkspace();
  }, []);

  // Fetch assignees (workspace members) and clients when workspace is set
  useEffect(() => {
    if (!workspaceId) {
      setAssignees([]);
      setClients([]);
      return;
    }

    const fetchWorkspaceData = async () => {
      try {
        // Fetch workspace members
        const { data: members } = await supabase
          .from("workspace_members")
          .select("user_id, role")
          .eq("workspace_id", workspaceId);

        if (members && members.length > 0) {
          const userIds = members.map(m => m.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, email")
            .in("id", userIds);

          if (profiles) {
            const assigneesList = profiles.map(profile => ({
              id: profile.id,
              name: profile.full_name || profile.email || "Usuário",
              email: profile.email || undefined,
              avatar_url: profile.avatar_url || undefined,
            }));
            setAssignees(assigneesList);
          }
        }

        // Fetch clients
        const { data: clientsData } = await supabase
          .from("clients")
          .select("id, name, avatar_url")
          .eq("workspace_id", workspaceId)
          .order("name", { ascending: true });

        if (clientsData) {
          const clientsList = clientsData.map(c => ({
            id: c.id,
            name: c.name,
            avatar_url: c.avatar_url || undefined,
          }));
          setClients(clientsList);
        }
      } catch (error) {
        console.error("Error fetching workspace data:", error);
      }
    };

    fetchWorkspaceData();
  }, [workspaceId]);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Panel controls
  const openPanel = useCallback(() => setIsOpen(true), []);
  const closePanel = useCallback(() => setIsOpen(false), []);
  const togglePanel = useCallback(() => setIsOpen(prev => !prev), []);

  // Sync selectedClientId from URL when it changes
  useEffect(() => {
    const clientFromUrl = searchParams.get("client");
    if (clientFromUrl && clientFromUrl !== selectedClientId) {
      setSelectedClientIdState(clientFromUrl);
      localStorage.setItem(LOCAL_STORAGE_KEY, clientFromUrl);
    }
  }, [searchParams, selectedClientId]);

  // Auto-select first client if none selected and clients loaded
  useEffect(() => {
    if (!selectedClientId && clients.length > 0) {
      const firstClient = clients[0].id;
      setSelectedClientIdState(firstClient);
      localStorage.setItem(LOCAL_STORAGE_KEY, firstClient);
    }
    // Mark initialization complete
    if (clients.length > 0 || workspaceId) {
      setIsInitializing(false);
    }
  }, [selectedClientId, clients, workspaceId]);

  // Client selection with localStorage persistence
  const setSelectedClientId = useCallback((clientId: string | null) => {
    setSelectedClientIdState(clientId);
    if (clientId) {
      localStorage.setItem(LOCAL_STORAGE_KEY, clientId);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  // Process detected action to prepare pending action
  const prepareAction = useCallback(async (
    detected: DetectedAction,
    files?: KAIFileAttachment[]
  ): Promise<PendingAction | null> => {
    const action: PendingAction = {
      id: crypto.randomUUID(),
      type: detected.type,
      status: "previewing",
      params: detected.params,
      files,
      createdAt: new Date(),
    };

    try {
      if (detected.type === "upload_metrics" && files && files.length > 0) {
        const csvFile = files.find(f => f.type === "text/csv" || f.name.endsWith(".csv"));
        if (csvFile) {
          const analysis = await analyzeCSV(csvFile.file);
          action.preview = {
            title: `Importar métricas de ${analysis.platform || "plataforma desconhecida"}`,
            description: `${analysis.preview?.totalRows || 0} registros encontrados`,
            data: analysis as unknown as Record<string, unknown>,
          };
        }
      } else if ((detected.type === "upload_to_library" || detected.type === "upload_to_references" || detected.type === "analyze_url") && detected.params.url) {
        const analysis = await analyzeURL(detected.params.url);
        action.preview = {
          title: analysis.title || "Conteúdo extraído",
          description: analysis.description || "Conteúdo da URL foi analisado",
          data: {
            content: analysis.content,
            thumbnailUrl: analysis.thumbnailUrl,
            type: analysis.type,
          },
        };
        action.params = { ...action.params, title: analysis.title };
      } else if (detected.type === "create_planning_card") {
        action.preview = {
          title: detected.params.title || "Novo card",
          description: detected.params.description || "Card será criado no planejamento",
        };
      } else if (detected.type === "create_content") {
        action.preview = {
          title: `Criar ${detected.params.format || "post"}`,
          description: detected.params.description || "Conteúdo será gerado com IA",
        };
      }

      return action;
    } catch (error) {
      console.error("Error preparing action:", error);
      return action;
    }
  }, [analyzeCSV, analyzeURL]);

  // Wrapped send message that handles action detection + delegates to useClientChat
  const sendMessage = useCallback(async (text: string, files?: File[], citations?: Citation[]) => {
    if (!text.trim() && (!files || files.length === 0)) return;
    
    // Guard: ensure client is selected
    if (!selectedClientId) {
      toast.error("Selecione um cliente antes de enviar mensagem");
      return;
    }
    
    // Guard: ensure conversation is ready (useClientChat will create one automatically)
    if (!conversationId && isInitializing) {
      toast.info("Inicializando chat...");
      return;
    }

    // Convert files to attachments for action detection
    const fileAttachments: KAIFileAttachment[] = files?.map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    })) || [];

    const allAttachments = [...attachedFiles, ...fileAttachments];

    setActionStatus("detecting");

    try {
      // Step 1: Detect action intent
      const detected = await detectAction(text, allAttachments, {
        clientId: selectedClientId || undefined,
        currentPage: window.location.pathname,
      });

      // Step 2: If action requires confirmation, prepare and show dialog
      if (detected.requiresConfirmation && detected.type !== "general_chat") {
        setActionStatus("analyzing");
        
        const preparedAction = await prepareAction(detected, allAttachments);
        
        if (preparedAction) {
          setPendingAction(preparedAction);
          setActionStatus("confirming");
          return; // Wait for user confirmation
        }
      }

      // Step 3: For general chat or non-confirmation actions, use clientChat
      setActionStatus("idle");
      setAttachedFiles([]);
      
      // Map chatMode to explicitMode for useClientChat
      const explicitMode = chatMode === "content" ? "content" : chatMode === "ideas" ? "ideas" : "free_chat";
      
      await clientChatSendMessage(text, undefined, "fast", explicitMode, citations);

    } catch (error) {
      console.error("kAI chat error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao processar mensagem");
      setActionStatus("idle");
    }
  }, [selectedClientId, attachedFiles, detectAction, prepareAction, clientChatSendMessage, chatMode, conversationId, isInitializing]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    clientChatClearConversation();
    setPendingAction(null);
    setActionStatus("idle");
  }, [clientChatClearConversation]);

  // Start new conversation
  const startNewConversation = useCallback(async () => {
    await clientChatStartNewConversation();
    setPendingAction(null);
    setActionStatus("idle");
  }, [clientChatStartNewConversation]);

  // Regenerate last message
  const regenerateLastMessage = useCallback(async () => {
    await clientChatRegenerateLastMessage();
  }, [clientChatRegenerateLastMessage]);

  // Action confirmation handler
  const confirmAction = useCallback(async () => {
    if (!pendingAction || !selectedClientId || !workspaceId) {
      toast.error("Selecione um cliente antes de executar a ação");
      return;
    }

    setActionStatus("executing");

    try {
      const result = await executeActionHook({
        action: pendingAction,
        clientId: selectedClientId,
        workspaceId: workspaceId,
      });

      // Add success message via clientChat
      const resultMessage = result.success 
        ? `✅ ${result.message}` 
        : `❌ ${result.message}`;
      
      toast(resultMessage);
      
      setActionStatus("completed");
      setPendingAction(null);
    } catch (error) {
      console.error("Error executing action:", error);
      toast.error("Erro ao executar ação");
      setActionStatus("idle");
      setPendingAction(null);
    }
  }, [pendingAction, selectedClientId, workspaceId, executeActionHook]);

  const cancelAction = useCallback(() => {
    setPendingAction(null);
    setActionStatus("idle");
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

    setAttachedFiles(prev => [...prev, ...newAttachments]);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setAttachedFiles(prev => {
      const file = prev.find((f) => f.id === fileId);
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter((f) => f.id !== fileId);
    });
  }, []);

  const clearFiles = useCallback(() => {
    setAttachedFiles(prev => {
      prev.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      return [];
    });
  }, []);

  const value: GlobalKAIContextValue = {
    // Panel state
    isOpen,
    openPanel,
    closePanel,
    togglePanel,
    
    // Chat state (from useClientChat)
    messages,
    isProcessing: isClientChatLoading || isDetecting || isAnalyzingCSV || isAnalyzingURL || isExecuting,
    currentStep,
    multiAgentStep,
    multiAgentDetails,
    conversationId,
    
    // Libraries (from useClientChat)
    contentLibrary: contentLibrary as ContentLibraryItem[],
    referenceLibrary: referenceLibrary as ReferenceLibraryItem[],
    
    // Workspace data
    assignees,
    clients,
    
    // Client selection
    selectedClientId,
    setSelectedClientId,
    
    // Message handling
    sendMessage,
    clearConversation,
    startNewConversation,
    regenerateLastMessage,
    
    // Action handling
    actionStatus,
    pendingAction,
    confirmAction,
    cancelAction,
    
    // File handling
    attachedFiles,
    attachFiles,
    removeFile,
    clearFiles,
    
    // Mode selection
    chatMode,
    setChatMode,
    
    // Workflow state
    isIdeaMode,
    isFreeChatMode,
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
