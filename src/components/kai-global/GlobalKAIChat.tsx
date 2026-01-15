import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message, ProcessStep, MultiAgentStep } from "@/types/chat";
import { KAIActionStatus } from "@/types/kaiActions";
import { EnhancedMessageBubble } from "@/components/chat/EnhancedMessageBubble";
import { SimpleProgress } from "./SimpleProgress";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

interface GlobalKAIChatProps {
  messages: Message[];
  isProcessing: boolean;
  selectedClientId: string | null;
  selectedClientName?: string;
  actionStatus?: KAIActionStatus;
  currentStep?: ProcessStep;
  multiAgentStep?: MultiAgentStep;
  multiAgentDetails?: Record<string, string>;
  onSendMessage?: (content: string, images?: string[], quality?: "fast" | "high") => void;
  chatMode?: "ideas" | "content" | "performance" | "free_chat";
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
  chatMode = "ideas",
}: GlobalKAIChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isProcessing]);

  // Empty state - simplified
  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center text-center max-w-[300px]"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <img src={kaleidosLogo} alt="kAI" className="h-7 w-7 object-contain" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Olá! Sou o kAI
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Seu assistente inteligente para criar conteúdo e analisar dados.
          </p>

          {/* Example prompts */}
          <div className="w-full space-y-2 text-left">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide text-center mb-3">
              Experimente
            </p>
            {selectedClientId ? (
              <>
                <PromptHint text="Me dê 3 ideias de conteúdo para o LinkedIn" />
                <PromptHint text="Como está o desempenho do Instagram?" />
                <PromptHint text="Crie um carrossel sobre produtividade" />
              </>
            ) : (
              <>
                <PromptHint text="Quais são as melhores práticas para Instagram?" />
                <PromptHint text="Como criar um calendário de conteúdo?" />
              </>
            )}
          </div>

          {!selectedClientId && (
            <p className="text-xs text-muted-foreground mt-6 px-4 py-2 rounded-lg bg-muted/50">
              💡 Selecione um cliente para criar conteúdo personalizado
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
                disableAutoPostDetection={true}
                hideContentActions={chatMode !== "content"}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Simple Processing indicator */}
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
              <SimpleProgress 
                currentStep={currentStep} 
                multiAgentStep={multiAgentStep} 
              />
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

// Helper component for prompt hints
function PromptHint({ text }: { text: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground hover:bg-muted/50 transition-colors cursor-default">
      💬 "{text}"
    </div>
  );
}
