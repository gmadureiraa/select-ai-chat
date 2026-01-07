import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CreateReferenceData, ReferenceItem, ReferenceType } from "@/hooks/useReferenceLibrary";
import { CONTENT_TYPE_OPTIONS } from "@/types/contentTypes";
import { Loader2, ChevronDown, Settings2 } from "lucide-react";
import { RichContentEditor } from "@/components/planning/RichContentEditor";
import { MentionableInput } from "@/components/planning/MentionableInput";
import { UnifiedUploader } from "@/components/library/UnifiedUploader";

interface ReferenceDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateReferenceData) => void;
  reference?: ReferenceItem;
  clientId?: string;
}

export function ReferenceDialog({ open, onClose, onSave, reference, clientId }: ReferenceDialogProps) {
  const [formData, setFormData] = useState<CreateReferenceData>({
    title: "",
    reference_type: "tweet",
    content: "",
    source_url: "",
    thumbnail_url: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (reference) {
      setFormData({
        title: reference.title,
        reference_type: reference.reference_type,
        content: reference.content,
        source_url: reference.source_url || "",
        thumbnail_url: reference.thumbnail_url || "",
      });
      setShowAdvanced(!!(reference.source_url || reference.thumbnail_url));
    } else {
      setFormData({
        title: "",
        reference_type: "tweet",
        content: "",
        source_url: "",
        thumbnail_url: "",
      });
      setShowAdvanced(false);
    }
  }, [reference, open]);

  const handleContentExtracted = (result: { text: string; metadata?: any }) => {
    setFormData(prev => ({
      ...prev,
      content: prev.content 
        ? `${prev.content}\n\n---\n\n${result.text}` 
        : result.text,
      title: prev.title || result.metadata?.title || "",
      source_url: prev.source_url || result.metadata?.source_url || "",
      thumbnail_url: prev.thumbnail_url || result.metadata?.thumbnail_url || "",
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      onSave(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {reference ? "Editar Referência" : "Adicionar Referência"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title and Type Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="title">Título</Label>
              {clientId ? (
                <MentionableInput
                  value={formData.title}
                  onChange={(value) => setFormData({ ...formData, title: value })}
                  clientId={clientId}
                  placeholder="Ex: Thread sobre estratégias (use @ para mencionar)"
                  className="w-full"
                />
              ) : (
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Thread sobre estratégias de marketing"
                  required
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference_type">Tipo</Label>
              <Select
                value={formData.reference_type}
                onValueChange={(value: ReferenceType) => setFormData({ ...formData, reference_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Unified Uploader */}
          <UnifiedUploader
            onContentExtracted={handleContentExtracted}
            clientId={clientId}
            maxFiles={10}
            maxSizeMB={20}
          />

          {/* Main Content Editor */}
          <div className="space-y-2">
            <Label>Conteúdo</Label>
            <RichContentEditor
              value={formData.content}
              onChange={(value) => setFormData({ ...formData, content: value })}
              placeholder="Digite o conteúdo aqui... Use @ para mencionar conteúdos e referências."
              minRows={10}
              clientId={clientId}
            />
          </div>

          {/* Advanced Options (Collapsible) */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground w-full justify-start"
              >
                <Settings2 className="h-4 w-4" />
                Opções avançadas
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-md border border-border bg-muted/30">
                <div className="space-y-2">
                  <Label htmlFor="source_url" className="text-sm">URL da Fonte</Label>
                  <Input
                    id="source_url"
                    value={formData.source_url}
                    onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                    placeholder="https://..."
                    type="url"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="thumbnail_url" className="text-sm">URL da Thumbnail</Label>
                  <Input
                    id="thumbnail_url"
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    placeholder="https://..."
                    type="url"
                    className="text-sm"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.title.trim()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {reference ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
