import { useGlobalKAI } from "@/hooks/useGlobalKAI";
import { useClients } from "@/hooks/useClients";
import { FloatingKAIButton } from "./FloatingKAIButton";
import { GlobalKAIPanel } from "./GlobalKAIPanel";
import { GlobalKAIChat } from "./GlobalKAIChat";
import { GlobalKAIInput } from "./GlobalKAIInput";
import { ActionConfirmationDialog } from "./ActionConfirmationDialog";
import { useMemo, useCallback } from "react";
import { Citation } from "@/components/chat/CitationChip";

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
    pendingAction,
    currentStep,
    multiAgentStep,
    multiAgentDetails,
    sendMessage,
    attachFiles,
    removeFile,
    confirmAction,
    cancelAction,
    contentLibrary,
    referenceLibrary,
    assignees,
    clients: workspaceClients,
    chatMode,
    setChatMode,
  } = useGlobalKAI();

  const { clients: clientsData } = useClients();

  // Get selected client name
  const selectedClientName = useMemo(() => {
    if (!selectedClientId || !clientsData) return undefined;
    const client = clientsData.find(c => c.id === selectedClientId);
    return client?.name;
  }, [selectedClientId, clientsData]);

  // Handler for sending messages from within chat (for regenerate, quick suggestions)
  const handleSendFromChat = useCallback((content: string, images?: string[], quality?: "fast" | "high") => {
    sendMessage(content);
  }, [sendMessage]);

  // Handler for sending messages with citations
  const handleSendWithCitations = useCallback(async (message: string, files?: File[], citations?: Citation[]) => {
    await sendMessage(message, files, citations);
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
      <GlobalKAIPanel 
        isOpen={isOpen} 
        onClose={closePanel}
        selectedClientId={selectedClientId}
        selectedClientName={selectedClientName}
        clients={workspaceClients}
        onClientChange={setSelectedClientId}
        chatMode={chatMode}
      >
        {/* Chat messages with multi-agent progress */}
        <GlobalKAIChat
          messages={messages}
          isProcessing={isProcessing}
          selectedClientId={selectedClientId}
          selectedClientName={selectedClientName}
          actionStatus={actionStatus}
          currentStep={currentStep}
          multiAgentStep={multiAgentStep}
          multiAgentDetails={multiAgentDetails}
          onSendMessage={handleSendFromChat}
          chatMode={chatMode}
        />

        {/* Input area with @ mentions support and mode selector */}
        <GlobalKAIInput
          onSend={handleSendWithCitations}
          isProcessing={isProcessing}
          attachedFiles={attachedFiles}
          onAttachFiles={attachFiles}
          onRemoveFile={removeFile}
          placeholder="Pergunte ao kAI... (@ para mencionar)"
          contentLibrary={contentLibrary}
          referenceLibrary={referenceLibrary}
          assignees={assignees}
          clients={workspaceClients}
          chatMode={chatMode}
          onChatModeChange={setChatMode}
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
