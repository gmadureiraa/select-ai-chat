/**
 * Dialog que mostra uma referência (`client_reference_library`) com:
 *  - Galeria de imagens (next/prev) quando metadata.images[] tem múltiplas
 *  - Format chip ('carousel' / 'reel' / 'static' / 'tweet' / 'newsletter' / 'article')
 *  - Source handle, métricas, hook, link pro post original
 *  - Caption/conteúdo completo
 *
 * Usado pelo ClientReferencesManager pra exibir refs visuais (swipes IG etc).
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  MessageCircle,
  Eye,
  Layers,
  Film,
  Image as ImageIcon,
  Hash,
  Mail,
  FileText,
  AtSign,
} from "lucide-react";
import type { ReferenceItem } from "@/hooks/useReferenceLibrary";

interface Props {
  reference: ReferenceItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORMAT_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  carousel: { label: "Carrossel", icon: Layers, color: "text-purple-500" },
  reel: { label: "Reel", icon: Film, color: "text-rose-500" },
  static: { label: "Imagem única", icon: ImageIcon, color: "text-sky-500" },
  tweet: { label: "Tweet", icon: AtSign, color: "text-cyan-500" },
  thread: { label: "Thread", icon: Hash, color: "text-cyan-600" },
  newsletter: { label: "Newsletter", icon: Mail, color: "text-emerald-500" },
  article: { label: "Artigo", icon: FileText, color: "text-amber-500" },
  email: { label: "Email marketing", icon: Mail, color: "text-emerald-600" },
};

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ReferenceGalleryDialog({ reference, open, onOpenChange }: Props) {
  const [imgIdx, setImgIdx] = useState(0);

  if (!reference) return null;

  const meta = (reference.metadata as Record<string, any> | null) ?? {};
  const format = (meta.format as string) ?? reference.reference_type ?? "static";
  const images = Array.isArray(meta.images) ? (meta.images as string[]) : [];
  const fallbackImages = reference.thumbnail_url ? [reference.thumbnail_url] : [];
  const allImages = images.length > 0 ? images : fallbackImages;

  const fmt = FORMAT_META[format] ?? FORMAT_META.static;
  const FormatIcon = fmt.icon;

  const handleNext = () => setImgIdx((i) => Math.min(allImages.length - 1, i + 1));
  const handlePrev = () => setImgIdx((i) => Math.max(0, i - 1));

  const sourceHandle = meta.source_handle as string | undefined;
  const platform = meta.platform as string | undefined;
  const metrics = (meta.metrics as Record<string, number | null>) ?? {};
  const hook = meta.hook as string | undefined;
  const postedAt = meta.posted_at as string | null | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 bg-background border-2 shadow-2xl">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-3 border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted/50">
                <FormatIcon className={`h-5 w-5 ${fmt.color}`} />
              </div>
              <div>
                <DialogTitle className="text-base flex items-center gap-2 flex-wrap">
                  <span>{fmt.label}</span>
                  {sourceHandle && (
                    <Badge variant="outline" className="text-[10px]">
                      @{sourceHandle}
                    </Badge>
                  )}
                  {allImages.length > 1 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {allImages.length} imagens
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {postedAt
                    ? `Publicado em ${new Date(postedAt).toLocaleDateString("pt-BR")}`
                    : "Referência salva"}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-4">
            {/* Galeria */}
            {allImages.length > 0 && (
              <div className="relative rounded-lg overflow-hidden border bg-muted/20">
                <img
                  src={allImages[imgIdx]}
                  alt={`Slide ${imgIdx + 1}`}
                  className="w-full max-h-[55vh] object-contain bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://placehold.co/600x600/1a1a2e/666?text=📄";
                  }}
                />

                {allImages.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handlePrev}
                      disabled={imgIdx === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/90 hover:bg-background border"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleNext}
                      disabled={imgIdx === allImages.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/90 hover:bg-background border"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 rounded-full px-3 py-1 border text-xs font-medium">
                      <span>
                        {imgIdx + 1} / {allImages.length}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Métricas */}
            {(metrics.likes != null || metrics.comments != null || metrics.views != null) && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {metrics.likes != null && (
                  <span className="flex items-center gap-1.5">
                    <Heart className="h-4 w-4" />
                    {formatNumber(metrics.likes)}
                  </span>
                )}
                {metrics.comments != null && (
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4" />
                    {formatNumber(metrics.comments)}
                  </span>
                )}
                {metrics.views != null && (
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    {formatNumber(metrics.views)}
                  </span>
                )}
                {platform && (
                  <Badge variant="outline" className="ml-auto text-[10px] uppercase tracking-wider">
                    {platform}
                  </Badge>
                )}
              </div>
            )}

            {/* Hook */}
            {hook && (
              <div className="border-l-4 border-primary/40 pl-4 py-2 bg-muted/30 rounded-r-lg">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Hook
                </p>
                <p className="text-sm italic">"{hook}"</p>
              </div>
            )}

            {/* Conteúdo */}
            {reference.content && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Caption / conteúdo
                </p>
                <div className="text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
                  {reference.content}
                </div>
              </div>
            )}

            {/* Source URL */}
            {reference.source_url && (
              <div className="pt-3 border-t">
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <a
                    href={reference.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver original no {platform ?? "site"}
                  </a>
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
