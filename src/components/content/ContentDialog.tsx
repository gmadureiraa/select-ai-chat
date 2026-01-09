import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ContentItem, ContentType, CreateContentData } from "@/hooks/useContentLibrary";
import { CONTENT_TYPE_OPTIONS } from "@/types/contentTypes";
import { Loader2, ChevronDown, Wand2, Settings2 } from "lucide-react";
import { RichContentEditor } from "@/components/planning/RichContentEditor";
import { usePlanningContentGeneration } from "@/hooks/usePlanningContentGeneration";
import { MentionableInput } from "@/components/planning/MentionableInput";
import { UnifiedUploader } from "@/components/library/UnifiedUploader";

interface ContentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateContentData) => void;
  content?: ContentItem;
  clientId?: string;
}

export const ContentDialog = ({ open, onClose, onSave, content, clientId }: ContentDialogProps) => {
  const { generateContent, isGenerating: isGeneratingContent } = usePlanningContentGeneration();
  
  const [formData, setFormData] = useState<CreateContentData>({
    title: "",
    content_type: "newsletter",
    content: "",
    content_url: "",
    thumbnail_url: "",
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (content) {
      setFormData({
        title: content.title,
        content_type: content.content_type,
        content: content.content,
        content_url: content.content_url || "",
        thumbnail_url: content.thumbnail_url || "",
      });
      setShowAdvanced(!!(content.content_url || content.thumbnail_url));
    } else {
      setFormData({
        title: "",
        content_type: "newsletter",
        content: "",
        content_url: "",
        thumbnail_url: "",
      });
      setShowAdvanced(false);
    }
  }, [content, open]);

  const handleContentExtracted = (result: { text: string; metadata?: any }) => {
    setFormData(prev => ({
      ...prev,
      content: prev.content 
        ? `${prev.content}\n\n---\n\n${result.text}` 
        : result.text,
      title: prev.title || result.metadata?.title || "",
      content_url: prev.content_url || result.metadata?.source_url || "",
      thumbnail_url: prev.thumbnail_url || result.metadata?.thumbnail_url || "",
      metadata: {
        ...(prev.metadata as Record<string, unknown> || {}),
        attachments: [
          ...((prev.metadata as Record<string, unknown>)?.attachments as any[] || []),
          ...(result.metadata?.attachments || [])
        ],
        image_urls: [
          ...((prev.metadata as Record<string, unknown>)?.image_urls as string[] || []),
          ...(result.metadata?.attachments?.filter((a: any) => a.type === 'image').map((a: any) => a.url) || [])
        ]
      }
    }));
  };

  const handleAttachOnly = (attachments: any[]) => {
    setFormData(prev => ({
      ...prev,
      metadata: {
        ...(prev.metadata as Record<string, unknown> || {}),
        attachments: [
          ...((prev.metadata as Record<string, unknown>)?.attachments as any[] || []),
          ...attachments
        ],
        image_urls: [
          ...((prev.metadata as Record<string, unknown>)?.image_urls as string[] || []),
          ...(attachments.filter((a: any) => a.type === 'image').map((a: any) => a.url) || [])
        ]
      }
    }));
  };

  const canGenerateContent = formData.title.trim() && clientId;
  
  const handleGenerateContent = async () => {
    if (!canGenerateContent || !clientId) return;
    
    const result = await generateContent({
      title: formData.title,
      contentType: formData.content_type,
      clientId
    });

    if (result) {
      setFormData({ ...formData, content: result.content });
    }
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

  const isProcessing = isGeneratingContent;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{content ? "Editar Conteúdo" : "Adicionar Conteúdo"}</DialogTitle>
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
                  placeholder="Ex: Newsletter Semanal #15 (use @ para mencionar)"
                  className="w-full"
                />
              ) : (
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Newsletter Semanal #15"
                  required
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="content_type">Tipo</Label>
              <Select
                value={formData.content_type}
                onValueChange={(value) => setFormData({ ...formData, content_type: value as ContentType })}
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

          {/* AI Generation Button */}
          {clientId && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateContent}
                disabled={!canGenerateContent || isGeneratingContent}
                className="gap-2"
              >
                {isGeneratingContent ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Escrever com IA
              </Button>
            </div>
          )}

          {/* Unified Uploader */}
          <UnifiedUploader
            onContentExtracted={handleContentExtracted}
            onAttachOnly={handleAttachOnly}
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
                  <Label htmlFor="content_url" className="text-sm">URL do Conteúdo</Label>
                  <Input
                    id="content_url"
                    value={formData.content_url}
                    onChange={(e) => setFormData({ ...formData, content_url: e.target.value })}
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
            <Button type="submit" disabled={isProcessing || isSubmitting}>
              {(isProcessing || isSubmitting) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {content ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
