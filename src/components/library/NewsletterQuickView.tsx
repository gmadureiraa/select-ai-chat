import { FileText, Copy, ExternalLink, Wand2, Check, Calendar, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContentItem } from "@/hooks/useContentLibrary";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { toast } from "sonner";

interface NewsletterQuickViewProps {
  newsletter: ContentItem | null;
  open: boolean;
  onClose: () => void;
  onSendToCanvas?: (content: ContentItem) => void;
}

export function NewsletterQuickView({
  newsletter,
  open,
  onClose,
  onSendToCanvas,
}: NewsletterQuickViewProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard();

  if (!newsletter) return null;

  const handleCopyContent = async () => {
    const success = await copyToClipboard(newsletter.content);
    if (success) {
      toast.success("Conteúdo copiado!");
    }
  };

  const handleCopyTitle = async () => {
    const success = await copyToClipboard(newsletter.title);
    if (success) {
      toast.success("Título copiado!");
    }
  };

  const wordCount = newsletter.content.split(/\s+/).filter(Boolean).length;
  const charCount = newsletter.content.length;
  const readingTime = Math.ceil(wordCount / 200); // Average reading speed

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <span className="truncate">{newsletter.title}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-2 pb-3 border-b shrink-0">
          <Button size="sm" onClick={handleCopyContent} className="gap-2">
            {isCopied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {isCopied ? "Copiado!" : "Copiar Tudo"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopyTitle}>
            Copiar Título
          </Button>
          {newsletter.content_url && (
            <Button size="sm" variant="outline" asChild>
              <a
                href={newsletter.content_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Original
              </a>
            </Button>
          )}
          {onSendToCanvas && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                onSendToCanvas(newsletter);
                onClose();
              }}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" />
              Usar na Fábrica
            </Button>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="whitespace-pre-wrap text-sm leading-relaxed pr-4">
            {newsletter.content}
          </div>
        </ScrollArea>

        {/* Metadata Footer */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-3 border-t shrink-0">
          <div className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            <span>{charCount.toLocaleString("pt-BR")} caracteres</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>{wordCount.toLocaleString("pt-BR")} palavras</span>
          </div>
          <div className="flex items-center gap-1">
            <span>~{readingTime} min de leitura</span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Calendar className="h-3 w-3" />
            <span>
              {new Date(newsletter.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
