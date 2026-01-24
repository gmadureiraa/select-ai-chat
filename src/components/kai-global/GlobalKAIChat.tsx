import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Message, ProcessStep, MultiAgentStep } from "@/types/chat";
import { KAIActionStatus } from "@/types/kaiActions";
import { EnhancedMessageBubble } from "@/components/chat/EnhancedMessageBubble";
import { SimpleProgress } from "./SimpleProgress";
import { Sparkles, MessageSquare, AlertCircle, RotateCcw, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  onRetryMessage?: (content: string) => void;
  chatMode?: "ideas" | "content" | "performance" | "free_chat";
  onSuggestionClick?: (text: string) => void;
}

// Error detection patterns
const ERROR_PATTERNS = [
  "erro",
  "error",
  "créditos insuficientes",
  "insufficient credits",
  "desculpe, ocorreu",
  "não consegui",
  "falha ao",
  "upgrade_required",
  "rate_limited",
];

function isErrorMessage(content: string): boolean {
  const lowerContent = content.toLowerCase();
  return ERROR_PATTERNS.some(pattern => lowerContent.includes(pattern));
}

// Get the last user message before a given message index
function getLastUserMessageBefore(messages: Message[], index: number): string | null {
  for (let i = index - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return messages[i].content;
    }
  }
  return null;
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
  onRetryMessage,
  chatMode = "content",
  onSuggestionClick,
}: GlobalKAIChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isProcessing]);

  // Empty state - minimal design
  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          className="flex flex-col items-center text-center max-w-[280px]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sidebar-accent mb-4">
            <Sparkles className="h-5 w-5 text-sidebar-accent-foreground" />
          </div>
          <h3 className="text-base font-medium text-foreground mb-1">
            Olá! Sou o kAI
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Seu assistente para criar conteúdo.
          </p>

          {/* Client context or selection CTA */}
          {selectedClientId ? (
            selectedClientName && (
              <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                <UserCircle className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Criando para <span className="font-medium text-foreground">{selectedClientName}</span>
                </span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-amber-700 dark:text-amber-400">
                Selecione um perfil para começar
              </span>
            </div>
          )}

          {/* Minimal prompts */}
          <div className="w-full space-y-2">
            {selectedClientId && onSuggestionClick ? (
              <>
                <PromptSuggestion text="Me dê ideias para o LinkedIn" onClick={() => onSuggestionClick("Me dê ideias para o LinkedIn")} />
                <PromptSuggestion text="Crie um carrossel sobre produtividade" onClick={() => onSuggestionClick("Crie um carrossel sobre produtividade")} />
                <PromptSuggestion text="Escreva uma newsletter" onClick={() => onSuggestionClick("Escreva uma newsletter")} />
              </>
            ) : selectedClientId ? (
              <>
                <PromptSuggestion text="Me dê ideias para o LinkedIn" />
                <PromptSuggestion text="Crie um carrossel sobre produtividade" />
                <PromptSuggestion text="Escreva uma newsletter" />
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-3 px-4 rounded-lg bg-muted/50">
                Selecione um perfil para criar conteúdo personalizado
              </p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="flex flex-col gap-3 p-4">
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => {
            const isError = message.role === "assistant" && isErrorMessage(message.content);
            const lastUserMessage = isError ? getLastUserMessageBefore(messages, index) : null;

            return (
              <motion.div
                key={message.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {isError ? (
                  // Error message with retry button
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      </div>
                      <div className="flex-1 bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                        <p className="text-sm text-foreground">{message.content}</p>
                        {lastUserMessage && onRetryMessage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-7 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => onRetryMessage(lastUserMessage)}
                          >
                            <RotateCcw className="h-3 w-3 mr-1.5" />
                            Tentar novamente
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
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
                    hideContentActions={false}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Minimal processing indicator */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-sidebar-accent flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-sidebar-accent-foreground" />
            </div>
            <div className="flex-1 pt-1">
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

// Minimal prompt suggestion
function PromptSuggestion({ text, onClick }: { text: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card/50 text-sm text-muted-foreground transition-colors text-left",
        onClick 
          ? "hover:bg-accent hover:text-foreground hover:border-primary/30 cursor-pointer" 
          : "cursor-default hover:bg-muted/50 hover:text-foreground"
      )}
    >
      <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">{text}</span>
    </button>
  );
}
