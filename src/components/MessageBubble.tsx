import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export const MessageBubble = ({ role, content }: MessageBubbleProps) => {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3 p-6 animate-fade-in", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-card border-2 border-primary/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,255,127,0.3)]">
          <img src={kaleidosLogo} alt="kAI" className="h-6 w-6 object-contain" />
        </div>
      )}
      
      <div
        className={cn(
          "rounded-2xl px-4 py-3 max-w-[80%] break-words transition-all duration-200",
          isUser
            ? "bg-chat-user-bg text-chat-user-fg border border-border"
            : "bg-chat-ai-bg text-chat-ai-fg border border-primary/20"
        )}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center">
          <User className="h-5 w-5 text-foreground" />
        </div>
      )}
    </div>
  );
};
