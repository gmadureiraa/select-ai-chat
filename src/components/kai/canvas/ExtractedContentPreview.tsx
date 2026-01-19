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
  Check,
  AlertCircle,
  Image as ImageIcon
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
  transcriptUnavailable?: boolean;
}

interface ExtractedContentPreviewProps {
  content: string;
  title?: string;
  thumbnail?: string;
  urlType?: "youtube" | "article" | "newsletter" | "library";
  metadata?: ContentMetadata;
  images?: string[];
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
  images = [],
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

  // Images to show (for articles/newsletters)
  const displayImages = images.slice(0, 4);
  const hasMoreImages = images.length > 4;

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden transition-all nodrag",
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
          {images.length > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 gap-0.5">
              <ImageIcon className="h-2.5 w-2.5" />
              {images.length}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
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
              onClick={(e) => { e.stopPropagation(); onOpenFullView(); }}
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
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
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

      {/* Image Gallery for articles/newsletters */}
      {urlType !== "youtube" && displayImages.length > 0 && (
        <div className="p-2 border-b border-border/30">
          <div className={cn(
            "grid gap-1",
            displayImages.length === 1 ? "grid-cols-1" : 
            displayImages.length === 2 ? "grid-cols-2" : 
            displayImages.length === 3 ? "grid-cols-3" : "grid-cols-4"
          )}>
            {displayImages.map((img, i) => (
              <div key={i} className="relative aspect-video rounded overflow-hidden bg-muted">
                <img 
                  src={img} 
                  alt={`Imagem ${i + 1}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); onOpenFullView?.(); }}
                />
                {hasMoreImages && i === displayImages.length - 1 && (
                  <div 
                    className="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onOpenFullView?.(); }}
                  >
                    <span className="text-white text-xs font-medium">+{images.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
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
        {/* Check if transcript is unavailable for YouTube */}
        {urlType === "youtube" && (metadata as ContentMetadata & { transcriptUnavailable?: boolean })?.transcriptUnavailable ? (
          <div className="flex flex-col items-center justify-center py-4 text-center space-y-2">
            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-amber-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Transcrição não disponível
              </p>
              <p className="text-[10px] text-muted-foreground/70 max-w-[200px]">
                Este vídeo não possui legendas disponíveis. Você ainda pode usar o título e thumbnail como referência.
              </p>
            </div>
            {metadata?.sourceUrl && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] gap-1.5"
                onClick={() => window.open(metadata.sourceUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3" />
                Assistir no YouTube
              </Button>
            )}
          </div>
        ) : (
          <>
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
              "transition-all duration-300"
            )} style={{ maxHeight: isExpanded ? 400 : maxCollapsedHeight }}>
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

            {/* Expand/Full View buttons */}
            <div className="flex items-center gap-2 mt-2">
              {!isExpanded && content.length > 500 && onToggleExpand && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-7 text-[10px]"
                  onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                >
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Expandir
                </Button>
              )}
              {onOpenFullView && (
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-7 text-[10px] gap-1"
                  onClick={(e) => { e.stopPropagation(); onOpenFullView(); }}
                >
                  <Maximize2 className="h-3 w-3" />
                  Ver Completo
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const ExtractedContentPreview = memo(ExtractedContentPreviewComponent);
