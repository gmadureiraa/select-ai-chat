import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateReferenceData, ReferenceItem } from "@/hooks/useReferenceLibrary";

interface ReferenceDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateReferenceData) => void;
  reference?: ReferenceItem;
}

export function ReferenceDialog({ open, onClose, onSave, reference }: ReferenceDialogProps) {
  const [formData, setFormData] = useState<CreateReferenceData>({
    title: "",
    reference_type: "tweet",
    content: "",
    source_url: "",
    thumbnail_url: "",
  });

  useEffect(() => {
    if (reference) {
      setFormData({
        title: reference.title,
        reference_type: reference.reference_type,
        content: reference.content,
        source_url: reference.source_url || "",
        thumbnail_url: reference.thumbnail_url || "",
      });
    } else {
      setFormData({
        title: "",
        reference_type: "tweet",
        content: "",
        source_url: "",
        thumbnail_url: "",
      });
    }
  }, [reference, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {reference ? "Editar Referência" : "Adicionar Referência"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Tweet sobre estratégias de marketing"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference_type">Tipo de Referência</Label>
            <Select
              value={formData.reference_type}
              onValueChange={(value: any) => setFormData({ ...formData, reference_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tweet">Tweet</SelectItem>
                <SelectItem value="thread">Thread</SelectItem>
                <SelectItem value="carousel">Carrossel</SelectItem>
                <SelectItem value="reel">Reel</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="article">Artigo</SelectItem>
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
              placeholder="Cole o conteúdo completo da referência aqui..."
              className="min-h-[200px] font-mono text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source_url">URL da Fonte (opcional)</Label>
            <Input
              id="source_url"
              type="url"
              value={formData.source_url}
              onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
              placeholder="https://twitter.com/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="thumbnail_url">URL da Thumbnail (opcional)</Label>
            <Input
              id="thumbnail_url"
              type="url"
              value={formData.thumbnail_url}
              onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {reference ? "Salvar Alterações" : "Adicionar Referência"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
