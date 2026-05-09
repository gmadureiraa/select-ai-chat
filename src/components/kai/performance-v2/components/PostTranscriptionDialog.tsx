// PostTranscriptionDialog — mostra (ou gera) transcrição completa de um post.
// Usado em PostsGrid e BestPostHighlight.
//
// Props:
//   - clientId: id do cliente
//   - post: MetricoolPost | qualquer obj com id/permalink/caption/imageUrl
//   - source: 'metricool' | 'instagram_posts' | 'planning' (default 'metricool')
//   - network: rede social (default 'instagram')
//   - postType: 'post' | 'carousel' | 'reel' | 'story' (auto-detectado se omitido)
//   - imageUrls / videoUrl: pra força gerar
//
// UI: mostra caption original, descrição visual (ou slides), reel scenes, full summary.
// Botão "Re-transcrever" força regeneração (force=true).
import * as React from "react";
import { Loader2, RefreshCw, Sparkles, Image as ImageIcon, Video, FileText } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  usePostTranscription,
  useTranscribePostMutation,
  type PostTranscription,
  type TranscriptionSource,
} from "@/hooks/usePostTranscription";

interface MinimalPost {
  id?: string | number;
  postId?: string;
  caption?: string;
  text?: string;
  content?: string;
  imageUrl?: string;
  thumbnail?: string;
  mediaUrl?: string;
  permalink?: string;
  url?: string;
  type?: string;
  videoUrl?: string;
  images?: string[];
  [key: string]: unknown;
}

export interface PostTranscriptionDialogProps {
  clientId: string;
  post: MinimalPost;
  source?: TranscriptionSource;
  network?: string;
  postType?: "post" | "carousel" | "reel" | "story";
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function resolvePostId(post: MinimalPost): string {
  return String(post.postId || post.id || post.permalink || post.url || "");
}

function resolveCaption(post: MinimalPost): string {
  return String(post.caption || post.text || post.content || "").trim();
}

function resolveImageUrls(post: MinimalPost): string[] {
  const urls: string[] = [];
  if (Array.isArray(post.images)) {
    for (const u of post.images) if (typeof u === "string" && u) urls.push(u);
  }
  if (urls.length === 0) {
    const single = post.imageUrl || post.thumbnail || post.mediaUrl;
    if (typeof single === "string" && single) urls.push(single);
  }
  return urls;
}

function resolveVideoUrl(post: MinimalPost): string | undefined {
  if (typeof post.videoUrl === "string" && post.videoUrl) return post.videoUrl;
  const meta = (post as any).metadata;
  if (meta && typeof meta === "object") {
    const v = meta.video_url || meta.videoUrl;
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

function resolvePostType(
  post: MinimalPost,
  override?: string,
): "post" | "carousel" | "reel" | "story" | string {
  if (override) return override;
  const t = (post.type || (post as any).post_type || "").toString().toLowerCase();
  if (t.includes("reel") || t === "video") return "reel";
  if (t.includes("carousel") || t.includes("album")) return "carousel";
  if (t.includes("story")) return "story";
  if (resolveImageUrls(post).length > 1) return "carousel";
  if (resolveVideoUrl(post)) return "reel";
  return "post";
}

export function PostTranscriptionDialog({
  clientId,
  post,
  source = "metricool",
  network = "instagram",
  postType,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: PostTranscriptionDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = openProp !== undefined ? openProp : internalOpen;
  const setOpen = onOpenChangeProp || setInternalOpen;

  const postId = resolvePostId(post);
  const caption = resolveCaption(post);
  const imageUrls = React.useMemo(() => resolveImageUrls(post), [post]);
  const videoUrl = resolveVideoUrl(post);
  const finalPostType = resolvePostType(post, postType);

  const {
    data: transcription,
    isLoading: isFetching,
    refetch,
  } = usePostTranscription(clientId, postId, source, open);

  const mutation = useTranscribePostMutation();

  const isReel = finalPostType === "reel";
  const isCarousel = finalPostType === "carousel";

  const trigger_ = trigger ?? (
    <Button variant="outline" size="sm" className="gap-1.5" type="button">
      <FileText className="h-3.5 w-3.5" />
      Transcrição
    </Button>
  );

  const handleGenerate = async (force = false) => {
    if (!clientId || !postId) return;
    await mutation.mutateAsync({
      clientId,
      postId,
      source,
      network,
      postType: finalPostType,
      imageUrls,
      videoUrl,
      caption,
      force,
    });
    refetch();
  };

  const isGenerating = mutation.isPending;
  const showGenerateButton = !isFetching && !transcription;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger_}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Transcrição do post
          </DialogTitle>
          <DialogDescription>
            {isCarousel
              ? "Carrossel descrito slide a slide via Gemini Vision."
              : isReel
                ? "Reel transcrito (áudio + cenas) via Gemini."
                : "Caption + descrição visual via Gemini Vision."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-2">
            {isFetching ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
              </div>
            ) : showGenerateButton ? (
              <EmptyState
                onGenerate={() => handleGenerate(false)}
                isGenerating={isGenerating}
              />
            ) : transcription ? (
              <TranscriptionView transcription={transcription} caption={caption} />
            ) : null}
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {transcription && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerate(true)}
              disabled={isGenerating}
              className="gap-1.5"
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {isGenerating ? "Re-transcrevendo…" : "Re-transcrever"}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({
  onGenerate,
  isGenerating,
}: {
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-10">
      <Sparkles className="h-8 w-8 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium">Sem transcrição ainda</p>
        <p className="text-xs text-muted-foreground mt-1">
          Gere agora pra extrair caption + descrição visual + cenas via Gemini.
        </p>
      </div>
      <Button size="sm" onClick={onGenerate} disabled={isGenerating} className="gap-1.5">
        {isGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        Gerar transcrição
      </Button>
    </div>
  );
}

function TranscriptionView({
  transcription,
  caption,
}: {
  transcription: PostTranscription;
  caption: string;
}) {
  const t = transcription;
  return (
    <div className="space-y-5 text-sm">
      {(t.caption || caption) && (
        <Section title="Caption original" icon={<FileText className="h-3.5 w-3.5" />}>
          <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
            {t.caption || caption}
          </p>
        </Section>
      )}

      {t.full_summary && (
        <Section title="Resumo executivo" icon={<Sparkles className="h-3.5 w-3.5" />}>
          <p className="leading-relaxed">{t.full_summary}</p>
        </Section>
      )}

      {t.carousel_slides && t.carousel_slides.length > 0 ? (
        <Section title={`Slides (${t.carousel_slides.length})`} icon={<ImageIcon className="h-3.5 w-3.5" />}>
          <div className="space-y-3">
            {t.carousel_slides.map((slide) => (
              <div key={slide.index} className="rounded-md border p-3 bg-muted/30">
                <div className="flex items-start gap-2">
                  <Badge variant="secondary" className="shrink-0">
                    Slide {slide.index + 1}
                  </Badge>
                  <p className="text-xs leading-relaxed flex-1">{slide.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : (
        t.visual_description && (
          <Section title="Descrição visual" icon={<ImageIcon className="h-3.5 w-3.5" />}>
            <p className="leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {t.visual_description}
            </p>
          </Section>
        )
      )}

      {t.reel_audio_transcript && (
        <Section title="Áudio do reel" icon={<Video className="h-3.5 w-3.5" />}>
          <p className="leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {t.reel_audio_transcript}
          </p>
        </Section>
      )}

      {t.reel_scenes && t.reel_scenes.length > 0 && (
        <Section title={`Cenas (${t.reel_scenes.length})`} icon={<Video className="h-3.5 w-3.5" />}>
          <ol className="space-y-2">
            {t.reel_scenes.map((scene, i) => (
              <li key={i} className="flex gap-3 items-start">
                <Badge variant="outline" className="shrink-0 tabular-nums text-xs">
                  {scene.start_sec}-{scene.end_sec}s
                </Badge>
                <span className="text-xs leading-relaxed flex-1">{scene.description}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {t.story_description && !t.visual_description && (
        <Section title="Story" icon={<ImageIcon className="h-3.5 w-3.5" />}>
          <p className="leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {t.story_description}
          </p>
        </Section>
      )}

      <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground border-t">
        <span>
          Gerado por <span className="font-mono">{t.model}</span> ·{" "}
          {new Date(t.updated_at).toLocaleString("pt-BR")}
        </span>
        {t.tokens_used > 0 && (
          <span className="tabular-nums">
            {t.tokens_used.toLocaleString("pt-BR")} tokens
          </span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h4 className="kai-eyebrow text-[10px] flex items-center gap-1.5">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}

export default PostTranscriptionDialog;
