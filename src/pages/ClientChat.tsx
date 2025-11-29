import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/MessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { ModelSelector } from "@/components/ModelSelector";
import { useClientChat } from "@/hooks/useClientChat";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const ClientChat = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const {
    messages,
    isLoading,
    currentStep,
    selectedModel,
    setSelectedModel,
    sendMessage,
    regenerateLastMessage,
  } = useClientChat(clientId!);

  // Scroll suave automático
  const scrollRef = useSmoothScroll([messages, isLoading], {
    behavior: "smooth",
    delay: 100,
  });

  if (isLoadingClient) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Cliente não encontrado</h2>
          <Button onClick={() => navigate("/clients")}>
            Voltar para Clientes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background flex-col">
      <div className="border-b p-4 bg-card shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/clients")}
              className="hover:bg-primary/10 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{client.name}</h1>
              {client.description && (
                <p className="text-sm text-muted-foreground">
                  {client.description}
                </p>
              )}
            </div>
          </div>
          <ModelSelector value={selectedModel} onChange={setSelectedModel} />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="h-full max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-6 max-w-md p-8 animate-fade-in">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 bg-primary/10 rounded-full blur-xl animate-pulse" />
                  </div>
                  <img 
                    src={kaleidosLogo} 
                    alt="kAI" 
                    className="h-20 w-20 mx-auto object-contain relative z-10 drop-shadow-[0_0_15px_rgba(0,255,127,0.5)]" 
                  />
                </div>
                <div>
                  <h2 className="text-3xl font-bold mb-2">
                    Chat com <span className="text-primary">{client.name}</span>
                  </h2>
                  <p className="text-muted-foreground">
                    Converse com a IA sobre este cliente. O contexto fixo está sempre ativo.
                  </p>
                </div>
                {client.context_notes && (
                  <div className="mt-6 p-4 bg-muted/50 border border-primary/20 rounded-lg text-left backdrop-blur-sm">
                    <p className="text-xs font-semibold mb-2 text-primary flex items-center gap-2">
                      <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      CONTEXTO FIXO ATIVO
                    </p>
                    <p className="text-sm text-foreground">{client.context_notes}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="pb-4">
              {messages.map((message, idx) => (
                <MessageBubble 
                  key={idx} 
                  role={message.role} 
                  content={message.content}
                  onRegenerate={regenerateLastMessage}
                  isLastMessage={idx === messages.length - 1}
                />
              ))}
              {isLoading && (
                <div className="flex gap-3 p-6 animate-fade-in">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-card border-2 border-primary/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,255,127,0.3)] animate-pulse">
                    <img src={kaleidosLogo} alt="kAI" className="h-6 w-6 object-contain" />
                  </div>
                  <div className="space-y-2">
                    <div className="bg-chat-ai-bg text-chat-ai-fg rounded-2xl px-4 py-3 border border-primary/20">
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="font-medium text-primary">
                          {currentStep === "analyzing" && "~ analisando demanda"}
                          {currentStep === "reviewing" && "~ revisando contexto do cliente"}
                          {currentStep === "creating" && "~ criando conteúdo"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 px-4">
                      <span className="animate-bounce text-primary">●</span>
                      <span className="animate-bounce text-primary" style={{ animationDelay: "0.1s" }}>●</span>
                      <span className="animate-bounce text-primary" style={{ animationDelay: "0.2s" }}>●</span>
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
  );
};

export default ClientChat;
