import { useGlobalKAI } from "@/hooks/useGlobalKAI";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { FloatingKAIButton } from "./FloatingKAIButton";
// Panel/Chat/Input só são renderizados quando o assistente é aberto.
// Lazy-load tira ~1100 linhas (com mentions/markdown/citations) do bundle inicial.
import { Suspense, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type { SimpleCitation } from "@/hooks/useKAISimpleChat";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const GlobalKAIPanel = lazyWithRetry(() =>
  import("./GlobalKAIPanel").then((m) => ({ default: m.GlobalKAIPanel })),
);
const GlobalKAIChat = lazyWithRetry(() =>
  import("./GlobalKAIChat").then((m) => ({ default: m.GlobalKAIChat })),
);
const GlobalKAIInputMinimal = lazyWithRetry(() =>
  import("./GlobalKAIInputMinimal").then((m) => ({ default: m.GlobalKAIInputMinimal })),
);

/**
 * GlobalKAIAssistant - Sistema interno Kaleidos
 * 
 * Bloqueio baseado em role (viewer não pode usar) em vez de plano.
 */
export function GlobalKAIAssistant() {
  const {
    isOpen,
    togglePanel,
    closePanel,
    messages,
    isProcessing,
    selectedClientId,
    setSelectedClientId,
    actionStatus,
    attachedFiles,
    currentStep,
    multiAgentStep,
    sendMessage,
    clearConversation,
    cancelRequest,
    attachFiles,
    removeFile,
    chatMode,
    contentLibrary,
    referenceLibrary,
    clients,
    // Conversation management
    conversations,
    activeConversationId,
    setActiveConversationId,
    startNewConversation,
    deleteConversation,
  } = useGlobalKAI();

  const { clients: clientsData } = useClients();
  const { canUseAssistant, isViewer } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get selected client name
  const selectedClientName = useMemo(() => {
    if (!selectedClientId || !clientsData) return undefined;
    const client = clientsData.find(c => c.id === selectedClientId);
    return client?.name;
  }, [selectedClientId, clientsData]);

  // Merge clients from context and hook
  const allClients = useMemo(() => {
    if (clients && clients.length > 0) {
      return clients;
    }
    return clientsData?.map(c => ({
      id: c.id,
      name: c.name,
      avatar_url: c.avatar_url || undefined,
    })) || [];
  }, [clients, clientsData]);

  // Handler for sending messages from within chat
  const handleSendFromChat = useCallback((content: string) => {
    sendMessage(content);
  }, [sendMessage]);

  // Handler for retry after error
  const handleRetryMessage = useCallback((content: string) => {
    sendMessage(content);
  }, [sendMessage]);

  // Handler for minimal input with citations
  const handleSend = useCallback(async (
    message: string, 
    files?: File[], 
    citations?: SimpleCitation[]
  ) => {
    await sendMessage(message, files, citations);
  }, [sendMessage]);

  // Handler for cancel/stop
  const handleCancel = useCallback(() => {
    cancelRequest?.();
  }, [cancelRequest]);

  // Handle button click - show permission message for viewers
  const handleButtonClick = useCallback(() => {
    if (!canUseAssistant) {
      toast.info("Você não tem permissão para usar o assistente.");
      return;
    }
    togglePanel();
  }, [canUseAssistant, togglePanel]);

  // Handle client change
  //
  // 2026-05-18 — Picker de cliente no header do chat (Onda 13).
  // Não basta atualizar o state local do GlobalKAIContext: o resto da app
  // (KaiSidebar, planning, library, etc.) lê o cliente ativo do query param
  // ?client=<id>. Atualizar a URL faz o sync via o useEffect já existente
  // no GlobalKAIContext (linha ~237) e propaga pra todos os consumidores
  // sem precisar fechar o chat.
  const handleClientChange = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
    const params = new URLSearchParams(searchParams);
    params.set("client", clientId);
    setSearchParams(params, { replace: false });
  }, [setSelectedClientId, searchParams, setSearchParams]);

  // Handle conversation selection
  const handleSelectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
  }, [setActiveConversationId]);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    startNewConversation();
  }, [startNewConversation]);

  // Viewers não veem o botão flutuante
  if (isViewer) {
    return null;
  }

  return (
    <>
      {/* Floating button - apenas para quem pode usar */}
      {canUseAssistant && (
        <FloatingKAIButton
          isOpen={isOpen}
          onClick={handleButtonClick}
          hasNotifications={false}
          notificationCount={0}
        />
      )}

      {/* Slide-in panel - apenas para quem pode usar.
          Só monta o panel/chat/input quando o user abriu o assistente pelo
          menos uma vez (isOpen) — economiza ~1100 linhas no bundle inicial. */}
      {canUseAssistant && isOpen && (
        <Suspense fallback={null}>
          <GlobalKAIPanel
            isOpen={isOpen}
            onClose={closePanel}
            selectedClientId={selectedClientId}
            selectedClientName={selectedClientName}
            clients={allClients}
            onClientChange={handleClientChange}
            onClearConversation={clearConversation}
            messages={messages}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onDeleteConversation={deleteConversation}
          >
            {/* Chat messages */}
            <GlobalKAIChat
              messages={messages}
              isProcessing={isProcessing}
              selectedClientId={selectedClientId}
              selectedClientName={selectedClientName}
              actionStatus={actionStatus}
              currentStep={currentStep}
              multiAgentStep={multiAgentStep}
              onSendMessage={handleSendFromChat}
              onRetryMessage={handleRetryMessage}
              chatMode={chatMode}
              onSuggestionClick={handleSendFromChat}
            />

            {/* Input with @ mentions and stop button */}
            <GlobalKAIInputMinimal
              onSend={handleSend}
              isProcessing={isProcessing}
              attachedFiles={attachedFiles}
              onAttachFiles={attachFiles}
              onRemoveFile={removeFile}
              onCancel={handleCancel}
              placeholder="Pergunte qualquer coisa... Use @ para citar"
              clientId={selectedClientId || undefined}
              contentLibrary={contentLibrary}
              referenceLibrary={referenceLibrary}
            />
          </GlobalKAIPanel>
        </Suspense>
      )}
    </>
  );
}
