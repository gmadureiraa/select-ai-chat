import { useRef, useEffect, useCallback, useState } from "react";
import { Trash2, PanelLeft, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useClientChat } from "@/hooks/useClientChat";
import { FloatingInput, ChatMode } from "@/components/chat/FloatingInput";
import { Citation } from "@/components/chat/CitationChip";
import { EnhancedMessageBubble } from "@/components/chat/EnhancedMessageBubble";
import { MinimalProgress } from "@/components/chat/MinimalProgress";
import { QuickSuggestions } from "@/components/chat/QuickSuggestions";
import { ChatOptionsSidebar } from "@/components/assistant/ChatOptionsSidebar";
import { Client } from "@/hooks/useClients";
import KaleidosLogo from "@/assets/kaleidos-logo.svg";
import { cn } from "@/lib/utils";

interface KaiAssistantTabProps {
  clientId: string;
  client: Client;
}

export const KaiAssistantTab = ({ clientId, client }: KaiAssistantTabProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);

  const {
    messages,
    isLoading,
    sendMessage,
    clearConversation,
    conversationId,
    currentStep,
    multiAgentStep,
    contentLibrary,
    referenceLibrary,
    setConversationId,
    templateName,
  } = useClientChat(clientId, activeTemplateId || undefined, activeConversationId);

  // Scroll to bottom function
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: smooth ? "smooth" : "auto",
        block: "end" 
      });
    }
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom(true);
  }, [messages, scrollToBottom]);

  // Initial scroll on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [scrollToBottom]);

  const handleSend = async (content: string, images?: string[], quality?: "fast" | "high", mode?: ChatMode, citations?: Citation[]) => {
    if (!content.trim() && (!images || images.length === 0)) return;
    await sendMessage(content, images, quality, mode, citations);
  };

  const handleClearConversation = async () => {
    await clearConversation();
  };

  const handleSelectTemplate = (templateId: string | null, name?: string) => {
    setActiveTemplateId(templateId);
    setActiveConversationId(undefined); // Reset conversation when switching templates
  };

  const handleSelectConversation = (convId: string) => {
    setActiveConversationId(convId);
    setActiveTemplateId(null); // Clear template when selecting specific conversation
  };

  // Determine template type for input placeholder
  const getTemplateType = (): "content" | "image" | "free_chat" => {
    if (!templateName) return "free_chat";
    const lower = templateName.toLowerCase();
    if (lower.includes("imagem") || lower.includes("image") || lower.includes("visual")) {
      return "image";
    }
    return "content";
  };

  return (
    <div className="flex h-[calc(100vh-140px)] relative">
      {/* Sidebar */}
      {showSidebar && (
        <ChatOptionsSidebar
          clientId={clientId}
          currentConversationId={conversationId}
          onSelectTemplate={handleSelectTemplate}
          onSelectConversation={handleSelectConversation}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/50">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSidebar(!showSidebar)}
            className="text-muted-foreground h-7 px-2"
          >
            {showSidebar ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </Button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground/80 truncate">
              {templateName || "Chat Livre"}
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className="text-xs text-muted-foreground truncate">{client.name}</span>
          </div>

          {conversationId && messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearConversation}
              className="text-muted-foreground hover:text-destructive h-7 px-2 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Limpar</span>
            </Button>
          )}
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
          <div className="min-h-full flex flex-col">
            {messages.length === 0 ? (
              /* Empty State - Centered, Minimal */
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-5">
                  <img src={KaleidosLogo} alt="kAI" className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-semibold mb-1.5 text-center text-foreground/90">
                  {templateName ? `Template: ${templateName}` : "Como posso ajudar?"}
                </h2>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                  {templateName 
                    ? `Gere conteúdo usando o template "${templateName}" para ${client.name}.`
                    : `Converse sobre ${client.name}, analise dados ou explore ideias. Use @ para selecionar formatos.`
                  }
                </p>
                
                {/* Quick Suggestions */}
                <QuickSuggestions 
                  onSelect={(suggestion) => handleSend(suggestion)}
                  clientId={clientId}
                  clientName={client.name}
                  isContentTemplate={getTemplateType() === "content"}
                />
              </div>
            ) : (
              <div className="space-y-2 px-4 py-8 max-w-3xl mx-auto w-full">
                {messages.map((message, index) => (
                  <EnhancedMessageBubble
                    key={message.id}
                    role={message.role as "user" | "assistant"}
                    content={message.content}
                    imageUrls={message.image_urls}
                    payload={(message as any).payload}
                    clientId={clientId}
                    clientName={client.name}
                    onRegenerate={index === messages.length - 1 && message.role === "assistant" ? () => {} : undefined}
                    isLastMessage={index === messages.length - 1}
                    onSendMessage={handleSend}
                  />
                ))}

                {isLoading && (
                  <MinimalProgress 
                    currentStep={currentStep}
                    multiAgentStep={multiAgentStep}
                  />
                )}
                
                {/* Scroll anchor */}
                <div ref={messagesEndRef} className="h-1" />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Floating Input - Bottom */}
        <div className="border-t border-border/10 bg-background/60 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto">
            <FloatingInput
              onSend={handleSend}
              disabled={isLoading}
              templateType={getTemplateType()}
              placeholder={
                templateName 
                  ? `Descreva o que deseja criar com "${templateName}"...`
                  : "Pergunte sobre o cliente... Use @ para formatos"
              }
              contentLibrary={contentLibrary || []}
              referenceLibrary={referenceLibrary || []}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
