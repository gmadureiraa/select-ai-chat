import { useEffect, useRef } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { MessageBubble } from "@/components/MessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { ModelSelector } from "@/components/ModelSelector";
import { useChat } from "@/hooks/useChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";

const Index = () => {
  const {
    conversations,
    currentConversation,
    currentConversationId,
    isLoading,
    selectedModel,
    setSelectedModel,
    createNewConversation,
    setCurrentConversationId,
    sendMessage,
  } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentConversation?.messages]);

  useEffect(() => {
    if (conversations.length === 0) {
      createNewConversation();
    }
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onNewChat={createNewConversation}
        onSelectConversation={setCurrentConversationId}
      />

      <div className="flex-1 flex flex-col">
        <div className="border-b p-4 flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Chat AI</h1>
          </div>
          <ModelSelector value={selectedModel} onChange={setSelectedModel} />
        </div>

        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="h-full">
            {currentConversation?.messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md p-8">
                  <Sparkles className="h-16 w-16 text-primary mx-auto" />
                  <h2 className="text-2xl font-bold">Bem-vindo ao Chat AI</h2>
                  <p className="text-muted-foreground">
                    Converse com os modelos de IA mais avançados. Escolha o modelo acima e
                    comece a conversar!
                  </p>
                </div>
              </div>
            ) : (
              <div className="pb-4">
                {currentConversation?.messages.map((message, idx) => (
                  <MessageBubble key={idx} role={message.role} content={message.content} />
                ))}
                {isLoading && (
                  <div className="flex gap-3 p-6">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-primary-foreground animate-pulse" />
                    </div>
                    <div className="bg-chat-ai-bg text-chat-ai-fg rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <span className="animate-bounce">●</span>
                        <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>●</span>
                        <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
};

export default Index;
