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
            <div key={index} className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown 
                components={{
                  p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em>{children}</em>,
                  code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                  pre: ({ children }) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto my-4">{children}</pre>,
                  h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-3">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-base font-semibold mt-3 mb-2">{children}</h4>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary/30 pl-4 italic my-4 text-muted-foreground">
                      {children}
                    </blockquote>
                  ),
                  hr: () => <hr className="my-6 border-border" />,
                  ul: ({ children }) => <ul className="list-disc pl-6 my-4 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-6 my-4 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  a: ({ href, children }) => (
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-primary underline hover:text-primary/80"
                    >
                      {children}
                    </a>
                  ),
                  img: ({ src, alt }) => (
                    <img 
                      src={src} 
                      alt={alt || ''} 
                      className="max-w-full h-auto rounded-lg my-4 border border-border"
                      loading="lazy"
                    />
                  ),
                }}
              >
                {part.content || ''}
              </ReactMarkdown>
            </div>
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
