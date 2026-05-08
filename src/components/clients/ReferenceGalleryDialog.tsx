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
import { RefSceneStrip, type RefScene } from "./RefSceneStrip";

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
  const slidesText = Array.isArray(meta.slides_text)
    ? (meta.slides_text as string[])
    : [];
  const transcribedText = (meta.transcribed_text as string | undefined) ?? "";

  // Cenas-chave (Reels Viral pattern): metadata.scenes ou metadata.script.scenes
  // Aceita 2 shapes:
  //   - { scenes: [{ label, timestamp_start, timestamp_end, screenshot_url, text }] }
  //   - { script: { scenes: [{ papel, tempo, copy, visual, broll }] } }   ← adapt-viral-reel
  const scenesRaw =
    (Array.isArray(meta.scenes) && meta.scenes) ||
    (meta.script && Array.isArray((meta.script as any).scenes) && (meta.script as any).scenes) ||
    null;
  const scenes: RefScene[] = scenesRaw ?? [];

  // Métricas (analytics tipo conteúdo de performance) — pega de metrics{} mais top-level
  const performanceMetrics: Record<string, number | null> = {
    likes: metrics.likes ?? (meta.likes as number | undefined) ?? null,
    comments: metrics.comments ?? (meta.comments as number | undefined) ?? null,
    views: metrics.views ?? (meta.views as number | undefined) ?? null,
    shares: metrics.shares ?? (meta.shares as number | undefined) ?? null,
    saves: metrics.saves ?? (meta.saves as number | undefined) ?? null,
  };
  const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
  const isVideoFormat = format === "reel" || format === "short_video" || scenes.length > 0;

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
          <div className="p-6 space-y-6">
            {/* Tags + format */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Cenas-chave (Reels Viral pattern) — só se tem scenes[] */}
            {isVideoFormat && scenes.length > 0 && (
              <RefSceneStrip scenes={scenes} />
            )}

            {/* Galeria de imagens (carrossel/static) */}
            {allImages.length > 0 && !isVideoFormat && (
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

            {/* Métricas (igual conteúdo de performance) */}
            {Object.values(performanceMetrics).some((v) => v != null) && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {performanceMetrics.likes != null && (
                  <MetricCard
                    icon={<Heart className="h-3.5 w-3.5 text-rose-500" />}
                    label="Curtidas"
                    value={formatNumber(performanceMetrics.likes)}
                  />
                )}
                {performanceMetrics.comments != null && (
                  <MetricCard
                    icon={<MessageCircle className="h-3.5 w-3.5 text-blue-500" />}
                    label="Comentários"
                    value={formatNumber(performanceMetrics.comments)}
                  />
                )}
                {performanceMetrics.views != null && (
                  <MetricCard
                    icon={<Eye className="h-3.5 w-3.5 text-purple-500" />}
                    label="Visualizações"
                    value={formatNumber(performanceMetrics.views)}
                  />
                )}
                {performanceMetrics.shares != null && (
                  <MetricCard
                    icon={<ChevronRight className="h-3.5 w-3.5 text-emerald-500" />}
                    label="Compart."
                    value={formatNumber(performanceMetrics.shares)}
                  />
                )}
                {performanceMetrics.saves != null && (
                  <MetricCard
                    icon={<FileText className="h-3.5 w-3.5 text-amber-500" />}
                    label="Salvos"
                    value={formatNumber(performanceMetrics.saves)}
                  />
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

            {/* Texto por slide (se for carrossel) */}
            {slidesText.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Texto extraído ({slidesText.length}{" "}
                  {slidesText.length === 1 ? "slide" : "slides"})
                </p>
                <div className="space-y-2">
                  {slidesText.map((slideText, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border bg-muted/20 transition-colors ${
                        idx === imgIdx ? "border-primary ring-1 ring-primary/30" : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">
                          Slide {idx + 1}
                        </Badge>
                        {idx === imgIdx && (
                          <Badge variant="secondary" className="text-[10px]">
                            visualizando
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {slideText}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Caption / conteúdo full (fallback se não tem slides_text) */}
            {slidesText.length === 0 && reference.content && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Caption / conteúdo
                </p>
                <div className="text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
                  {reference.content}
                </div>
              </div>
            )}

            {/* Caption original quando há slides_text (mostra além do texto) */}
            {slidesText.length > 0 && reference.content && transcribedText &&
              !reference.content.startsWith(transcribedText.slice(0, 20)) && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    Caption original
                  </p>
                  <div className="text-sm whitespace-pre-wrap text-foreground/80 leading-relaxed">
                    {reference.content.split("\n\n---\n\n")[0]}
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

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 p-2 rounded-md border bg-muted/20">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
