import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { parseMentions, Mention } from "@/lib/mentionParser";
import { cn } from "@/lib/utils";
import { FileText, BookOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MentionRendererProps {
  text: string;
  onMentionDoubleClick?: (type: 'content' | 'reference', id: string) => void;
  className?: string;
}

export function MentionRenderer({ text, onMentionDoubleClick, className }: MentionRendererProps) {
  const parts = useMemo(() => {
    if (!text) return [];
    
    const mentions = parseMentions(text);
    if (mentions.length === 0) {
      return [{ type: 'text' as const, content: text }];
    }

    const result: Array<{ type: 'text' | 'mention'; content?: string; mention?: Mention }> = [];
    let lastIndex = 0;

    mentions.forEach(mention => {
      // Adiciona texto antes da menção
      if (mention.start > lastIndex) {
        result.push({
          type: 'text',
          content: text.substring(lastIndex, mention.start)
        });
      }
      // Adiciona a menção
      result.push({
        type: 'mention',
        mention
      });
      lastIndex = mention.end;
    });

    // Adiciona texto após a última menção
    if (lastIndex < text.length) {
      result.push({
        type: 'text',
        content: text.substring(lastIndex)
      });
    }

    return result;
  }, [text]);

  return (
    <span className={className}>
    {parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <span key={index} className="inline prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown 
                components={{
                  p: ({ children }) => <span>{children}</span>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em>{children}</em>,
                  code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs">{children}</code>,
                }}
              >
                {part.content || ''}
              </ReactMarkdown>
            </span>
          );
        }

        const mention = part.mention!;
        const Icon = mention.type === 'content' ? FileText : BookOpen;

        return (
          <TooltipProvider key={index}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium cursor-pointer select-none",
                    "transition-colors duration-150",
                    mention.type === 'content'
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
                  )}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onMentionDoubleClick?.(mention.type, mention.id);
                  }}
                >
                  <Icon className="h-3 w-3" />
                  {mention.title}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p>Duplo clique para visualizar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </span>
  );
}
