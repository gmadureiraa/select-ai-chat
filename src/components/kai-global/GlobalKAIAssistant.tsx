import { useGlobalKAI } from "@/hooks/useGlobalKAI";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";
import { FloatingKAIButton } from "./FloatingKAIButton";
import { GlobalKAIPanel } from "./GlobalKAIPanel";
import { GlobalKAIChat } from "./GlobalKAIChat";
import { GlobalKAIInputMinimal } from "./GlobalKAIInputMinimal";
import { ViewerBlockedPanel } from "./ViewerBlockedPanel";
import { useMemo, useCallback } from "react";
import type { SimpleCitation } from "@/hooks/useKAISimpleChat";

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
  const { canUseAssistant } = useWorkspace();
  const { canAccessKaiChat, isCanvas } = usePlanFeatures();
  const { showUpgradePrompt } = useUpgradePrompt();

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

  // Handle button click - show upgrade prompt for Canvas users
  const handleButtonClick = useCallback(() => {
    if (!canAccessKaiChat && isCanvas) {
      showUpgradePrompt("kai_chat_locked");
      return;
    }
    togglePanel();
  }, [canAccessKaiChat, isCanvas, showUpgradePrompt, togglePanel]);

  // Handle client change
  const handleClientChange = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
  }, [setSelectedClientId]);

  // Handle conversation selection
  const handleSelectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
  }, [setActiveConversationId]);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    startNewConversation();
  }, [startNewConversation]);

  // Don't render the floating button if user can't use assistant at all (viewer)
  // But DO render it for Canvas users (locked state with upgrade prompt)
  const shouldShowButton = canUseAssistant || isCanvas;

  return (
    <>
      {/* Floating button - show for Pro users and Canvas users (locked) */}
      {shouldShowButton && (
        <FloatingKAIButton
          isOpen={isOpen}
          onClick={handleButtonClick}
          hasNotifications={false}
          notificationCount={0}
        />
      )}

      {/* Simplified slide-in panel - only for Pro users */}
      {canAccessKaiChat && (
        <GlobalKAIPanel 
          isOpen={isOpen} 
          onClose={closePanel}
          selectedClientId={selectedClientId}
          selectedClientName={selectedClientName}
          clients={allClients}
          onClientChange={handleClientChange}
          onClearConversation={clearConversation}
          messages={messages}
          // Conversation management props
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={deleteConversation}
        >
          {canUseAssistant ? (
            <>
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
            </>
          ) : (
            <ViewerBlockedPanel onClose={closePanel} />
          )}
        </GlobalKAIPanel>
      )}
    </>
  );
}
