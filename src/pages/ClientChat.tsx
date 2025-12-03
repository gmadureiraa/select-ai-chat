import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Loader2, Trash2 } from "lucide-react";
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
import { AutonomousProgress } from "@/components/chat/AutonomousProgress";
import { WorkflowVisualization } from "@/components/chat/WorkflowVisualization";
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
    conversationRules,
    workflowState,
    sendMessage,
    regenerateLastMessage,
    clearConversation,
  } = useClientChat(clientId!, templateId);

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
      {/* Header minimalista */}
      <div className="border-b p-3 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
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
              <img src={kaleidosLogo} alt="kAI" className="h-6 w-6" />
              <span className="text-sm font-medium text-muted-foreground">•</span>
              <span className="text-sm font-semibold">{client.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                      Todas as mensagens desta conversa serão removidas permanentemente. Esta ação não pode ser desfeita.
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
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="h-full">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="text-center space-y-8 max-w-4xl w-full animate-fade-in py-12">
                {/* Logo e título */}
                <div className="space-y-4">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-20 h-20 bg-primary/5 rounded-full blur-2xl" />
                    </div>
                    <img 
                      src={kaleidosLogo} 
                      alt="kAI" 
                      className="h-16 w-16 object-contain relative z-10" 
                    />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold mb-2 tracking-tight">
                      {template ? template.name : "O que posso fazer por você?"}
                    </h1>
                    <p className="text-muted-foreground text-lg">
                      {template 
                        ? "Descreva o que você precisa para este formato"
                        : "Escolha uma tarefa ou descreva o que você precisa"
                      }
                    </p>
                  </div>
                </div>

                {/* Sugestões de tarefas rápidas - apenas se não houver template específico */}
                {!templateId && <TaskSuggestions onSelectTask={sendMessage} />}

                {/* Contexto do cliente (compacto) */}
                {client.context_notes && (
                  <div className="mt-8 p-4 bg-muted/30 border border-border rounded-lg text-left max-w-2xl mx-auto">
                    <p className="text-xs font-medium mb-1 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                      Contexto ativo
                    </p>
                    <p className="text-sm text-foreground/80 line-clamp-3">{client.context_notes}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto pb-4">
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
                <div className="px-4 py-6 animate-fade-in">
                  <WorkflowVisualization 
                    currentStep={currentStep} 
                    workflowState={workflowState}
                  />
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
