import { useGlobalKAI } from "@/contexts/GlobalKAIContext";
import { useClients } from "@/hooks/useClients";
import { FloatingKAIButton } from "./FloatingKAIButton";
import { GlobalKAIPanel } from "./GlobalKAIPanel";
import { GlobalKAIChat } from "./GlobalKAIChat";
import { GlobalKAIInput } from "./GlobalKAIInput";
import { ActionConfirmationDialog } from "./ActionConfirmationDialog";
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
  } = useGlobalKAI();

  const { clients } = useClients();

  // Get selected client name
  const selectedClientName = useMemo(() => {
    if (!selectedClientId || !clients) return undefined;
    const client = clients.find(c => c.id === selectedClientId);
    return client?.name;
  }, [selectedClientId, clients]);

  // Handler for sending messages from within chat (for regenerate, etc.)
  const handleSendFromChat = useCallback((content: string, images?: string[], quality?: "fast" | "high") => {
    // For now, just send the text message
    sendMessage(content);
  }, [sendMessage]);

  return (
    <>
      {/* Floating button - always visible */}
      <FloatingKAIButton
        isOpen={isOpen}
        onClick={togglePanel}
        hasNotifications={false}
        notificationCount={0}
      />

      {/* Slide-in panel */}
      <GlobalKAIPanel isOpen={isOpen} onClose={closePanel}>
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
        />

        {/* Input area */}
        <GlobalKAIInput
          onSend={sendMessage}
          isProcessing={isProcessing}
          attachedFiles={attachedFiles}
          onAttachFiles={attachFiles}
          onRemoveFile={removeFile}
          placeholder="Pergunte ao kAI..."
        />
      </GlobalKAIPanel>

      {/* Action Confirmation Dialog */}
      <ActionConfirmationDialog
        pendingAction={pendingAction}
        onConfirm={confirmAction}
        onCancel={cancelAction}
      />
    </>
  );
}
