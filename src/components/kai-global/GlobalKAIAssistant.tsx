import { useGlobalKAI } from "@/hooks/useGlobalKAI";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
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

  return (
    <>
      {/* Floating button */}
      <FloatingKAIButton
        isOpen={isOpen}
        onClick={togglePanel}
        hasNotifications={false}
        notificationCount={0}
      />

      {/* Simplified slide-in panel */}
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

      {/* Action Confirmation Dialog */}
      {canUseAssistant && (
        <ActionConfirmationDialog
          pendingAction={pendingAction}
          onConfirm={confirmAction}
          onCancel={cancelAction}
        />
      )}
    </>
  );
}
