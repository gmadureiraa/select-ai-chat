import { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  Send, 
  X, 
  Minimize2, 
  Maximize2,
  Loader2,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface FloatingAIChatProps {
  projectId: string;
  clientId?: string;
  connectedItems?: Array<{ id: string; title: string; content: string; type: string }>;
  onClose: () => void;
}

export const FloatingAIChat = ({ 
  projectId, 
  clientId, 
  connectedItems = [],
  onClose 
}: FloatingAIChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Build context from connected items
      const contextParts = connectedItems.map(item => 
        `[${item.type.toUpperCase()}] ${item.title}:\n${item.content || "Sem conteúdo"}`
      ).join("\n\n---\n\n");

      const systemPrompt = `Você é um assistente de pesquisa inteligente. Analise os materiais conectados e responda de forma concisa e útil.

${contextParts ? `MATERIAIS CONECTADOS:\n${contextParts}` : "Nenhum material conectado ainda."}

Responda em português brasileiro.`;

      const response = await supabase.functions.invoke("analyze-research", {
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            { role: "user", content: userMessage }
          ],
          projectId,
          clientId,
        },
      });

      if (response.error) throw response.error;

      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: response.data.response || "Desculpe, não consegui processar sua solicitação." 
      }]);
    } catch (error: any) {
      toast({
        title: "Erro na análise",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 20, opacity: 0, scale: 0.95 }}
      className={cn(
        "absolute bottom-24 right-4 z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden transition-all duration-200",
        isMinimized ? "w-72 h-14" : "w-96 h-[500px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-sm">AI Chat</span>
            {connectedItems.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                {connectedItems.length} material(is)
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-[calc(100%-56px)]"
          >
            {/* Connected Items Pills */}
            {connectedItems.length > 0 && (
              <div className="px-3 py-2 border-b border-border bg-muted/30">
                <div className="flex flex-wrap gap-1">
                  {connectedItems.slice(0, 4).map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-accent text-accent-foreground"
                    >
                      {item.title?.slice(0, 20) || item.type}
                    </span>
                  ))}
                  {connectedItems.length > 4 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                      +{connectedItems.length - 4}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Sparkles className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">
                    {connectedItems.length > 0 
                      ? "Faça perguntas sobre os materiais conectados"
                      : "Conecte materiais para analisar"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        )}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-border">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={inputRef}
                  placeholder="Pergunte sobre os materiais..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[40px] max-h-[120px] resize-none border-0 bg-muted/50 focus-visible:ring-1"
                  disabled={isLoading}
                />
                <Button
                  size="icon"
                  onClick={handleSubmit}
                  disabled={!input.trim() || isLoading}
                  className="h-10 w-10 rounded-xl shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
