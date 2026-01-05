import { useRef, useEffect, useCallback } from "react";
import { Trash2, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useClientChat } from "@/hooks/useClientChat";
import { FloatingInput, ChatMode } from "@/components/chat/FloatingInput";
import { Citation } from "@/components/chat/CitationChip";
import { EnhancedMessageBubble } from "@/components/chat/EnhancedMessageBubble";
import { MinimalProgress } from "@/components/chat/MinimalProgress";
import { QuickSuggestions } from "@/components/chat/QuickSuggestions";
import { Client } from "@/hooks/useClients";
import KaleidosLogo from "@/assets/kaleidos-logo.svg";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { exportToMarkdown, exportToPDF, downloadFile } from "@/lib/exportConversation";
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

interface KaiAssistantTabProps {
  clientId: string;
  client: Client;
}

export const KaiAssistantTab = ({ clientId, client }: KaiAssistantTabProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Always use the single default conversation per client (no sidebar, no multiple conversations)
  const {
    messages,
    isLoading,
    sendMessage,
    clearConversation,
    conversationId,
    currentStep,
    multiAgentStep,
    contentLibrary,
    referenceLibrary,
    regenerateLastMessage,
  } = useClientChat(clientId, undefined, undefined);

  // Export handlers
  const handleExportMarkdown = async () => {
    const md = await exportToMarkdown(messages, client.name);
    downloadFile(md, `conversa-${client.name}.md`, "text/markdown");
    toast({ title: "Conversa exportada como Markdown" });
  };

  const handleExportPDF = async () => {
    const blob = await exportToPDF(messages, client.name);
    downloadFile(blob, `conversa-${client.name}.pdf`, "application/pdf");
    toast({ title: "Conversa exportada como PDF" });
  };

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

  // Initial scroll on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [scrollToBottom]);

  const handleSend = async (content: string, images?: string[], quality?: "fast" | "high", mode?: ChatMode, citations?: Citation[]) => {
    if (!content.trim() && (!images || images.length === 0)) return;
    await sendMessage(content, images, quality, mode, citations);
  };

  // Clear all messages from the conversation (but keep the conversation itself)
  const handleClearHistory = async () => {
    if (!conversationId) return;
    
    try {
      clearConversation();
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      toast({
        title: "Histórico limpo",
        description: "As mensagens foram removidas.",
      });
    } catch (error) {
      console.error("Error clearing history:", error);
      toast({
        title: "Erro ao limpar",
        description: "Não foi possível limpar o histórico.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] relative">
      {/* Main Chat Area - Full Width (no sidebar) */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/50">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <img src={KaleidosLogo} alt="kAI" className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-foreground/80 truncate">
              Chat
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className="text-xs text-muted-foreground truncate">{client.name}</span>
          </div>

          {conversationId && messages.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground h-7 px-2">
                    <Download className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">Exportar</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportMarkdown}>
                    <FileText className="h-4 w-4 mr-2" />
                    Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive h-7 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">Limpar</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar histórico?</AlertDialogTitle>
                    <AlertDialogDescription>
                      As mensagens serão removidas. Você pode continuar a conversa normalmente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Limpar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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
                  Como posso ajudar?
                </h2>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                  Converse sobre {client.name}, analise dados ou explore ideias. Use @ para selecionar formatos.
                </p>
                
                {/* Quick Suggestions */}
                <QuickSuggestions 
                  onSelect={(suggestion) => handleSend(suggestion)}
                  clientId={clientId}
                  clientName={client.name}
                  isContentTemplate={false}
                />
              </div>
            ) : (
              <div className="space-y-2 px-4 py-8 max-w-3xl mx-auto w-full">
                {messages.map((message, index) => (
                  <EnhancedMessageBubble
                    key={message.id}
                    role={message.role as "user" | "assistant"}
                    content={message.content}
                    imageUrls={message.image_urls}
                    payload={(message as any).payload}
                    clientId={clientId}
                    clientName={client.name}
                    onRegenerate={index === messages.length - 1 && message.role === "assistant" ? regenerateLastMessage : undefined}
                    isLastMessage={index === messages.length - 1}
                    onSendMessage={handleSend}
                    disableAutoPostDetection={true}
                  />
                ))}

                {isLoading && (
                  <MinimalProgress 
                    currentStep={currentStep}
                    multiAgentStep={multiAgentStep}
                  />
                )}
                
                {/* Scroll anchor */}
                <div ref={messagesEndRef} className="h-1" />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Floating Input - Bottom */}
        <div className="border-t border-border/10 bg-background/60 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto">
            <FloatingInput
              onSend={handleSend}
              disabled={isLoading}
              templateType="free_chat"
              placeholder="Pergunte sobre o cliente... Use @ para formatos"
              contentLibrary={contentLibrary || []}
              referenceLibrary={referenceLibrary || []}
            />
          </div>
        </div>
      </div>
    </div>
  );
};