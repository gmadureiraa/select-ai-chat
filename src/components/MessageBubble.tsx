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
      "flex gap-3 px-4 py-4 animate-fade-in group",
      isUser ? "justify-end" : "justify-start"
    )}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-card border border-primary/20 flex items-center justify-center">
          <img src={kaleidosLogo} alt="kAI" className="h-5 w-5 object-contain" />
        </div>
      )}
      
      <div className="flex flex-col gap-2 max-w-[85%]">
        {imageUrls && imageUrls.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2">
            {imageUrls.map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`Anexo ${index + 1}`}
                className="max-w-sm rounded-lg border"
              />
            ))}
          </div>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 break-words",
            isUser
              ? "bg-muted border border-border"
              : "bg-card border border-border"
          )}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
        
        <MessageActions 
          content={content}
          role={role}
          onRegenerate={onRegenerate}
          isLastMessage={isLastMessage}
          clientId={clientId}
          clientName={clientName}
          templateName={templateName}
        />
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
          <User className="h-4 w-4 text-foreground" />
        </div>
      )}
    </div>
  );
};
