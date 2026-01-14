import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { TwitterPost } from "@/types/twitter";
import { useUpdateTwitterPost } from "@/hooks/useTwitterMetrics";
import { PostImagesManager } from "./PostImagesManager";
import { toast } from "sonner";

interface TwitterPostEditDialogProps {
  post: TwitterPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TwitterPostEditDialog({ post, open, onOpenChange }: TwitterPostEditDialogProps) {
  const [formData, setFormData] = useState({
    content: "",
    full_content: "",
    images: [] as string[],
  });
  const [isSaving, setIsSaving] = useState(false);
  
  const updatePost = useUpdateTwitterPost();

  useEffect(() => {
    if (post) {
      setFormData({
        content: post.content || "",
        full_content: post.full_content || post.content || "",
        images: (post.images as string[]) || [],
      });
    }
  }, [post]);

  const handleSave = async () => {
    if (!post) return;
    
    setIsSaving(true);
    try {
      const updates: Partial<TwitterPost> = {
        content: formData.content,
        full_content: formData.full_content,
        images: formData.images,
        content_synced_at: formData.images.length > 0 || formData.full_content 
          ? new Date().toISOString() 
          : post.content_synced_at,
      };

      await updatePost.mutateAsync({ id: post.id, updates });
      toast.success("Tweet atualizado com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating post:", error);
      toast.error("Erro ao atualizar tweet");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImagesChange = (newImages: string[]) => {
    setFormData(prev => ({ ...prev, images: newImages }));
  };

  const handleTranscription = (transcription: string) => {
    setFormData(prev => ({
      ...prev,
      full_content: prev.full_content 
        ? `${prev.full_content}\n\n---\n\n${transcription}` 
        : transcription
    }));
  };

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Tweet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tweet Content */}
          <div className="space-y-2">
            <Label>Texto do Tweet</Label>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              rows={3}
              placeholder="Conteúdo do tweet..."
            />
          </div>

          {/* Images */}
          <PostImagesManager
            images={formData.images}
            onChange={handleImagesChange}
            onTranscribe={handleTranscription}
            clientId={post.client_id}
          />

          {/* Full Content */}
          <div className="space-y-2">
            <Label>Conteúdo Completo (texto + transcrições)</Label>
            <Textarea
              value={formData.full_content}
              onChange={(e) => setFormData(prev => ({ ...prev, full_content: e.target.value }))}
              rows={6}
              placeholder="Conteúdo completo com transcrições de imagens..."
              className="font-mono text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
