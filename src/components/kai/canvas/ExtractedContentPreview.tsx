import { memo, useState } from "react";
import { 
  Youtube, 
  FileText, 
  Library, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  Clock,
  User,
  Calendar,
  Hash,
  Maximize2,
  Copy,
  Check
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export interface ContentMetadata {
  author?: string;
  publishDate?: string;
  duration?: string;
  wordCount?: number;
  channel?: string;
  source?: string;
  sourceUrl?: string;
  libraryItemId?: string;
  libraryItemType?: string;
  views?: string;
}

interface ExtractedContentPreviewProps {
  content: string;
  title?: string;
  thumbnail?: string;
  urlType?: "youtube" | "article" | "newsletter" | "library";
  metadata?: ContentMetadata;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onOpenFullView?: () => void;
  maxCollapsedHeight?: number;
}

const TYPE_CONFIG = {
  youtube: {
    icon: Youtube,
    label: "YouTube",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
  article: {
    icon: FileText,
    label: "Artigo",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  newsletter: {
    icon: FileText,
    label: "Newsletter",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  library: {
    icon: Library,
    label: "Biblioteca",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
  },
};

function formatWordCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k palavras`;
  }
  return `${count} palavras`;
}

function formatDuration(duration: string): string {
  // If already formatted like "15:32", return as-is
  if (duration.includes(":")) return duration;
  
  // If it's seconds, format
  const seconds = parseInt(duration);
  if (!isNaN(seconds)) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  
  return duration;
}

function estimateReadingTime(wordCount: number): string {
  const minutes = Math.ceil(wordCount / 200);
  return `${minutes} min de leitura`;
}

function ExtractedContentPreviewComponent({
  content,
  title,
  thumbnail,
  urlType = "article",
  metadata,
  isExpanded = false,
  onToggleExpand,
  onOpenFullView,
  maxCollapsedHeight = 120,
}: ExtractedContentPreviewProps) {
  const [copied, setCopied] = useState(false);
  
  const config = TYPE_CONFIG[urlType] || TYPE_CONFIG.article;
  const Icon = config.icon;
  
  const wordCount = metadata?.wordCount || content.split(/\s+/).length;
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse carousel/thread content for structured display
  const parseStructuredContent = (text: string): { type: "carousel" | "thread" | "text"; slides: string[] } => {
    // Check for carousel slides (numbered or with separators)
    const carouselPattern = /(?:^|\n)(?:Slide\s*\d+|📷\s*\d+|---|\*\*\d+\*\*)/i;
    const threadPattern = /(?:^|\n)(?:Tweet\s*\d+|🧵\s*\d+|\d+\/\d+)/i;
    
    if (carouselPattern.test(text)) {
      const slides = text.split(/(?:\n---\n|\nSlide\s*\d+[:\s]*|\n📷\s*\d+[:\s]*)/i).filter(s => s.trim());
      return { type: "carousel", slides };
    }
    
    if (threadPattern.test(text)) {
      const slides = text.split(/(?:\nTweet\s*\d+[:\s]*|\n🧵\s*\d+[:\s]*|\n\d+\/\d+[:\s]*)/i).filter(s => s.trim());
      return { type: "thread", slides };
    }
    
    return { type: "text", slides: [text] };
  };

  const structured = parseStructuredContent(content);

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden transition-all",
      config.borderColor,
      config.bgColor
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-5 w-5 rounded flex items-center justify-center",
            config.bgColor
          )}>
            <Icon className={cn("h-3 w-3", config.color)} />
          </div>
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", config.color)}>
            {config.label}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={handleCopy}
            title="Copiar conteúdo"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
          {onOpenFullView && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onOpenFullView}
              title="Ver conteúdo completo"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
          {onToggleExpand && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onToggleExpand}
            >
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Thumbnail for YouTube */}
      {urlType === "youtube" && thumbnail && (
        <div className="relative aspect-video bg-black">
          <img 
            src={thumbnail} 
            alt={title || "Video thumbnail"} 
            className="w-full h-full object-cover"
          />
          {metadata?.duration && (
            <Badge 
              variant="secondary" 
              className="absolute bottom-2 right-2 text-[10px] bg-black/80 text-white"
            >
              {formatDuration(metadata.duration)}
            </Badge>
          )}
        </div>
      )}

      {/* Title & Metadata */}
      <div className="px-3 py-2 space-y-1.5">
        {title && (
          <h4 className="font-medium text-sm line-clamp-2 leading-tight">
            {title}
          </h4>
        )}
        
        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {metadata?.channel && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {metadata.channel}
            </span>
          )}
          {metadata?.author && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {metadata.author}
            </span>
          )}
          {metadata?.source && (
            <span className="flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              {metadata.source}
            </span>
          )}
          {metadata?.publishDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {metadata.publishDate}
            </span>
          )}
          {metadata?.duration && urlType !== "youtube" && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(metadata.duration)}
            </span>
          )}
          {metadata?.views && (
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {metadata.views} views
            </span>
          )}
        </div>

        {/* Library item type badge */}
        {metadata?.libraryItemType && (
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-[9px] h-4">
              {metadata.libraryItemType}
            </Badge>
          </div>
        )}
      </div>

      <Separator className="opacity-50" />

      {/* Content Preview */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-medium text-muted-foreground">
            {urlType === "youtube" ? "📝 Transcrição" : "📄 Conteúdo"}
          </span>
          <Badge variant="secondary" className="text-[9px] h-4">
            {formatWordCount(wordCount)}
          </Badge>
          {urlType !== "youtube" && (
            <Badge variant="secondary" className="text-[9px] h-4">
              {estimateReadingTime(wordCount)}
            </Badge>
          )}
        </div>

        <ScrollArea className={cn(
          "transition-all duration-300",
          isExpanded ? "max-h-[300px]" : `max-h-[${maxCollapsedHeight}px]`
        )} style={{ maxHeight: isExpanded ? 300 : maxCollapsedHeight }}>
          {structured.type !== "text" ? (
            // Structured content (carousel/thread)
            <div className="space-y-3">
              {structured.slides.map((slide, index) => (
                <div 
                  key={index}
                  className="relative pl-4 border-l-2 border-primary/30"
                >
                  <Badge 
                    variant="outline" 
                    className="absolute -left-2.5 top-0 text-[8px] h-4 px-1.5 bg-background"
                  >
                    {structured.type === "carousel" ? `📷 ${index + 1}` : `🧵 ${index + 1}`}
                  </Badge>
                  <div className="pt-1 text-[11px] leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{slide.trim()}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Regular text/markdown content
            <div className="text-[11px] leading-relaxed prose prose-sm dark:prose-invert max-w-none 
              prose-headings:text-xs prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
              prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
              <ReactMarkdown>
                {isExpanded ? content : content.substring(0, 500) + (content.length > 500 ? "..." : "")}
              </ReactMarkdown>
            </div>
          )}
        </ScrollArea>

        {/* Expand prompt */}
        {!isExpanded && content.length > 500 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 h-6 text-[10px]"
            onClick={onToggleExpand}
          >
            <ChevronDown className="h-3 w-3 mr-1" />
            Ver conteúdo completo ({formatWordCount(wordCount)})
          </Button>
        )}
      </div>
    </div>
  );
}

export const ExtractedContentPreview = memo(ExtractedContentPreviewComponent);
