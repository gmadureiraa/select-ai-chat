import { memo } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface StreamingPreviewProps {
  content: string;
  isStreaming: boolean;
  progress?: number;
}

function StreamingPreviewComponent({ 
  content, 
  isStreaming, 
  progress = 0 
}: StreamingPreviewProps) {
  return (
    <div className="relative">
      {/* Progress bar */}
      {isStreaming && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted overflow-hidden rounded-t-md">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Content */}
      <div className={cn(
        "text-xs prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:text-xs prose-headings:font-semibold prose-p:my-1",
        isStreaming && "animate-pulse"
      )}>
        {content ? (
          <>
            <ReactMarkdown>{content}</ReactMarkdown>
            {isStreaming && (
              <span className="inline-flex items-center gap-1 text-primary ml-1">
                <span className="animate-pulse">▊</span>
              </span>
            )}
          </>
        ) : isStreaming ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Gerando conteúdo...</span>
          </div>
        ) : (
          <span className="text-muted-foreground italic">
            Aguardando geração...
          </span>
        )}
      </div>
    </div>
  );
}

export const StreamingPreview = memo(StreamingPreviewComponent);
