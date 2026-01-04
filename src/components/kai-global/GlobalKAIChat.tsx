import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Paperclip, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "@/types/chat";
import { DEFAULT_KAI_SUGGESTIONS, KAIQuickSuggestion } from "@/types/kaiActions";
import { EnhancedMessageBubble } from "@/components/chat/EnhancedMessageBubble";

interface GlobalKAIChatProps {
  messages: Message[];
  isProcessing: boolean;
  selectedClientId: string | null;
  onSuggestionClick?: (suggestion: KAIQuickSuggestion) => void;
}

export function GlobalKAIChat({
  messages,
  isProcessing,
  selectedClientId,
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

  const filteredSuggestions = DEFAULT_KAI_SUGGESTIONS.filter(
    (s) => !s.requiresClient || selectedClientId
  );

  // Empty state
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
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Olá! Sou o kAI
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
            Seu assistente de conteúdo. Posso criar posts, analisar métricas, 
            organizar seu planejamento e muito mais.
          </p>

          {/* Quick suggestions */}
          <div className="w-full space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Sugestões rápidas
            </p>
            <div className="grid grid-cols-2 gap-2">
              {filteredSuggestions.map((suggestion, index) => (
                <motion.button
                  key={suggestion.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.05 }}
                  onClick={() => onSuggestionClick?.(suggestion)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg",
                    "bg-muted/50 hover:bg-muted transition-colors",
                    "text-left text-sm"
                  )}
                >
                  <span className="text-lg">{suggestion.icon}</span>
                  <span className="text-foreground font-medium">
                    {suggestion.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {!selectedClientId && (
            <p className="text-xs text-muted-foreground mt-4 px-4 py-2 rounded-lg bg-muted/30">
              💡 Selecione um cliente para desbloquear todas as funcionalidades
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
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Processing indicator */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
            <span className="text-sm">kAI está pensando...</span>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
