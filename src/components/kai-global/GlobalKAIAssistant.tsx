import { useGlobalKAI } from "@/contexts/GlobalKAIContext";
import { FloatingKAIButton } from "./FloatingKAIButton";
import { GlobalKAIPanel } from "./GlobalKAIPanel";
import { GlobalKAIChat } from "./GlobalKAIChat";
import { GlobalKAIInput } from "./GlobalKAIInput";
import { KAIQuickSuggestion } from "@/types/kaiActions";

export function GlobalKAIAssistant() {
  const {
    isOpen,
    togglePanel,
    closePanel,
    messages,
    isProcessing,
    selectedClientId,
    attachedFiles,
    sendMessage,
    attachFiles,
    removeFile,
  } = useGlobalKAI();

  const handleSuggestionClick = (suggestion: KAIQuickSuggestion) => {
    // Pre-fill the suggestion prompt - user can modify before sending
    sendMessage(suggestion.prompt);
  };

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
          onSuggestionClick={handleSuggestionClick}
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
    </>
  );
}
