import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/MessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { ModelSelector } from "@/components/ModelSelector";
import { useClientChat } from "@/hooks/useClientChat";

const ClientChat = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

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
    selectedModel,
    setSelectedModel,
    sendMessage,
  } = useClientChat(clientId!);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      <div className="border-b p-4 bg-card">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/clients")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{client.name}</h1>
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
              <div className="text-center space-y-4 max-w-md p-8">
                <Sparkles className="h-16 w-16 text-primary mx-auto" />
                <h2 className="text-2xl font-bold">Chat com {client.name}</h2>
                <p className="text-muted-foreground">
                  Converse com a IA sobre este cliente. O contexto fixo está sempre ativo.
                </p>
                {client.context_notes && (
                  <div className="mt-4 p-4 bg-muted rounded-lg text-left">
                    <p className="text-xs font-semibold mb-2 text-muted-foreground">
                      CONTEXTO FIXO:
                    </p>
                    <p className="text-sm">{client.context_notes}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="pb-4">
              {messages.map((message, idx) => (
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
  );
};

export default ClientChat;
