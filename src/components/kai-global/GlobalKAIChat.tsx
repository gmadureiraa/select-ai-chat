import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message, ProcessStep, MultiAgentStep } from "@/types/chat";
import { KAIActionStatus } from "@/types/kaiActions";
import { EnhancedMessageBubble } from "@/components/chat/EnhancedMessageBubble";
import { MinimalProgress } from "@/components/chat/MinimalProgress";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

interface GlobalKAIChatProps {
  messages: Message[];
  isProcessing: boolean;
  selectedClientId: string | null;
  selectedClientName?: string;
  actionStatus?: KAIActionStatus;
  currentStep?: ProcessStep;
  multiAgentStep?: MultiAgentStep;
  onSendMessage?: (content: string, images?: string[], quality?: "fast" | "high") => void;
}

export function GlobalKAIChat({
  messages,
  isProcessing,
  selectedClientId,
  selectedClientName,
  actionStatus = "idle",
  currentStep,
  multiAgentStep,
  onSendMessage,
}: GlobalKAIChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isProcessing]);

  // Empty state - simplified without quick actions that don't apply
  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <img src={kaleidosLogo} alt="kAI" className="h-8 w-8 object-contain" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Olá! Sou o kAI
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-[280px]">
            Seu assistente inteligente. Posso analisar métricas, responder dúvidas, 
            e ajudar com qualquer coisa relacionada ao seu trabalho.
          </p>

          {/* Contextual hints based on client selection */}
          <div className="w-full space-y-2 text-left">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide text-center">
              Experimente perguntar
            </p>
            <div className="space-y-1.5">
              {selectedClientId ? (
                <>
                  <div className="px-3 py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                    💬 "Como está o desempenho do Instagram?"
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                    💬 "Quais foram os melhores posts do mês?"
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                    💬 "Me dê ideias de conteúdo para essa semana"
                  </div>
                </>
              ) : (
                <>
                  <div className="px-3 py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                    💬 "Como funciona o planejamento de conteúdo?"
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                    💬 "Quais são as melhores práticas para Instagram?"
                  </div>
                </>
              )}
            </div>
          </div>

          {!selectedClientId && (
            <p className="text-xs text-muted-foreground mt-4 px-4 py-2 rounded-lg bg-muted/30">
              💡 Selecione um cliente para acessar métricas e criar conteúdo
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="flex flex-col gap-4 p-4">
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <motion.div
              key={message.id || index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <EnhancedMessageBubble
                role={message.role}
                content={message.content}
                imageUrls={message.image_urls}
                isGeneratedImage={message.isGeneratedImage}
                payload={message.payload}
                clientId={selectedClientId || undefined}
                clientName={selectedClientName}
                isLastMessage={index === messages.length - 1}
                onSendMessage={onSendMessage}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Processing indicator with step tracking */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3"
          >
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-sm">
              <img src={kaleidosLogo} alt="kAI" className="h-5 w-5 object-contain" />
            </div>
            <div className="flex-1">
              {currentStep ? (
                <MinimalProgress 
                  currentStep={currentStep} 
                  multiAgentStep={multiAgentStep} 
                />
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm">
                    {actionStatus === "detecting" && "Analisando sua solicitação..."}
                    {actionStatus === "analyzing" && "Processando informações..."}
                    {actionStatus === "confirming" && "Aguardando confirmação..."}
                    {actionStatus === "executing" && "Executando ação..."}
                    {actionStatus === "idle" && "kAI está pensando..."}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
