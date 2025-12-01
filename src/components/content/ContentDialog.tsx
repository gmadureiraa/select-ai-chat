import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentItem, ContentType, CreateContentData } from "@/hooks/useContentLibrary";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";

interface ContentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateContentData) => void;
  content?: ContentItem;
}

export const ContentDialog = ({ open, onClose, onSave, content }: ContentDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<CreateContentData>({
    title: "",
    content_type: "newsletter",
    content: "",
    content_url: "",
    thumbnail_url: "",
  });
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  useEffect(() => {
    if (content) {
      setFormData({
        title: content.title,
        content_type: content.content_type,
        content: content.content,
        content_url: content.content_url || "",
        thumbnail_url: content.thumbnail_url || "",
      });
      setUploadedImages(content.metadata?.image_urls || []);
    } else {
      setFormData({
        title: "",
        content_type: "newsletter",
        content: "",
        content_url: "",
        thumbnail_url: "",
      });
      setUploadedImages([]);
    }
  }, [content, open]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedImages.length + files.length > 10) {
      toast({
        title: "Limite excedido",
        description: "Você pode adicionar no máximo 10 imagens.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const newImageUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `content-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('client-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('client-files')
          .getPublicUrl(filePath);

        newImageUrls.push(publicUrl);
      }

      setUploadedImages([...uploadedImages, ...newImageUrls]);
      toast({
        title: "Imagens carregadas",
        description: `${newImageUrls.length} imagem(ns) adicionada(s)`,
      });
    } catch (error) {
      console.error("Error uploading images:", error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer upload das imagens",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTranscribe = async () => {
    if (uploadedImages.length === 0) {
      toast({
        title: "Nenhuma imagem",
        description: "Adicione pelo menos uma imagem para transcrever",
        variant: "destructive",
      });
      return;
    }

    setIsTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-images', {
        body: { imageUrls: uploadedImages }
      });

      if (error) throw error;

      const existingContent = formData.content.trim();
      const newContent = existingContent 
        ? `${existingContent}\n\n--- CONTEÚDO DAS IMAGENS ---\n${data.transcription}`
        : data.transcription;

      setFormData({ ...formData, content: newContent });
      toast({
        title: "Transcrição concluída",
        description: "O conteúdo das imagens foi adicionado",
      });
    } catch (error) {
      console.error("Error transcribing images:", error);
      toast({
        title: "Erro",
        description: "Não foi possível transcrever as imagens",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataWithImages = {
      ...formData,
      metadata: {
        ...formData.metadata,
        image_urls: uploadedImages,
      },
    };
    onSave(dataWithImages);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{content ? "Editar Conteúdo" : "Adicionar Conteúdo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Newsletter Semanal #15"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content_type">Tipo de Conteúdo</Label>
            <Select
              value={formData.content_type}
              onValueChange={(value) => setFormData({ ...formData, content_type: value as ContentType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newsletter">Newsletter</SelectItem>
                <SelectItem value="carousel">Carrossel Instagram</SelectItem>
                <SelectItem value="reel_script">Roteiro Reels</SelectItem>
                <SelectItem value="video_script">Roteiro Vídeo</SelectItem>
                <SelectItem value="blog_post">Post de Blog</SelectItem>
                <SelectItem value="social_post">Post Social</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Imagens (até 10)</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={isUploading || uploadedImages.length >= 10}
                  className="flex-1"
                />
                {uploadedImages.length > 0 && (
                  <Button
                    type="button"
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    variant="secondary"
                  >
                    {isTranscribing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Transcrevendo...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Transcrever
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {uploadedImages.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                {uploadedImages.length}/10 imagens • Faça upload e clique em "Transcrever" para extrair o conteúdo
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Conteúdo</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Cole o conteúdo completo aqui ou transcreva das imagens..."
              className="min-h-[300px] font-mono text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content_url">URL do Conteúdo (opcional)</Label>
            <Input
              id="content_url"
              value={formData.content_url}
              onChange={(e) => setFormData({ ...formData, content_url: e.target.value })}
              placeholder="https://..."
              type="url"
            />
            <p className="text-xs text-muted-foreground">
              Link do conteúdo publicado (facilita leitura pela IA)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="thumbnail_url">URL da Thumbnail (opcional)</Label>
            <Input
              id="thumbnail_url"
              value={formData.thumbnail_url}
              onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
              placeholder="https://..."
              type="url"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {content ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
