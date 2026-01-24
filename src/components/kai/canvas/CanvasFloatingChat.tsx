import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, ArrowDownToLine, Square, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { useKAISimpleChat } from "@/hooks/useKAISimpleChat";
import { EnhancedMessageBubble } from "@/components/chat/EnhancedMessageBubble";
import { SimpleProgress } from "@/components/kai-global/SimpleProgress";
import { cn } from "@/lib/utils";
import KaleidosLogo from "@/assets/kaleidos-logo.svg";

interface CanvasFloatingChatProps {
  clientId: string;
  onAddToCanvas?: (content: string, format?: string) => void;
}

export function CanvasFloatingChat({ clientId, onAddToCanvas }: CanvasFloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isLoading,
    sendMessage,
    cancelRequest,
    clearHistory,
  } = useKAISimpleChat({ clientId });

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, scrollToBottom]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to toggle chat
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Escape to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const message = input.trim();
    setInput("");
    
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAddToCanvas = (content: string) => {
    if (onAddToCanvas) {
      onAddToCanvas(content);
    }
  };

  const handleStopGeneration = () => {
    cancelRequest();
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 group"
            >
              <img 
                src={KaleidosLogo} 
                alt="kAI Chat" 
                className="h-6 w-6 transition-transform group-hover:scale-110" 
              />
            </Button>
            <span className="absolute -top-8 right-0 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              ⌘K para abrir
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] h-[500px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                  <img src={KaleidosLogo} alt="kAI" className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">kAI Chat</span>
                <span className="text-xs text-muted-foreground">• Canvas</span>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={clearHistory}
                    title="Limpar conversa"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Converse com o kAI para buscar informações
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Envie respostas para o Canvas com um clique
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message, index) => (
                    <div key={message.id} className="relative group">
                      <EnhancedMessageBubble
                        role={message.role}
                        content={message.content}
                        clientId={clientId}
                        isLastMessage={index === messages.length - 1}
                        disableAutoPostDetection={true}
                      />
                      {/* Add to Canvas button for assistant messages */}
                      {message.role === "assistant" && message.content && onAddToCanvas && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute -bottom-1 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs h-6 px-2"
                          onClick={() => handleAddToCanvas(message.content)}
                        >
                          <ArrowDownToLine className="h-3 w-3 mr-1" />
                          Canvas
                        </Button>
                      )}
                    </div>
                  ))}

                  {isLoading && (
                    <SimpleProgress />
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-border/50 bg-muted/20">
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte algo..."
                  className="min-h-[40px] max-h-[100px] resize-none text-sm"
                  rows={1}
                  disabled={isLoading}
                />
                {isLoading ? (
                  <Button
                    onClick={handleStopGeneration}
                    size="icon"
                    variant="destructive"
                    className="shrink-0"
                    title="Parar geração"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    size="icon"
                    className="shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
                Pressione Enter para enviar • Shift+Enter para nova linha
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
