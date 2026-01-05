import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { useKAIMentionParser, ParsedCommand } from "@/hooks/useKAIMentionParser";
import { SuccessCardPayload } from "@/components/chat/ResponseCard";

const LOCAL_STORAGE_KEY = "kai-selected-client";

// Safe actions that don't require confirmation (can be undone)
const SAFE_AUTO_EXECUTE_ACTIONS = [
  "create_batch_cards",
  "create_single_card",
];

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
  chatMode: "ideas" | "content" | "performance" | "free_chat";
  setChatMode: (mode: "ideas" | "content" | "performance" | "free_chat") => void;
  
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
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
  
  // Chat mode - default to "ideas" (mais comum)
  const [chatMode, setChatMode] = useState<"ideas" | "content" | "performance" | "free_chat">("ideas");
  
  // Workspace data
  const [assignees, setAssignees] = useState<AssigneeItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);

  // Hooks for action handling
  const { detectAction, isDetecting } = useKAIActions();
  const { analyzeCSV, isAnalyzing: isAnalyzingCSV } = useKAICSVAnalysis();
  const { analyzeURL, isAnalyzing: isAnalyzingURL } = useKAIURLAnalysis();
  const { executeAction: executeActionHook, isExecuting } = useKAIExecuteAction();
  
  // Mention parser for @mentions commands
  const { parseMessage, isPlanningCommand } = useKAIMentionParser();

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

  // Panel controls - with message invalidation on open
  const openPanel = useCallback(() => {
    setIsOpen(true);
    // Invalidate messages to ensure we see latest data
    if (conversationId) {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    }
  }, [conversationId, queryClient]);
  
  const closePanel = useCallback(() => setIsOpen(false), []);
  const togglePanel = useCallback(() => {
    setIsOpen(prev => {
      const newValue = !prev;
      // Invalidate messages when opening
      if (newValue && conversationId) {
        queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      }
      return newValue;
    });
  }, [conversationId, queryClient]);

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

  // Execute smart planner for batch card creation
  const executeSmartPlanner = useCallback(async (
    parsedCommand: ParsedCommand,
    clientId: string
  ): Promise<{ success: boolean; payload?: SuccessCardPayload; error?: string }> => {
    if (!workspaceId) {
      return { success: false, error: "Workspace não encontrado" };
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { success: false, error: "Usuário não autenticado" };
    }

    // Use clientId from parsed command if available, otherwise use provided clientId
    let targetClientId = parsedCommand.clientId || clientId;
    
    // If only clientName is available, find the client
    if (!targetClientId && parsedCommand.clientName) {
      const matchedClient = clients.find(c => 
        c.name.toLowerCase().includes(parsedCommand.clientName!.toLowerCase())
      );
      if (matchedClient) {
        targetClientId = matchedClient.id;
      }
    }

    console.log("[GlobalKAI] Executing smart planner:", {
      clientId: targetClientId,
      quantity: parsedCommand.quantity,
      format: parsedCommand.format,
      column: parsedCommand.column,
      dateHint: parsedCommand.dateHint,
      schedulingHint: parsedCommand.schedulingHint,
    });

    try {
      const { data, error } = await supabase.functions.invoke("kai-smart-planner", {
        body: {
          clientId: targetClientId,
          workspaceId,
          userId: userData.user.id,
          quantity: parsedCommand.quantity,
          format: parsedCommand.format,
          column: parsedCommand.column,
          themeHint: parsedCommand.themeHint,
          schedulingHint: parsedCommand.schedulingHint,
          dateHint: parsedCommand.dateHint,
          rawMessage: parsedCommand.rawMessage,
        },
      });

      if (error) {
        console.error("[GlobalKAI] Smart planner error:", error);
        return { success: false, error: error.message };
      }

      if (!data.success) {
        return { success: false, error: data.error || "Erro desconhecido" };
      }

      // Build success payload for ResponseCard
      const payload: SuccessCardPayload = {
        type: "cards_created",
        message: data.message,
        clientName: data.clientName,
        column: data.column,
        format: data.format,
        cards: data.cards || [],
        totalCount: data.cards?.length || 0,
      };

      return { success: true, payload };
    } catch (err) {
      console.error("[GlobalKAI] Smart planner exception:", err);
      return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
    }
  }, [workspaceId, clients]);

  // Insert message directly to database (for executor mode)
  const insertMessage = useCallback(async (
    role: "user" | "assistant",
    content: string,
    payload?: Record<string, unknown>
  ) => {
    if (!conversationId) return;

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role,
      content,
      // Note: payload is not in the messages table schema, so we include key info in content
    } as any);

    // Invalidate messages to refresh UI
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
  }, [conversationId, queryClient]);

  // Wrapped send message that handles action detection + delegates to useClientChat
  const sendMessage = useCallback(async (text: string, files?: File[], citations?: Citation[]) => {
    if (!text.trim() && (!files || files.length === 0)) return;
    
    // Guard: ensure client is selected
    if (!selectedClientId) {
      toast.error("Selecione um cliente antes de enviar mensagem");
      return;
    }
    
    // Guard: wait for conversation to be ready (with timeout)
    let attempts = 0;
    const maxAttempts = 10;
    while (!conversationId && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }
    
    if (!conversationId) {
      toast.error("Chat não está pronto. Tente novamente.");
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

    // ============================================
    // Check for planning commands with @mentions (legacy/fallback)
    // These are auto-executed without confirmation
    // ============================================
    if (isPlanningCommand(text)) {
      console.log("[GlobalKAI] Detected planning command, parsing @mentions...");
      const parsedCommand = parseMessage(text, clients);
      console.log("[GlobalKAI] Parsed command:", parsedCommand);

      // If it's a valid card creation command, auto-execute
      if (parsedCommand.autoExecute && SAFE_AUTO_EXECUTE_ACTIONS.includes(parsedCommand.action)) {
        setActionStatus("executing");

        // Add user message to chat first
        await clientChatSendMessage(text, undefined, "fast", "free_chat", citations);

        // Execute smart planner
        const result = await executeSmartPlanner(parsedCommand, selectedClientId);

        if (result.success && result.payload) {
          // Invalidate planning items to refresh the board
          queryClient.invalidateQueries({ queryKey: ["planning-items"] });

          toast.success(`${result.payload.totalCount} cards criados com sucesso!`, {
            action: {
              label: "Ver Planejamento",
              onClick: () => navigate(`?client=${selectedClientId}&tab=planning`),
            },
          });

          setActionStatus("completed");
          setTimeout(() => setActionStatus("idle"), 1500);
        } else {
          toast.error(result.error || "Erro ao criar cards");
          setActionStatus("idle");
        }

        setAttachedFiles([]);
        return;
      }
    }

    // ============================================
    // Standard flow for other messages (chat mode)
    // ============================================
    setActionStatus("detecting");

    // Set a timeout to reset loading state if things take too long (90 seconds)
    const timeoutId = setTimeout(() => {
      console.warn("[GlobalKAI] Request timeout - resetting state");
      setActionStatus("idle");
      toast.error("A resposta demorou muito. Tente novamente.");
    }, 90000);

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
          clearTimeout(timeoutId);
          setPendingAction(preparedAction);
          setActionStatus("confirming");
          return; // Wait for user confirmation
        }
      }

      // Step 3: For general chat or non-confirmation actions, route intelligently
      setActionStatus("idle");
      setAttachedFiles([]);
      
      // Upload image files to storage and get signed URLs
      let imageUrls: string[] = [];
      const imageAttachments = allAttachments.filter(f => f.type.startsWith("image/"));
      
      if (imageAttachments.length > 0) {
        console.log("[GlobalKAI] Uploading", imageAttachments.length, "images to storage");
        try {
          const uploadPromises = imageAttachments.map(async (attachment) => {
            const { signedUrl, error } = await uploadAndGetSignedUrl(attachment.file, "chat-images");
            if (error) {
              console.error("[GlobalKAI] Image upload error:", error);
              return null;
            }
            return signedUrl;
          });
          
          const results = await Promise.all(uploadPromises);
          imageUrls = results.filter((url): url is string => url !== null);
          console.log("[GlobalKAI] Uploaded images, got", imageUrls.length, "URLs");
        } catch (uploadError) {
          console.error("[GlobalKAI] Error uploading images:", uploadError);
          toast.error("Erro ao enviar imagens. Tente novamente.");
        }
      }
      
      // ============================================
      // PERFORMANCE MODE: Call kai-metrics-agent directly
      // ============================================
      if (chatMode === "performance") {
        console.log("[GlobalKAI] Performance mode - calling kai-metrics-agent");
        setActionStatus("executing");
        
        // Insert user message first
        await insertMessage("user", text);
        
        try {
          const response = await supabase.functions.invoke("kai-metrics-agent", {
            body: {
              clientId: selectedClientId,
              question: text,
            },
          });
          
          if (response.error) {
            throw new Error(response.error.message);
          }
          
          // Stream response handling
          const reader = response.data?.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder();
            let fullContent = "";
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              fullContent += decoder.decode(value, { stream: true });
            }
            
            // Insert assistant response
            await insertMessage("assistant", fullContent);
          } else if (typeof response.data === "string") {
            await insertMessage("assistant", response.data);
          } else {
            await insertMessage("assistant", response.data?.content || "Não foi possível analisar as métricas.");
          }
          
          setActionStatus("idle");
          clearTimeout(timeoutId);
          setAttachedFiles([]);
          return;
        } catch (perfError) {
          console.error("[GlobalKAI] Performance analysis error:", perfError);
          await insertMessage("assistant", `❌ Erro ao analisar métricas: ${perfError instanceof Error ? perfError.message : "Erro desconhecido"}`);
          setActionStatus("idle");
          clearTimeout(timeoutId);
          return;
        }
      }
      
      // Determine explicitMode - chatMode takes precedence over router
      // If user explicitly selected "content" mode, always use content pipeline
      let explicitMode: "content" | "ideas" | "free_chat" | "image" = 
        chatMode === "content" ? "content" : 
        chatMode === "ideas" ? "ideas" : "free_chat";
      
      // Only use router when in free_chat mode to potentially upgrade to content
      if (chatMode === "free_chat") {
        try {
          const { data: routerDecision, error: routerError } = await supabase.functions.invoke("kai-router", {
            body: {
              message: text,
              clientId: selectedClientId,
              hasFiles: allAttachments.length > 0,
              fileTypes: allAttachments.map(f => f.type),
            },
          });
          
          if (!routerError && routerDecision) {
            console.log("[GlobalKAI] Router decision:", routerDecision);
            
            // Map pipeline to explicitMode
            if (routerDecision.pipeline === "multi_agent_content") {
              explicitMode = "content";
            }
          }
        } catch (routerErr) {
          console.warn("[GlobalKAI] Router error, using default chatMode:", routerErr);
        }
      }
      
      console.log("[GlobalKAI] Final explicitMode:", explicitMode, "chatMode:", chatMode);
      
      // Pass image URLs to chat - this enables multimodal AI analysis
      await clientChatSendMessage(text, imageUrls.length > 0 ? imageUrls : undefined, "fast", explicitMode, citations);
      clearTimeout(timeoutId);

    } catch (error) {
      clearTimeout(timeoutId);
      console.error("kAI chat error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao processar mensagem");
      setActionStatus("idle");
    }
  }, [selectedClientId, attachedFiles, detectAction, prepareAction, clientChatSendMessage, chatMode, conversationId, isPlanningCommand, parseMessage, clients, executeSmartPlanner, queryClient, navigate, insertMessage]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    clientChatClearConversation();
    setPendingAction(null);
    setActionStatus("idle");
  }, [clientChatClearConversation]);

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
