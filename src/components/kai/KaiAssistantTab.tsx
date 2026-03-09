import { useRef, useEffect, useCallback, useState } from "react";
import { Trash2, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useKAISimpleChat, SimpleCitation } from "@/hooks/useKAISimpleChat";
import { FloatingInput } from "@/components/chat/FloatingInput";
import { Citation } from "@/components/chat/CitationChip";
import { EnhancedMessageBubble } from "@/components/chat/EnhancedMessageBubble";
import { PipelineProgress } from "@/components/chat/PipelineProgress";
import { QuickSuggestions } from "@/components/chat/QuickSuggestions";
import { ModeSelector, ChatMode } from "@/components/chat/ModeSelector";
import { Client } from "@/hooks/useClients";
import KaleidosLogo from "@/assets/kaleidos-logo.svg";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { exportToMarkdown, exportToPDF, downloadFile } from "@/lib/exportConversation";
import { supabase } from "@/integrations/supabase/client";
import { PlanningItemDialog } from "@/components/planning/PlanningItemDialog";
import { usePlanningItems } from "@/hooks/usePlanningItems";
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
  
  const [chatMode, setChatMode] = useState<ChatMode>("ideas");
  const [planningDialogOpen, setPlanningDialogOpen] = useState(false);
  const [contentForPlanning, setContentForPlanning] = useState("");
  
  const { columns, createItem } = usePlanningItems();
  const hasPlanningAccess = columns.length > 0;

  // Use the simplified chat hook — all intelligence lives on the backend
  const {
    messages,
    isLoading,
    sendMessage: baseSendMessage,
    clearHistory,
    conversationId,
  } = useKAISimpleChat({ clientId });

  // Content & reference libraries for citation feature in FloatingInput
  const { data: contentLibrary = [] } = useQuery({
    queryKey: ["client-content-library", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_content_library")
        .select("id, title, content_type, content")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: referenceLibrary = [] } = useQuery({
    queryKey: ["client-reference-library", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_reference_library")
        .select("id, title, reference_type, content")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  // Handle "Use" button — opens planning dialog with pre-filled content
  const handleUseContent = useCallback((content: string) => {
    setContentForPlanning(content);
    setPlanningDialogOpen(true);
  }, []);
  
  const defaultColumn = columns.find(c => c.column_type === "idea" || c.column_type === "draft");

  // Export handlers
  const handleExportMarkdown = async () => {
    const exportMessages = messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      image_urls: m.imageUrl ? [m.imageUrl] : null,
    }));
    const md = await exportToMarkdown(exportMessages as any, client.name);
    downloadFile(md, `conversa-${client.name}.md`, "text/markdown");
    toast({ title: "Conversa exportada como Markdown" });
  };

  const handleExportPDF = async () => {
    const exportMessages = messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      image_urls: m.imageUrl ? [m.imageUrl] : null,
    }));
    const blob = await exportToPDF(exportMessages as any, client.name);
    downloadFile(blob, `conversa-${client.name}.pdf`, "application/pdf");
    toast({ title: "Conversa exportada como PDF" });
  };

  // Scroll helpers
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: smooth ? "smooth" : "auto",
      block: "end" 
    });
  }, []);

  useEffect(() => { scrollToBottom(true); }, [messages, scrollToBottom]);
  useEffect(() => {
    const t = setTimeout(() => scrollToBottom(false), 100);
    return () => clearTimeout(t);
  }, [scrollToBottom]);

  // Send handler — maps mode + citations to the simple chat backend
  const handleSend = async (content: string, images?: string[], quality?: "fast" | "high", mode?: ChatMode, citations?: Citation[]) => {
    if (!content.trim() && (!images || images.length === 0)) return;
    
    const effectiveMode = mode || chatMode;
    
    // Performance mode — call kai-metrics-agent directly
    if (effectiveMode === "performance") {
      try {
        const response = await supabase.functions.invoke("kai-metrics-agent", {
          body: { clientId, question: content },
        });
        if (response.error) throw new Error(response.error.message);
        
        let responseContent = "";
        const reader = response.data?.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            responseContent += decoder.decode(value, { stream: true });
          }
        } else {
          responseContent = typeof response.data === "string" 
            ? response.data 
            : response.data?.content || "Não foi possível analisar as métricas.";
        }
        
        // Use the simple chat to add both messages so they're persisted
        await baseSendMessage(`[Análise de Performance] ${content}`, 
          citations?.map(c => ({ id: c.id, type: c.type as any, title: c.title })),
          images
        );
      } catch (error) {
        console.error("Performance analysis error:", error);
        toast({
          title: "Erro na análise",
          description: error instanceof Error ? error.message : "Erro desconhecido",
          variant: "destructive",
        });
      }
      return;
    }
    
    // All other modes — delegate to kai-simple-chat via the hook
    const simpleCitations: SimpleCitation[] | undefined = citations?.map(c => ({
      id: c.id,
      type: c.type as any,
      title: c.title,
    }));
    
    await baseSendMessage(content, simpleCitations, images);
  };

  // Clear history
  const handleClearHistory = async () => {
    clearHistory();
    toast({
      title: "Histórico limpo",
      description: "As mensagens foram removidas.",
    });
  };

  return (
    <div className="flex h-[calc(100vh-140px)] relative">
      <div className="flex-1 flex flex-col min-w-0 bg-background/50">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <img src={KaleidosLogo} alt="kAI" className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-foreground/80 truncate">Chat</span>
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
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive h-7 px-2">
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
                    role={message.role}
                    content={message.content}
                    imageUrls={message.imageUrl ? [message.imageUrl] : undefined}
                    clientId={clientId}
                    clientName={client.name}
                    messageId={message.id}
                    isLastMessage={index === messages.length - 1}
                    onSendMessage={handleSend}
                    disableAutoPostDetection={true}
                    onUseContent={handleUseContent}
                    hasPlanningAccess={hasPlanningAccess}
                  />
                ))}

                {isLoading && (
                  <PipelineProgress 
                    currentStage="context"
                    showElapsedTime
                  />
                )}
                
                <div ref={messagesEndRef} className="h-1" />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Floating Input */}
        <div className="border-t border-border/10 bg-background/60 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto space-y-2 py-3">
            <FloatingInput
              onSend={handleSend}
              disabled={isLoading}
              templateType="free_chat"
              placeholder="Pergunte sobre o cliente... Use @ para formatos"
              contentLibrary={contentLibrary || []}
              referenceLibrary={referenceLibrary || []}
              selectedMode={chatMode}
            />
            <div className="flex justify-center px-4">
              <ModeSelector
                mode={chatMode}
                onChange={setChatMode}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Planning Dialog */}
      <PlanningItemDialog
        open={planningDialogOpen}
        onOpenChange={setPlanningDialogOpen}
        columns={columns}
        defaultColumnId={defaultColumn?.id}
        defaultClientId={clientId}
        onSave={async (data) => {
          const result = await createItem.mutateAsync(data);
          return { id: result.id };
        }}
        item={contentForPlanning ? {
          id: "",
          title: contentForPlanning.substring(0, 60) + (contentForPlanning.length > 60 ? "..." : ""),
          content: contentForPlanning,
          client_id: clientId,
          column_id: defaultColumn?.id || "",
          priority: "medium",
          status: "idea",
          created_by: "",
          workspace_id: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any : null}
      />
    </div>
  );
};
