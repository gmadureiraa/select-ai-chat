import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/MessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { ModelSelector } from "@/components/ModelSelector";
import { TaskSuggestions } from "@/components/chat/TaskSuggestions";
import { AutonomousProgress } from "@/components/chat/AutonomousProgress";
import { useClientChat } from "@/hooks/useClientChat";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const ClientChat = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("templateId") || undefined;

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

  const { data: template } = useQuery({
    queryKey: ["template", templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const { data, error } = await supabase
        .from("client_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!templateId,
  });

  const {
    messages,
    isLoading,
    currentStep,
    selectedModel,
    setSelectedModel,
    sendMessage,
    regenerateLastMessage,
  } = useClientChat(clientId!, templateId);

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
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl md:text-2xl font-bold">Cliente não encontrado</h2>
          <Button onClick={() => navigate("/clients")}>
            Voltar para Clientes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background flex-col">
      {/* Header responsivo */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-3 md:px-6 py-3 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/client/${clientId}`)}
              className="h-8 w-8 md:h-9 md:w-9 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <img src={kaleidosLogo} alt="kAI" className="h-5 w-5 md:h-6 md:w-6 flex-shrink-0" />
              <span className="hidden sm:inline text-sm font-medium text-muted-foreground">•</span>
              <span className="text-sm md:text-base font-semibold truncate">{client.name}</span>
            </div>
          </div>
          <div className="flex-shrink-0">
            <ModelSelector value={selectedModel} onChange={setSelectedModel} />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="h-full">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4 py-8 md:py-12">
              <div className="text-center space-y-6 md:space-y-8 max-w-4xl w-full animate-fade-in">
                {/* Logo e título */}
                <div className="space-y-3 md:space-y-4">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/5 rounded-full blur-2xl" />
                    </div>
                    <img 
                      src={kaleidosLogo} 
                      alt="kAI" 
                      className="h-12 w-12 md:h-16 md:w-16 object-contain relative z-10" 
                    />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
                      O que posso fazer por você?
                    </h1>
                    <p className="text-muted-foreground text-base md:text-lg">
                      Escolha uma tarefa ou descreva o que você precisa
                    </p>
                  </div>
                </div>

                {/* Sugestões de tarefas */}
                <TaskSuggestions onSelectTask={sendMessage} />

                {/* Contexto do cliente */}
                {client.context_notes && (
                  <div className="mt-6 md:mt-8 p-3 md:p-4 bg-muted/30 border border-border rounded-lg text-left max-w-2xl mx-auto">
                    <p className="text-xs font-medium mb-1.5 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                      Contexto ativo
                    </p>
                    <p className="text-xs md:text-sm text-foreground/80 line-clamp-3">{client.context_notes}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-5xl mx-auto py-4">
              {messages.map((message, idx) => (
                <MessageBubble 
                  key={idx} 
                  role={message.role} 
                  content={message.content}
                  imageUrls={message.image_urls}
                  onRegenerate={regenerateLastMessage}
                  isLastMessage={idx === messages.length - 1}
                  clientId={clientId}
                  clientName={client?.name}
                  templateName={template?.name}
                />
              ))}
              {isLoading && (
                <div className="px-3 md:px-4 py-4 md:py-6 animate-fade-in">
                  <AutonomousProgress currentStep={currentStep} />
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