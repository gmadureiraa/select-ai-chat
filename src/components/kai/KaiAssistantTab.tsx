import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { useClientTemplates } from "@/hooks/useClientTemplates";
import { useClientChat } from "@/hooks/useClientChat";
import { ChatInput } from "@/components/ChatInput";
import { EnhancedMessageBubble } from "@/components/chat/EnhancedMessageBubble";
import { AdvancedProgress } from "@/components/chat/AdvancedProgress";
import { Client } from "@/hooks/useClients";
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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (content: string, images?: string[], quality?: "fast" | "high", mode?: "content" | "ideas" | "free_chat") => {
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
    <div className="flex gap-5 h-[calc(100vh-140px)]">
      {/* Sidebar - Templates */}
      <Card className="w-64 shrink-0 flex flex-col border-border/50 bg-card/50">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-semibold text-sm text-foreground/90">Templates</h3>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {/* Free Chat Option */}
            <Button
              variant={!selectedTemplateId ? "secondary" : "ghost"}
              className={`w-full justify-start text-sm h-10 px-3 ${!selectedTemplateId ? 'bg-primary/15 text-primary hover:bg-primary/20 border border-primary/20' : 'hover:bg-muted/50'}`}
              onClick={() => setSelectedTemplateId(null)}
            >
              <MessageSquare className="h-4 w-4 mr-3" />
              Chat Livre
            </Button>

            {/* Content Templates */}
            {chatTemplates.length > 0 && (
              <div className="pt-3">
                <p className="text-xs text-muted-foreground/70 px-3 py-2 font-medium uppercase tracking-wider">Conteúdo</p>
                {chatTemplates.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedTemplateId === template.id ? "secondary" : "ghost"}
                    className={`w-full justify-start text-sm h-10 px-3 ${selectedTemplateId === template.id ? 'bg-primary/15 text-primary hover:bg-primary/20 border border-primary/20' : 'hover:bg-muted/50'}`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <Sparkles className="h-4 w-4 mr-3" />
                    <span className="truncate">{template.name}</span>
                  </Button>
                ))}
              </div>
            )}

            {/* Image Templates */}
            {imageTemplates.length > 0 && (
              <div className="pt-3">
                <p className="text-xs text-muted-foreground/70 px-3 py-2 font-medium uppercase tracking-wider">Imagens</p>
                {imageTemplates.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedTemplateId === template.id ? "secondary" : "ghost"}
                    className={`w-full justify-start text-sm h-10 px-3 ${selectedTemplateId === template.id ? 'bg-primary/15 text-primary hover:bg-primary/20 border border-primary/20' : 'hover:bg-muted/50'}`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <Sparkles className="h-4 w-4 mr-3" />
                    <span className="truncate">{template.name}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col border-border/50 bg-card/30 overflow-hidden">
        {/* Messages Area */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="p-6 min-h-full">
            {messages.length === 0 ? (
              /* Empty State - Manus/Gemini Style */
              <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mb-6">
                  <img src={KaleidosLogo} alt="kAI" className="h-10 w-10" />
                </div>
                <h2 className="text-2xl font-semibold mb-2 text-center">
                  {selectedTemplate ? `Criar ${selectedTemplate.name}` : "O que posso fazer por você?"}
                </h2>
                <p className="text-muted-foreground text-center max-w-md mb-8">
                  {selectedTemplate
                    ? `Gere conteúdo de ${selectedTemplate.name} otimizado para ${client.name}`
                    : `Converse sobre ${client.name}, analise dados, explore ideias`
                  }
                </p>
                
                {/* Quick Suggestions - Manus Style */}
                {!selectedTemplate && (
                  <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                    {[
                      "Métricas da semana",
                      "Análise de engajamento",
                      "Sugestões de conteúdo",
                      "Comparar performance"
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        className="rounded-full border-border/60 hover:border-primary/40 hover:bg-primary/5 text-sm"
                        onClick={() => handleSend(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 max-w-4xl mx-auto">
                {/* Minimal Header with Clear Button */}
                <div className="flex items-center justify-between pb-4 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground/80">
                      {selectedTemplate?.name || "Chat Livre"}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{client.name}</span>
                  </div>
                  {conversationId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearConversation}
                      className="text-muted-foreground hover:text-destructive h-8 px-2"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      <span className="text-xs">Limpar</span>
                    </Button>
                  )}
                </div>

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
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input - Clean Bottom Bar */}
        <div className="border-t border-border/30 bg-background/60 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              onSend={handleSend}
              disabled={isLoading}
              templateType={templateType}
            />
          </div>
        </div>
      </Card>
    </div>
  );
};
