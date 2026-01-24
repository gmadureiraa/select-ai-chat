import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { UnifiedContentItem } from "@/hooks/useUnifiedContent";

interface ContentEditDialogProps {
  item: UnifiedContentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { title?: string; content?: string; content_url?: string }) => Promise<void>;
  isLoading?: boolean;
}

export function ContentEditDialog({ 
  item, 
  open, 
  onOpenChange, 
  onSave,
  isLoading = false
}: ContentEditDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentUrl, setContentUrl] = useState("");

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      setTitle(item.title || "");
      setContent(item.content || "");
      setContentUrl(item.permalink || "");
    }
  }, [item]);

  if (!item) return null;

  const handleSave = async () => {
    await onSave({
      title: title !== item.title ? title : undefined,
      content: content !== item.content ? content : undefined,
      content_url: contentUrl !== item.permalink ? contentUrl : undefined,
    });
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  // Some sources don't support title editing
  const canEditTitle = item._source === 'client_content_library';
  // URL field name varies by source
  const urlLabel = item._source === 'linkedin_posts' ? 'URL do Post' : 'URL do Conteúdo';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Conteúdo</DialogTitle>
          <DialogDescription>
            Faça alterações no conteúdo. As mudanças serão salvas na fonte original.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title - only for content library items */}
          {canEditTitle && (
            <div className="space-y-2">
              <Label htmlFor="edit-title">Título</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título do conteúdo"
              />
            </div>
          )}

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="edit-content">
              {item._source === 'instagram_posts' ? 'Legenda' : 'Conteúdo'}
            </Label>
            <Textarea
              id="edit-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder="Conteúdo do post..."
            />
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="edit-url">{urlLabel} (opcional)</Label>
            <Input
              id="edit-url"
              value={contentUrl}
              onChange={(e) => setContentUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
