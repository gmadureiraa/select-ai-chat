import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Copy, ThumbsUp, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Kai2ChatAreaProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3",
        isUser && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isUser 
          ? "bg-gradient-to-br from-primary to-secondary" 
          : "bg-white/10"
      )}>
        {isUser ? (
          <span className="text-xs font-medium text-white">U</span>
        ) : (
          <img src={kaleidosLogo} alt="kAI" className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className={cn(
        "flex-1 max-w-[80%]",
        isUser && "flex flex-col items-end"
      )}>
        <div className={cn(
          "rounded-2xl px-4 py-3",
          isUser 
            ? "bg-primary/20 text-white" 
            : "bg-white/5 text-white/90 border border-white/5"
        )}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>

        {/* Actions for assistant messages */}
        {!isUser && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-1.5 rounded-md hover:bg-white/5 text-white/40 hover:text-white/60">
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-white/5 text-white/40 hover:text-white/60">
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-white/5 text-white/40 hover:text-white/60">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs text-white/30 mt-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}

export function Kai2ChatArea({ messages, onSendMessage, isLoading }: Kai2ChatAreaProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <AnimatePresence>
            {messages.map((message) => (
              <div key={message.id} className="group">
                <MessageBubble message={message} />
              </div>
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <img src={kaleidosLogo} alt="kAI" className="h-4 w-4" />
              </div>
              <div className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-100" />
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-200" />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-white/5 p-4">
        <div className="max-w-3xl mx-auto">
          <div className={cn(
            "relative rounded-xl overflow-hidden",
            "bg-white/[0.05] backdrop-blur-sm",
            "border border-white/10"
          )}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Continuar conversa..."
              className={cn(
                "w-full bg-transparent resize-none outline-none",
                "text-white placeholder:text-white/30",
                "text-sm p-4 pr-24 min-h-[56px] max-h-[200px]"
              )}
              rows={1}
            />

            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors">
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  input.trim() && !isLoading
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-white/5 text-white/30 cursor-not-allowed"
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
