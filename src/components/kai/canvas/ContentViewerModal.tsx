import { memo, useState } from "react";
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  Youtube, 
  FileText, 
  Library,
  ExternalLink,
  Clock,
  User,
  Calendar,
  Hash
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { ContentMetadata } from "./ExtractedContentPreview";

interface ContentViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  title?: string;
  thumbnail?: string;
  urlType?: "youtube" | "article" | "newsletter" | "library";
  metadata?: ContentMetadata;
  sourceUrl?: string;
}

const TYPE_CONFIG = {
  youtube: {
    icon: Youtube,
    label: "Transcrição do YouTube",
    color: "text-red-500",
  },
  article: {
    icon: FileText,
    label: "Artigo",
    color: "text-blue-500",
  },
  newsletter: {
    icon: FileText,
    label: "Newsletter",
    color: "text-purple-500",
  },
  library: {
    icon: Library,
    label: "Conteúdo da Biblioteca",
    color: "text-amber-500",
  },
};

function ContentViewerModalComponent({
  open,
  onOpenChange,
  content,
  title,
  thumbnail,
  urlType = "article",
  metadata,
  sourceUrl,
}: ContentViewerModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"formatted" | "raw">("formatted");

  const config = TYPE_CONFIG[urlType] || TYPE_CONFIG.article;
  const Icon = config.icon;
  const wordCount = metadata?.wordCount || content.split(/\s+/).length;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "content"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Extract YouTube video ID for embed
  const getYoutubeEmbedUrl = (url?: string): string | null => {
    if (!url) return null;
    
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }
    
    return null;
  };

  const youtubeEmbedUrl = urlType === "youtube" ? getYoutubeEmbedUrl(sourceUrl || metadata?.sourceUrl) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("h-5 w-5", config.color)} />
                <span className={cn("text-sm font-medium", config.color)}>
                  {config.label}
                </span>
              </div>
              <DialogTitle className="text-xl font-semibold line-clamp-2">
                {title || "Conteúdo Extraído"}
              </DialogTitle>
              
              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {metadata?.channel && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    {metadata.channel}
                  </span>
                )}
                {metadata?.author && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    {metadata.author}
                  </span>
                )}
                {metadata?.publishDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {metadata.publishDate}
                  </span>
                )}
                {metadata?.duration && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {metadata.duration}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Hash className="h-4 w-4" />
                  {wordCount.toLocaleString()} palavras
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
              {sourceUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-2"
                >
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </a>
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {/* YouTube embed option */}
          {urlType === "youtube" && youtubeEmbedUrl && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="h-full flex flex-col">
              <div className="px-6 pt-4 border-b flex-shrink-0">
                <TabsList className="h-9">
                  <TabsTrigger value="formatted" className="text-sm">
                    📝 Transcrição
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="text-sm">
                    🎬 Vídeo
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="formatted" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="raw" className="flex-1 m-0 p-6 overflow-hidden">
                <div className="w-full h-full rounded-lg overflow-hidden bg-black">
                  <iframe
                    src={youtubeEmbedUrl}
                    title={title || "YouTube Video"}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Regular content */}
          {(urlType !== "youtube" || !youtubeEmbedUrl) && (
            <ScrollArea className="h-full">
              {/* Thumbnail */}
              {thumbnail && (
                <div className="relative aspect-video max-h-[200px] bg-muted overflow-hidden">
                  <img 
                    src={thumbnail} 
                    alt={title || "Thumbnail"} 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              <div className="p-6 prose prose-sm dark:prose-invert max-w-none
                prose-headings:font-semibold prose-headings:mt-6 prose-headings:mb-3
                prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1
                prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-4
                prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-muted prose-pre:p-4">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const ContentViewerModal = memo(ContentViewerModalComponent);
