import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles, MessageSquare, Lightbulb, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClientTemplates } from "@/hooks/useClientTemplates";
import { useClientChat } from "@/hooks/useClientChat";
import { ChatInput } from "@/components/ChatInput";
import { EnhancedMessageBubble } from "@/components/chat/EnhancedMessageBubble";
import { AdvancedProgress } from "@/components/chat/AdvancedProgress";
import { Client } from "@/hooks/useClients";

interface KaiAssistantTabProps {
  clientId: string;
  client: Client;
}

export const KaiAssistantTab = ({ clientId, client }: KaiAssistantTabProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    searchParams.get("template")
  );
  const [chatMode, setChatMode] = useState<"content" | "ideas" | "chat">("content");
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
    
    const effectiveMode = mode || (chatMode === "ideas" ? "ideas" : chatMode === "chat" ? "free_chat" : "content");
    
    await sendMessage(content, images, quality, effectiveMode);
  };

  const handleClearConversation = async () => {
    await clearConversation();
  };

  const chatTemplates = templates?.filter(t => t.type === "chat") || [];
  const imageTemplates = templates?.filter(t => t.type === "image") || [];

  const templateType = selectedTemplate ? "content" : "free_chat";

  return (
    <div className="flex gap-4 h-[calc(100vh-140px)]">
      {/* Sidebar - Templates */}
      <Card className="w-64 shrink-0 flex flex-col">
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm">Templates</h3>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {/* Free Chat Option */}
            <Button
              variant={!selectedTemplateId ? "secondary" : "ghost"}
              className="w-full justify-start text-sm h-9"
              onClick={() => setSelectedTemplateId(null)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat Livre
            </Button>

            {/* Content Templates */}
            {chatTemplates.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground px-2 py-1">Conteúdo</p>
                {chatTemplates.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedTemplateId === template.id ? "secondary" : "ghost"}
                    className="w-full justify-start text-sm h-9"
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    <span className="truncate">{template.name}</span>
                  </Button>
                ))}
              </div>
            )}

            {/* Image Templates */}
            {imageTemplates.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground px-2 py-1">Imagens</p>
                {imageTemplates.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedTemplateId === template.id ? "secondary" : "ghost"}
                    className="w-full justify-start text-sm h-9"
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    <span className="truncate">{template.name}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="font-semibold text-sm">
                {selectedTemplate?.name || "Chat Livre"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {client.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Selector - Only for content templates */}
            {selectedTemplate && (
              <Tabs value={chatMode} onValueChange={(v) => setChatMode(v as typeof chatMode)}>
                <TabsList className="h-8">
                  <TabsTrigger value="content" className="text-xs px-2 h-6">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Conteúdo
                  </TabsTrigger>
                  <TabsTrigger value="ideas" className="text-xs px-2 h-6">
                    <Lightbulb className="h-3 w-3 mr-1" />
                    Ideias
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="text-xs px-2 h-6">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Chat
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {conversationId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearConversation}
                className="text-muted-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium mb-1">
                  {selectedTemplate ? `Criar ${selectedTemplate.name}` : "Chat Livre"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {selectedTemplate
                    ? `Use este template para criar conteúdo de ${selectedTemplate.name} para ${client.name}`
                    : `Converse livremente sobre ${client.name} - pesquise, tire dúvidas, explore ideias`
                  }
                </p>
              </div>
            )}

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
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t">
          <ChatInput
            onSend={handleSend}
            disabled={isLoading}
            templateType={templateType}
          />
        </div>
      </Card>
    </div>
  );
};
