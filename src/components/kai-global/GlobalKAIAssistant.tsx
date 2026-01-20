import { useGlobalKAI } from "@/hooks/useGlobalKAI";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";
import { FloatingKAIButton } from "./FloatingKAIButton";
import { GlobalKAIPanel } from "./GlobalKAIPanel";
import { GlobalKAIChat } from "./GlobalKAIChat";
import { GlobalKAIInputMinimal } from "./GlobalKAIInputMinimal";
import { ActionConfirmationDialog } from "./ActionConfirmationDialog";
import { ViewerBlockedPanel } from "./ViewerBlockedPanel";
import { useMemo, useCallback } from "react";

export function GlobalKAIAssistant() {
  const {
    isOpen,
    togglePanel,
    closePanel,
    messages,
    isProcessing,
    selectedClientId,
    actionStatus,
    attachedFiles,
    pendingAction,
    currentStep,
    multiAgentStep,
    sendMessage,
    attachFiles,
    removeFile,
    confirmAction,
    cancelAction,
    chatMode,
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

  // Handler for sending messages from within chat
  const handleSendFromChat = useCallback((content: string) => {
    sendMessage(content);
  }, [sendMessage]);

  // Simple handler for minimal input
  const handleSend = useCallback(async (message: string, files?: File[]) => {
    await sendMessage(message, files);
  }, [sendMessage]);

  // Handle button click - show upgrade prompt for Canvas users
  const handleButtonClick = useCallback(() => {
    if (!canAccessKaiChat && isCanvas) {
      showUpgradePrompt("kai_chat_locked");
      return;
    }
    togglePanel();
  }, [canAccessKaiChat, isCanvas, showUpgradePrompt, togglePanel]);

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
                chatMode={chatMode}
                onSuggestionClick={handleSendFromChat}
              />

              {/* Minimal input: just attach + text + send */}
              <GlobalKAIInputMinimal
                onSend={handleSend}
                isProcessing={isProcessing}
                attachedFiles={attachedFiles}
                onAttachFiles={attachFiles}
                onRemoveFile={removeFile}
                placeholder="Pergunte qualquer coisa..."
              />
            </>
          ) : (
            <ViewerBlockedPanel onClose={closePanel} />
          )}
        </GlobalKAIPanel>
      )}

      {/* Action Confirmation Dialog */}
      {canUseAssistant && canAccessKaiChat && (
        <ActionConfirmationDialog
          pendingAction={pendingAction}
          onConfirm={confirmAction}
          onCancel={cancelAction}
        />
      )}
    </>
  );
}
