import { useState, useCallback, useEffect, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  KAIActionStatus,
  KAIFileAttachment,
  DetectedAction,
  PendingAction,
} from "@/types/kaiActions";
import { toast } from "sonner";
import { useKAISimpleChat, SimpleCitation } from "@/hooks/useKAISimpleChat";
import { useKAIActions } from "@/hooks/useKAIActions";
import { useKAIExecuteAction } from "@/hooks/useKAIExecuteAction";
import { useKAIConversations } from "@/hooks/useKAIConversations";
import { supabase } from "@/integrations/supabase/client";
import {
  GlobalKAIContext,
  type GlobalKAIChatMode,
  type GlobalKAIContextValue,
  type ContentLibraryItem,
  type ReferenceLibraryItem,
  type AssigneeItem,
  type ClientItem,
  type SimpleCitationType,
} from "@/contexts/GlobalKAIContextBase";
import type { Message } from "@/types/chat";

const LOCAL_STORAGE_KEY = "kai-selected-client";

// Helper to get human-readable action titles
function getActionTitle(type: string): string {
  const titles: Record<string, string> = {
    create_content: "Criar conteúdo",
    ask_about_metrics: "Análise de métricas",
    upload_metrics: "Importar métricas",
    create_planning_card: "Criar card no planejamento",
    upload_to_library: "Adicionar à biblioteca",
    upload_to_references: "Salvar referência",
    analyze_url: "Analisar URL",
    general_chat: "Conversa geral",
  };
  return titles[type] || type;
}

interface GlobalKAIProviderProps {
  children: ReactNode;
}

export function GlobalKAIProvider({ children }: GlobalKAIProviderProps) {
  const [searchParams] = useSearchParams();
  
  // Panel state
  const [isOpen, setIsOpen] = useState(false);
  
  // Client and workspace state
  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(() => {
    const fromUrl = searchParams.get("client");
    if (fromUrl) return fromUrl;
    return localStorage.getItem(LOCAL_STORAGE_KEY);
  });
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  
  // Action state
  const [actionStatus, setActionStatus] = useState<KAIActionStatus>("idle");
  const [attachedFiles, setAttachedFiles] = useState<KAIFileAttachment[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  
  // Chat mode (simplified - just one mode)
  const [chatMode, setChatMode] = useState<GlobalKAIChatMode>("content");

  // Action hooks
  const { detectAction } = useKAIActions();
  const { executeAction, isExecuting, progress: actionProgress } = useKAIExecuteAction();

  // Workspace data
  const [assignees, setAssignees] = useState<AssigneeItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  
  // Libraries
  const [contentLibrary, setContentLibrary] = useState<ContentLibraryItem[]>([]);
  const [referenceLibrary, setReferenceLibrary] = useState<ReferenceLibraryItem[]>([]);

  // ============================================
  // CONVERSATION PERSISTENCE
  // ============================================
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    createConversation,
    deleteConversation,
    isLoading: isLoadingConversations,
  } = useKAIConversations({ clientId: selectedClientId });

  // ============================================
  // USE THE SIMPLE CHAT HOOK WITH CONVERSATION ID
  // ============================================
  const simpleChat = useKAISimpleChat({
    clientId: selectedClientId || "",
    conversationId: activeConversationId || undefined,
    onConversationCreated: (newConvId) => {
      setActiveConversationId(newConvId);
    },
  });

  // Auto-select most recent conversation when client changes
  useEffect(() => {
    if (selectedClientId && conversations.length > 0 && !activeConversationId) {
      // Select the most recent conversation
      setActiveConversationId(conversations[0].id);
    }
  }, [selectedClientId, conversations, activeConversationId, setActiveConversationId]);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      simpleChat.loadMessages(activeConversationId);
    }
  }, [activeConversationId]);

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

  // Fetch workspace data when workspace is set
  useEffect(() => {
    if (!workspaceId) return;

    const fetchWorkspaceData = async () => {
      try {
        // Fetch clients
        const { data: clientsData } = await supabase
          .from("clients")
          .select("id, name, avatar_url")
          .eq("workspace_id", workspaceId)
          .order("name", { ascending: true });

        if (clientsData) {
          setClients(clientsData.map(c => ({
            id: c.id,
            name: c.name,
            avatar_url: c.avatar_url || undefined,
          })));
        }
      } catch (error) {
        console.error("Error fetching workspace data:", error);
      }
    };

    fetchWorkspaceData();
  }, [workspaceId]);

  // Fetch libraries when client is selected
  useEffect(() => {
    if (!selectedClientId) {
      setContentLibrary([]);
      setReferenceLibrary([]);
      return;
    }

    const fetchLibraries = async () => {
      try {
        // Fetch content library
        const { data: content } = await supabase
          .from("client_content_library")
          .select("id, title, content_type")
          .eq("client_id", selectedClientId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (content) {
          setContentLibrary(content.map(c => ({
            id: c.id,
            title: c.title,
            content_type: c.content_type,
          })) as ContentLibraryItem[]);
        }

        // Fetch reference library
        const { data: refs } = await supabase
          .from("client_reference_library")
          .select("id, title, reference_type")
          .eq("client_id", selectedClientId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (refs) {
          setReferenceLibrary(refs.map(r => ({
            id: r.id,
            title: r.title,
            reference_type: r.reference_type,
          })) as ReferenceLibraryItem[]);
        }
      } catch (error) {
        console.error("Error fetching libraries:", error);
      }
    };

    fetchLibraries();
  }, [selectedClientId]);

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

  // Sync selectedClientId from URL
  useEffect(() => {
    const clientFromUrl = searchParams.get("client");
    if (clientFromUrl && clientFromUrl !== selectedClientId) {
      setSelectedClientIdState(clientFromUrl);
      localStorage.setItem(LOCAL_STORAGE_KEY, clientFromUrl);
    }
  }, [searchParams, selectedClientId]);

  // Auto-select first client if none selected
  useEffect(() => {
    if (!selectedClientId && clients.length > 0) {
      const firstClient = clients[0].id;
      setSelectedClientIdState(firstClient);
      localStorage.setItem(LOCAL_STORAGE_KEY, firstClient);
    }
  }, [selectedClientId, clients]);

  // Client selection with localStorage persistence
  const setSelectedClientId = useCallback((clientId: string | null) => {
    setSelectedClientIdState(clientId);
    if (clientId) {
      localStorage.setItem(LOCAL_STORAGE_KEY, clientId);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    // Clear chat when switching clients
    simpleChat.clearHistory();
  }, [simpleChat]);

  // ============================================
  // SEND MESSAGE WITH ACTION DETECTION
  // ============================================
  const sendMessage = useCallback(async (
    text: string, 
    files?: File[], 
    citations?: SimpleCitation[]
  ) => {
    if (!text.trim() && (!files || files.length === 0)) return;
    
    if (!selectedClientId) {
      toast.error("Selecione um cliente antes de enviar mensagem");
      return;
    }

    // Convert files to KAIFileAttachment format for detection
    const fileAttachments: KAIFileAttachment[] = (files || []).map(f => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      type: f.type,
      size: f.size,
    }));

    // Detect action intent
    const detectedAction = await detectAction(text, fileAttachments, {
      clientId: selectedClientId,
    });

    console.log("[GlobalKAI] Detected action:", detectedAction);

    // If action requires confirmation, show preview
    if (detectedAction.requiresConfirmation && detectedAction.confidence >= 0.7) {
      // Build PendingAction from DetectedAction
      const newPendingAction: PendingAction = {
        id: crypto.randomUUID(),
        type: detectedAction.type,
        status: "confirming",
        params: detectedAction.params,
        files: fileAttachments.length > 0 ? fileAttachments : undefined,
        createdAt: new Date(),
        preview: {
          title: getActionTitle(detectedAction.type),
          description: text,
        },
      };
      setPendingAction(newPendingAction);
      setActionStatus("confirming");
      return;
    }

    // For general chat or low-confidence actions, proceed with chat
    setActionStatus("executing");
    setAttachedFiles([]);

    try {
      await simpleChat.sendMessage(text, citations);
    } catch (error) {
      console.error("kAI chat error:", error);
      toast.error("Erro ao processar mensagem");
    } finally {
      setActionStatus("idle");
    }
  }, [selectedClientId, simpleChat, detectAction]);

  // Start new conversation (clears local state, next message creates new conversation)
  const startNewConversation = useCallback(() => {
    simpleChat.clearHistory();
    setActiveConversationId(null);
    setActionStatus("idle");
    setPendingAction(null);
  }, [simpleChat, setActiveConversationId]);

  // Delete current conversation from database
  const handleDeleteConversation = useCallback(async () => {
    if (!activeConversationId) return;
    
    try {
      await deleteConversation(activeConversationId);
      simpleChat.clearHistory();
      setActiveConversationId(null);
      toast.success("Conversa apagada");
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Erro ao apagar conversa");
    }
  }, [activeConversationId, deleteConversation, simpleChat, setActiveConversationId]);

  // Clear conversation (now starts new instead of deleting)
  const clearConversation = useCallback(() => {
    startNewConversation();
  }, [startNewConversation]);

  // Cancel request
  const cancelRequest = useCallback(() => {
    simpleChat.cancelRequest();
    setActionStatus("idle");
  }, [simpleChat]);

  // Regenerate - just resend last message
  const regenerateLastMessage = useCallback(async () => {
    const lastUserMessage = [...simpleChat.messages]
      .reverse()
      .find(m => m.role === "user");
    
    if (lastUserMessage) {
      await simpleChat.sendMessage(lastUserMessage.content);
    }
  }, [simpleChat]);

  // ============================================
  // ACTION CONFIRMATION HANDLERS
  // ============================================
  const confirmAction = useCallback(async () => {
    if (!pendingAction || !selectedClientId || !workspaceId) {
      toast.error("Erro: ação não encontrada");
      return;
    }

    setActionStatus("executing");
    
    try {
      const result = await executeAction({
        action: pendingAction,
        clientId: selectedClientId,
        workspaceId,
      });

      if (result.success) {
        toast.success(result.message || "Ação executada com sucesso!");
        
        // Add confirmation message to chat
        simpleChat.sendMessage(
          `✅ Ação executada: ${getActionTitle(pendingAction.type)}\n${result.message || ""}`
        );
      } else {
        toast.error(result.message || "Erro ao executar ação");
      }
    } catch (error) {
      console.error("[GlobalKAI] Action execution error:", error);
      toast.error("Erro ao executar ação");
    } finally {
      setPendingAction(null);
      setActionStatus("idle");
    }
  }, [pendingAction, selectedClientId, workspaceId, executeAction, simpleChat]);

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

  // Convert SimpleMessage to Message for compatibility
  const messages: Message[] = simpleChat.messages.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    created_at: m.timestamp.toISOString(),
  }));

  const value: GlobalKAIContextValue = {
    // Panel state
    isOpen,
    openPanel,
    closePanel,
    togglePanel,
    
    // Chat state
    messages,
    isProcessing: simpleChat.isLoading,
    currentStep: undefined,
    multiAgentStep: undefined,
    multiAgentDetails: undefined,
    conversationId: activeConversationId || undefined,
    
    // Conversation management
    conversations,
    activeConversationId,
    setActiveConversationId,
    startNewConversation,
    deleteConversation: handleDeleteConversation,
    
    // Libraries
    contentLibrary,
    referenceLibrary,
    
    // Workspace data
    assignees,
    clients,
    
    // Client selection
    selectedClientId,
    setSelectedClientId,
    
    // Message handling
    sendMessage,
    clearConversation,
    regenerateLastMessage,
    cancelRequest,
    
    // Action handling
    actionStatus,
    pendingAction: null,
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
    isIdeaMode: false,
    isFreeChatMode: true,
  };

  return (
    <GlobalKAIContext.Provider value={value}>
      {children}
    </GlobalKAIContext.Provider>
  );
}
