import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ReferenceItem } from "@/hooks/useReferenceLibrary";
import { ExternalLink } from "lucide-react";

interface ReferenceViewDialogProps {
  open: boolean;
  onClose: () => void;
  reference: ReferenceItem | null;
}

const REFERENCE_TYPE_LABELS: Record<string, string> = {
  tweet: "Tweet",
  thread: "Thread",
  carousel: "Carrossel",
  reel: "Reel",
  video: "Vídeo",
  article: "Artigo",
  other: "Outro"
};

export function ReferenceViewDialog({ open, onClose, reference }: ReferenceViewDialogProps) {
  if (!reference) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-xl">{reference.title}</DialogTitle>
            <Badge variant="outline">
              {REFERENCE_TYPE_LABELS[reference.reference_type] || reference.reference_type}
            </Badge>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          {reference.source_url && (
            <div>
              <a
                href={reference.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Ver fonte original
              </a>
            </div>
          )}
          {reference.metadata?.image_urls && reference.metadata.image_urls.length > 0 && (
            <div className="space-y-2">
              {reference.metadata.image_urls.map((url: string, index: number) => (
                <img
                  key={index}
                  src={url}
                  alt={`${reference.title} - imagem ${index + 1}`}
                  className="w-full rounded-lg border"
                />
              ))}
            </div>
          )}
          {reference.thumbnail_url && (
            <div>
              <img
                src={reference.thumbnail_url}
                alt={reference.title}
                className="w-full rounded-lg"
              />
            </div>
          )}
          <div className="p-4 bg-muted/30 rounded-lg">
            <pre className="whitespace-pre-wrap text-sm font-mono">
              {reference.content}
            </pre>
          </div>
          <div className="text-xs text-muted-foreground pt-4 border-t">
            Adicionado em {new Date(reference.created_at).toLocaleDateString("pt-BR")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
