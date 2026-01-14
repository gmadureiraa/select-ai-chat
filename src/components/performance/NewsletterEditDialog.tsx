import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  Save,
  Loader2,
  ExternalLink,
  FileText,
  Video,
  Image as ImageIcon,
} from "lucide-react";
import { PostImagesManager } from "./PostImagesManager";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface NewsletterEditDialogProps {
  newsletter: {
    id: string;
    client_id: string;
    title: string;
    content: string;
    content_url?: string | null;
    thumbnail_url?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewsletterEditDialog({
  newsletter,
  open,
  onOpenChange,
}: NewsletterEditDialogProps) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    content_url: "",
    thumbnail_url: "",
    images: [] as string[],
    video_url: "",
  });

  useEffect(() => {
    if (newsletter) {
      const metadata = newsletter.metadata as any;
      setFormData({
        title: newsletter.title || "",
        content: newsletter.content || "",
        content_url: newsletter.content_url || "",
        thumbnail_url: newsletter.thumbnail_url || "",
        images: Array.isArray(metadata?.images) ? metadata.images : [],
        video_url: metadata?.video_url || "",
      });
    }
  }, [newsletter]);

  const handleSave = async () => {
    if (!newsletter) return;

    setIsSaving(true);
    try {
      const currentMetadata = (newsletter.metadata as any) || {};

      const { error } = await supabase
        .from("client_content_library")
        .update({
          title: formData.title,
          content: formData.content,
          content_url: formData.content_url || null,
          thumbnail_url: formData.thumbnail_url || null,
          metadata: {
            ...currentMetadata,
            images: formData.images,
            video_url: formData.video_url || null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", newsletter.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["client-content-library"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-posts"] });
      queryClient.invalidateQueries({ queryKey: ["platform-metrics"] });

      toast.success("Newsletter atualizada com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating newsletter:", error);
      toast.error("Erro ao atualizar newsletter");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTranscribe = (transcription: string) => {
    const parts: string[] = [];
    if (formData.content) parts.push(formData.content);
    parts.push("\n\n---\n\n## Transcrição das Imagens\n\n" + transcription);
    updateField("content", parts.join(""));
  };

  if (!newsletter) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-orange-500" />
            Editar Newsletter
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Title */}
          <div>
            <Label className="text-xs text-muted-foreground">Título</Label>
            <Input
              value={formData.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Título da newsletter..."
              className="h-9"
            />
          </div>

          {/* URL */}
          <div>
            <Label className="text-xs text-muted-foreground">
              URL da Newsletter
            </Label>
            <div className="flex gap-2">
              <Input
                value={formData.content_url}
                onChange={(e) => updateField("content_url", e.target.value)}
                placeholder="https://newsletter.beehiiv.com/p/..."
                className="h-8 text-sm"
              />
              {formData.content_url && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  asChild
                >
                  <a
                    href={formData.content_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Content Tabs */}
          <Tabs defaultValue="text" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text" className="gap-1">
                <FileText className="h-4 w-4" />
                Texto
              </TabsTrigger>
              <TabsTrigger value="images" className="gap-1">
                <ImageIcon className="h-4 w-4" />
                Imagens
              </TabsTrigger>
              <TabsTrigger value="video" className="gap-1">
                <Video className="h-4 w-4" />
                Vídeo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Conteúdo (Markdown suportado)
                </Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => updateField("content", e.target.value)}
                  placeholder="Conteúdo da newsletter em Markdown..."
                  className="min-h-[300px] text-sm resize-none font-mono"
                />
              </div>
            </TabsContent>

            <TabsContent value="images" className="mt-4 space-y-4">
              <PostImagesManager
                images={formData.images}
                onChange={(images) => updateField("images", images)}
                clientId={newsletter.client_id}
                onTranscribe={handleTranscribe}
              />

              <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
                <p className="font-medium">Opções de imagem:</p>
                <p>
                  • <strong>Adicionar</strong>: Anexa imagens à newsletter
                </p>
                <p>
                  • <strong>Transcrever</strong>: Extrai texto das imagens e
                  adiciona ao conteúdo
                </p>
              </div>
            </TabsContent>

            <TabsContent value="video" className="mt-4 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">
                  URL do Vídeo (YouTube, Vimeo, etc.)
                </Label>
                <Input
                  value={formData.video_url}
                  onChange={(e) => updateField("video_url", e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="h-9"
                />
              </div>

              {formData.video_url && (
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  {formData.video_url.includes("youtube") ||
                  formData.video_url.includes("youtu.be") ? (
                    <iframe
                      src={getYouTubeEmbedUrl(formData.video_url)}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  ) : formData.video_url.includes("vimeo") ? (
                    <iframe
                      src={getVimeoEmbedUrl(formData.video_url)}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Video className="h-8 w-8" />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getYouTubeEmbedUrl(url: string): string {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  const videoId = match && match[2].length === 11 ? match[2] : null;
  return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
}

function getVimeoEmbedUrl(url: string): string {
  const regExp = /vimeo\.com\/(\d+)/;
  const match = url.match(regExp);
  const videoId = match ? match[1] : null;
  return videoId ? `https://player.vimeo.com/video/${videoId}` : "";
}
