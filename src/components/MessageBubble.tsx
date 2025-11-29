import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";
import { MessageActions } from "@/components/MessageActions";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[] | null;
  onRegenerate?: () => void;
  isLastMessage?: boolean;
  clientId?: string;
  clientName?: string;
  templateName?: string;
}

export const MessageBubble = ({ 
  role, 
  content,
  imageUrls,
  onRegenerate,
  isLastMessage,
  clientId,
  clientName,
  templateName,
}: MessageBubbleProps) => {
  const isUser = role === "user";

  return (
    <div className={cn(
      "flex gap-3 px-3 md:px-6 py-3 md:py-4 animate-fade-in group",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center",
        isUser 
          ? "bg-muted border border-border" 
          : "bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20"
      )}>
        {isUser ? (
          <User className="h-3.5 w-3.5 md:h-4 md:w-4 text-foreground" />
        ) : (
          <img src={kaleidosLogo} alt="kAI" className="h-4 w-4 md:h-5 md:w-5 object-contain" />
        )}
      </div>
      
      {/* Message content */}
      <div className={cn(
        "flex flex-col gap-1.5 md:gap-2 min-w-0",
        isUser ? "items-end" : "items-start",
        "flex-1 max-w-[85%] md:max-w-[75%]"
      )}>
        {/* Images */}
        {imageUrls && imageUrls.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {imageUrls.map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`Anexo ${index + 1}`}
                className="max-w-[200px] md:max-w-sm rounded-lg border shadow-sm"
              />
            ))}
          </div>
        )}
        
        {/* Text bubble */}
        <div
          className={cn(
            "rounded-2xl px-3 py-2.5 md:px-4 md:py-3 break-words shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-card border border-border rounded-bl-sm"
          )}
        >
          <div className={cn(
            "prose prose-sm md:prose-base dark:prose-invert max-w-none",
            "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
            "[&_p]:leading-relaxed [&_pre]:my-2",
            "[&_code]:text-xs [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded",
            "[&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5",
            isUser && "prose-invert [&_code]:bg-primary-foreground/10"
          )}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
        
        {/* Actions */}
        {!isUser && (
          <MessageActions 
            content={content}
            role={role}
            onRegenerate={onRegenerate}
            isLastMessage={isLastMessage}
            clientId={clientId}
            clientName={clientName}
            templateName={templateName}
          />
        )}
      </div>
    </div>
  );
};