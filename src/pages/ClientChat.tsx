import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/MessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { TaskSuggestions } from "@/components/chat/TaskSuggestions";
import { WorkflowVisualization } from "@/components/chat/WorkflowVisualization";
import { MultiAgentProgress } from "@/components/chat/MultiAgentProgress";
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
    workflowState,
    multiAgentStep,
    multiAgentDetails,
    isIdeaMode,
    sendMessage,
    regenerateLastMessage,
    clearConversation,
  } = useClientChat(clientId!, templateId);

  // Scroll suave automático
  const scrollRef = useSmoothScroll([messages, isLoading], {
    behavior: "smooth",
    delay: 100,
  });

  // Detectar se uma mensagem tem imagem gerada por IA
  const isGeneratedImage = (content: string, role: string): boolean => {
    if (role !== "assistant") return false;
    return content.includes("Imagem gerada") || content.includes("🎨");
  };

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
      {/* Header minimalista */}
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between h-14 px-4 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/assistant")}
              className="hover:bg-muted h-9 w-9"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={kaleidosLogo} alt="kAI" className="h-5 w-5" />
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-sm font-medium">{client.name}</span>
              {template && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{template.name}</span>
                </>
              )}
            </div>
          </div>
          
          {messages.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-destructive/10 hover:text-destructive h-9 w-9"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar conversa?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todas as mensagens serão removidas permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={clearConversation}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Limpar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      {/* Área de mensagens */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="min-h-full">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4 py-12">
              <div className="text-center space-y-6 max-w-2xl w-full animate-fade-in">
                {/* Logo e título */}
                <div className="space-y-3">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 bg-primary/10 rounded-full blur-xl" />
                    </div>
                    <img 
                      src={kaleidosLogo} 
                      alt="kAI" 
                      className="h-12 w-12 object-contain relative z-10" 
                    />
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {template ? template.name : "Como posso ajudar?"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {template 
                      ? "Descreva o que você precisa"
                      : "Escolha uma sugestão ou digite sua mensagem"
                    }
                  </p>
                </div>

                {/* Sugestões rápidas */}
                {!templateId && <TaskSuggestions onSelectTask={(task) => sendMessage(task, [], "fast")} />}

                {/* Contexto do cliente */}
                {client.context_notes && (
                  <div className="p-3 bg-muted/30 border border-border/50 rounded-lg text-left">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-primary rounded-full" />
                      Contexto ativo
                    </p>
                    <p className="text-xs text-foreground/70 line-clamp-2">
                      {client.context_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto pb-4">
              {messages.map((message, idx) => (
                <MessageBubble 
                  key={message.id || idx} 
                  role={message.role} 
                  content={message.content}
                  imageUrls={message.image_urls}
                  isGeneratedImage={isGeneratedImage(message.content, message.role)}
                  onRegenerate={regenerateLastMessage}
                  isLastMessage={idx === messages.length - 1}
                  clientId={clientId}
                  clientName={client?.name}
                  templateName={template?.name}
                />
              ))}
              
              {/* Visualização do workflow durante loading */}
              {isLoading && (
                <div className="px-4 py-4 animate-fade-in">
                  {multiAgentStep ? (
                    <MultiAgentProgress 
                      currentStep={multiAgentStep} 
                      stepDetails={multiAgentDetails}
                    />
                  ) : (
                    <WorkflowVisualization 
                      currentStep={currentStep} 
                      workflowState={workflowState}
                      isIdeaMode={isIdeaMode}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input de chat */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
};

export default ClientChat;
