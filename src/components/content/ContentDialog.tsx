import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentItem, ContentType, CreateContentData } from "@/hooks/useContentLibrary";

interface ContentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateContentData) => void;
  content?: ContentItem;
}

export const ContentDialog = ({ open, onClose, onSave, content }: ContentDialogProps) => {
  const [formData, setFormData] = useState<CreateContentData>({
    title: "",
    content_type: "newsletter",
    content: "",
    thumbnail_url: "",
  });

  useEffect(() => {
    if (content) {
      setFormData({
        title: content.title,
        content_type: content.content_type,
        content: content.content,
        thumbnail_url: content.thumbnail_url || "",
      });
    } else {
      setFormData({
        title: "",
        content_type: "newsletter",
        content: "",
        thumbnail_url: "",
      });
    }
  }, [content, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
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
            <Label htmlFor="content">Conteúdo</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Cole o conteúdo completo aqui..."
              className="min-h-[300px] font-mono text-sm"
              required
            />
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
