import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles, MessageSquare, Trash2, PanelLeftClose, PanelLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useClientTemplates } from "@/hooks/useClientTemplates";
import { useClientChat } from "@/hooks/useClientChat";
import { FloatingInput, ChatMode } from "@/components/chat/FloatingInput";
import { EnhancedMessageBubble } from "@/components/chat/EnhancedMessageBubble";
import { AdvancedProgress } from "@/components/chat/AdvancedProgress";
import { QuickSuggestions } from "@/components/chat/QuickSuggestions";
import { TemplateManager } from "@/components/clients/TemplateManager";
import { Client } from "@/hooks/useClients";
import { cn } from "@/lib/utils";
import KaleidosLogo from "@/assets/kaleidos-logo.svg";

interface KaiAssistantTabProps {
  clientId: string;
  client: Client;
}

export const KaiAssistantTab = ({ clientId, client }: KaiAssistantTabProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    searchParams.get("template")
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { templates } = useClientTemplates(clientId);
  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);

  const {
    messages,
    isLoading,
    sendMessage,
    clearConversation,
    conversationId,
    currentStep,
    multiAgentStep,
    multiAgentDetails,
  } = useClientChat(clientId, selectedTemplateId || undefined);

  // Update URL when template changes
  useEffect(() => {
    if (selectedTemplateId) {
      setSearchParams(prev => {
        prev.set("template", selectedTemplateId);
        return prev;
      });
    } else {
      setSearchParams(prev => {
        prev.delete("template");
        return prev;
      });
    }
  }, [selectedTemplateId, setSearchParams]);

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

  // Initial scroll on mount/template change
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      scrollToBottom(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedTemplateId, scrollToBottom]);

  const handleSend = async (content: string, images?: string[], quality?: "fast" | "high", mode?: ChatMode) => {
    if (!content.trim() && (!images || images.length === 0)) return;
    await sendMessage(content, images, quality, mode);
  };

  const handleClearConversation = async () => {
    await clearConversation();
  };

  const chatTemplates = templates?.filter(t => t.type === "chat") || [];
  const imageTemplates = templates?.filter(t => t.type === "image") || [];

  const templateType = selectedTemplate ? "content" : "free_chat";

  return (
    <div className="flex h-[calc(100vh-140px)] relative">
      {/* Collapsible Sidebar - Templates */}
      <div
        className={cn(
          "shrink-0 flex flex-col border-r border-border/30 bg-card/30 transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-56"
        )}
      >
        <div className="p-3 border-b border-border/30 flex items-center justify-between gap-2">
          <h3 className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Templates</h3>
          <div className="flex items-center gap-1">
            <TemplateManager clientId={clientId} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(true)}
              className="h-7 w-7 hover:bg-muted/50"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {/* Free Chat Option */}
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-sm h-9 px-3 rounded-lg",
                !selectedTemplateId 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
              )}
              onClick={() => setSelectedTemplateId(null)}
            >
              <MessageSquare className="h-4 w-4 mr-2.5 shrink-0" />
              <span className="truncate">Chat Livre</span>
            </Button>

            {/* Content Templates */}
            {chatTemplates.length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] text-muted-foreground/50 px-3 py-1.5 font-medium uppercase tracking-wider">
                  Conteúdo
                </p>
                {chatTemplates.map((template) => (
                  <Button
                    key={template.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-sm h-9 px-3 rounded-lg",
                      selectedTemplateId === template.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                    )}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <Sparkles className="h-4 w-4 mr-2.5 shrink-0" />
                    <span className="truncate">{template.name}</span>
                  </Button>
                ))}
              </div>
            )}

            {/* Image Templates */}
            {imageTemplates.length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] text-muted-foreground/50 px-3 py-1.5 font-medium uppercase tracking-wider">
                  Imagens
                </p>
                {imageTemplates.map((template) => (
                  <Button
                    key={template.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-sm h-9 px-3 rounded-lg",
                      selectedTemplateId === template.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                    )}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <Sparkles className="h-4 w-4 mr-2.5 shrink-0" />
                    <span className="truncate">{template.name}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/50">
        {/* Collapsed Sidebar Toggle + Context Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20">
          {sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(false)}
              className="h-8 w-8 hover:bg-muted/50"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground/80 truncate">
              {selectedTemplate?.name || "Chat Livre"}
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
                  {selectedTemplate ? `${selectedTemplate.name}` : "Como posso ajudar?"}
                </h2>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                  {selectedTemplate
                    ? `Gere conteúdo otimizado para ${client.name}`
                    : `Converse sobre ${client.name}, analise dados ou explore ideias`
                  }
                </p>
                
                {/* Quick Suggestions */}
                <QuickSuggestions 
                  onSelect={(suggestion) => handleSend(suggestion)}
                  clientName={client.name}
                  isContentTemplate={!!selectedTemplate}
                />
              </div>
            ) : (
              <div className="space-y-4 px-4 py-4 max-w-3xl mx-auto w-full">
                {messages.map((message) => (
                  <EnhancedMessageBubble
                    key={message.id}
                    role={message.role as "user" | "assistant"}
                    content={message.content}
                    imageUrls={message.image_urls}
                    clientId={clientId}
                    clientName={client.name}
                  />
                ))}

                {isLoading && (
                  <AdvancedProgress 
                    currentStep={currentStep}
                    multiAgentStep={multiAgentStep}
                    multiAgentDetails={multiAgentDetails}
                  />
                )}
                
                {/* Scroll anchor */}
                <div ref={messagesEndRef} className="h-1" />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Floating Input - Bottom */}
        <div className="border-t border-border/20 bg-background/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto">
            <FloatingInput
              onSend={handleSend}
              disabled={isLoading}
              templateType={templateType}
              placeholder={selectedTemplate ? `Criar ${selectedTemplate.name}...` : "Pergunte sobre o cliente..."}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
