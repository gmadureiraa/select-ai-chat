import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ContentItem, ContentType, CreateContentData } from "@/hooks/useContentLibrary";
import { CONTENT_TYPE_OPTIONS } from "@/types/contentTypes";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronDown, Video, Wand2 } from "lucide-react";
import { RichContentEditor } from "@/components/planning/RichContentEditor";
import { usePlanningContentGeneration } from "@/hooks/usePlanningContentGeneration";
import { MentionableInput } from "@/components/planning/MentionableInput";

interface ContentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateContentData) => void;
  content?: ContentItem;
  clientId?: string;
}

export const ContentDialog = ({ open, onClose, onSave, content, clientId }: ContentDialogProps) => {
  const { toast } = useToast();
  const { generateContent, isGenerating: isGeneratingContent } = usePlanningContentGeneration();
  
  const [formData, setFormData] = useState<CreateContentData>({
    title: "",
    content_type: "newsletter",
    content: "",
    content_url: "",
    thumbnail_url: "",
  });
  const [videoUrl, setVideoUrl] = useState("");
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isTranscribingVideo, setIsTranscribingVideo] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    if (content) {
      setFormData({
        title: content.title,
        content_type: content.content_type,
        content: content.content,
        content_url: content.content_url || "",
        thumbnail_url: content.thumbnail_url || "",
      });
      setVideoUrl(content.metadata?.video_url || "");
      setShowVideo(!!content.metadata?.video_url);
      setShowAdvanced(!!(content.content_url || content.thumbnail_url));
    } else {
      setFormData({
        title: "",
        content_type: "newsletter",
        content: "",
        content_url: "",
        thumbnail_url: "",
      });
      setVideoUrl("");
      setShowVideo(false);
      setShowAdvanced(false);
    }
  }, [content, open]);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O vídeo deve ter no máximo 20MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingVideo(true);
    try {
      const { signedUrl, error } = await uploadAndGetSignedUrl(file, "content-videos");

      if (error) throw error;
      if (signedUrl) setVideoUrl(signedUrl);
      toast({
        title: "Vídeo carregado",
        description: "Clique em 'Transcrever' para extrair o conteúdo.",
      });
    } catch (error) {
      console.error("Error uploading video:", error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer upload do vídeo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleTranscribeVideo = async () => {
    if (!videoUrl) {
      toast({
        title: "Nenhum vídeo",
        description: "Adicione um link ou faça upload de um vídeo primeiro",
        variant: "destructive",
      });
      return;
    }

    setIsTranscribingVideo(true);
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: { videoUrl }
      });

      if (error) throw error;

      const existingContent = formData.content.trim();
      const newContent = existingContent 
        ? `${existingContent}\n\n--- TRANSCRIÇÃO DO VÍDEO ---\n${data.transcription}`
        : data.transcription;

      setFormData({ ...formData, content: newContent });
      toast({
        title: "Transcrição concluída",
        description: "O conteúdo do vídeo foi adicionado",
      });
    } catch (error) {
      console.error("Error transcribing video:", error);
      toast({
        title: "Erro",
        description: "Não foi possível transcrever o vídeo",
        variant: "destructive",
      });
    } finally {
      setIsTranscribingVideo(false);
    }
  };

  // AI content generation - similar to PlanningItemDialog
  const canGenerateContent = formData.title.trim() && clientId;
  
  const handleGenerateContent = async () => {
    if (!canGenerateContent || !clientId) return;
    
    // Map content_type to platform for the agent
    const platformMap: Record<string, string> = {
      newsletter: 'newsletter',
      tweet: 'twitter',
      thread: 'twitter',
      article: 'blog',
      instagram_post: 'instagram',
      linkedin_post: 'linkedin',
    };
    
    const platform = platformMap[formData.content_type] || 'blog';
    
    const generatedContent = await generateContent({
      title: formData.title,
      description: '',
      platform,
      contentType: formData.content_type,
      clientId
    });

    if (generatedContent) {
      setFormData({ ...formData, content: generatedContent });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataWithMetadata = {
      ...formData,
      metadata: {
        ...formData.metadata,
        video_url: videoUrl || undefined,
      },
    };
    onSave(dataWithMetadata);
    onClose();
  };

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

          {/* Main Content Editor - Using RichContentEditor like PlanningItemDialog */}
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

          {/* Video Section (Collapsible) */}
          <Collapsible open={showVideo} onOpenChange={setShowVideo}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground w-full justify-start"
              >
                <Video className="h-4 w-4" />
                Adicionar vídeo
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showVideo ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="p-3 rounded-md border border-border bg-muted/30 space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Cole o link do vídeo ou faça upload"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleTranscribeVideo}
                    disabled={isTranscribingVideo || !videoUrl}
                    variant="secondary"
                    size="sm"
                  >
                    {isTranscribingVideo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Transcrever"
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    disabled={isUploadingVideo}
                    className="text-xs"
                  />
                  {isUploadingVideo && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload de vídeo (max 20MB) ou cole o link para transcrever
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Advanced Options (Collapsible) */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground w-full justify-start"
              >
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
            <Button type="submit">
              {content ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};