import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Trash2, PanelLeftClose, PanelLeft } from "lucide-react";
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
import { EnhancedMessageBubble } from "@/components/chat/EnhancedMessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { TaskSuggestions } from "@/components/chat/TaskSuggestions";
import { WorkflowVisualization } from "@/components/chat/WorkflowVisualization";
import { AdvancedProgress } from "@/components/chat/AdvancedProgress";
import { ChatOptionsSidebar } from "@/components/assistant/ChatOptionsSidebar";
import { useClientChat } from "@/hooks/useClientChat";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { useClientTemplates } from "@/hooks/useClientTemplates";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";
import { useState } from "react";

const ClientChat = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const templateId = searchParams.get("templateId") || undefined;
  const conversationIdParam = searchParams.get("conversationId") || undefined;
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
    isFreeChatMode,
    conversationId,
    sendMessage,
    regenerateLastMessage,
    clearConversation,
    startNewConversation,
  } = useClientChat(clientId!, templateId, conversationIdParam);

  const { templates, createTemplate } = useClientTemplates(clientId!);

  // Scroll suave automático
  const { scrollRef } = useSmoothScroll([messages, isLoading], {
    behavior: "smooth",
    delay: 100,
  });

  const handleSelectConversation = (convId: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("conversationId", convId);
    if (templateId) newParams.set("templateId", templateId);
    setSearchParams(newParams);
  };

  const handleNewConversation = async () => {
    await startNewConversation();
    const newParams = new URLSearchParams();
    if (templateId) newParams.set("templateId", templateId);
    setSearchParams(newParams);
    queryClient.invalidateQueries({ queryKey: ["conversation-history", clientId] });
  };

  const handleCreateTemplateFromSuggestion = async (name: string, prompt: string) => {
    // Check if template with this name already exists
    const existingTemplate = templates.find(t => t.name === name);
    
    if (existingTemplate) {
      // Template exists, just select it
      const newParams = new URLSearchParams();
      newParams.set("templateId", existingTemplate.id);
      setSearchParams(newParams);
    } else {
      // Create new template
      const result = await createTemplate.mutateAsync({
        client_id: clientId!,
        name,
        type: "chat",
      });
      
      // Navigate to the new template
      const newParams = new URLSearchParams();
      newParams.set("templateId", result.id);
      setSearchParams(newParams);
      
      // Send the initial prompt if provided
      if (prompt) {
        setTimeout(() => {
          sendMessage(prompt, [], "fast", "content");
        }, 500);
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["client-templates", clientId] });
  };

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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar de opções */}
      {sidebarOpen && (
        <ChatOptionsSidebar
          clientId={clientId!}
          currentConversationId={conversationId}
          onSelectTemplate={(templateId, templateName) => {
            const newParams = new URLSearchParams();
            if (templateId) newParams.set("templateId", templateId);
            setSearchParams(newParams);
            handleNewConversation();
          }}
          onSelectConversation={handleSelectConversation}
        />
      )}

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header minimalista */}
        <header className="border-b bg-background/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center justify-between h-12 px-3">
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="h-8 w-8 hover:bg-muted/60"
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <PanelLeft className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/assistant")}
                className="h-8 w-8 hover:bg-muted/60"
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </Button>
              <div className="h-4 w-px bg-border mx-1" />
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
                  <img src={kaleidosLogo} alt="kAI" className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="font-medium text-foreground">{client.name}</span>
                  {template && (
                    <>
                      <span className="text-muted-foreground/40">/</span>
                      <span className="text-muted-foreground text-xs">{template.name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          
            {messages.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
              <div className="h-full flex flex-col items-center justify-center px-4 py-16">
                <div className="text-center space-y-8 max-w-xl w-full animate-fade-in">
                  {/* Logo e título */}
                  <div className="space-y-4">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl blur-2xl" />
                      </div>
                      <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/10 flex items-center justify-center">
                        <img 
                          src={kaleidosLogo} 
                          alt="kAI" 
                          className="h-8 w-8 object-contain" 
                        />
                      </div>
                    </div>
                    <div>
                      <h1 className="text-xl font-semibold tracking-tight text-foreground">
                        {template ? template.name : "Como posso ajudar?"}
                      </h1>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template 
                          ? "Descreva o que você precisa"
                          : "Escolha uma sugestão ou digite sua mensagem"
                        }
                      </p>
                    </div>
                  </div>

                  {/* Sugestões rápidas */}
                  {!templateId && <TaskSuggestions onCreateTemplate={handleCreateTemplateFromSuggestion} />}

                  {/* Contexto do cliente */}
                  {client.context_notes && (
                    <div className="p-3 bg-muted/30 border border-border/40 rounded-xl text-left">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Contexto ativo
                        </p>
                      </div>
                      <p className="text-xs text-foreground/70 line-clamp-2 leading-relaxed">
                        {client.context_notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto py-4">
                {messages.map((message, idx) => (
                  <EnhancedMessageBubble 
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
                
                {/* Visualização avançada do progresso */}
                {isLoading && (
                  <div className="px-4 py-6 animate-fade-in">
                    <AdvancedProgress 
                      currentStep={currentStep}
                      multiAgentStep={multiAgentStep}
                      multiAgentDetails={multiAgentDetails}
                      isAutonomous={multiAgentStep !== null}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input de chat */}
        <ChatInput 
          onSend={(content, imageUrls, quality, mode) => sendMessage(content, imageUrls, quality, mode)} 
          disabled={isLoading}
          templateType={template?.name?.toLowerCase().includes("chat livre") || template?.name?.toLowerCase().includes("free chat") ? "free_chat" : "content"}
        />
      </div>
    </div>
  );
};

export default ClientChat;
