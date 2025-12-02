import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateReferenceData, ReferenceItem } from "@/hooks/useReferenceLibrary";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";

interface ReferenceDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateReferenceData) => void;
  reference?: ReferenceItem;
}

export function ReferenceDialog({ open, onClose, onSave, reference }: ReferenceDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<CreateReferenceData>({
    title: "",
    reference_type: "tweet",
    content: "",
    source_url: "",
    thumbnail_url: "",
  });
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [isTranscribingVideo, setIsTranscribingVideo] = useState(false);

  useEffect(() => {
    if (reference) {
      setFormData({
        title: reference.title,
        reference_type: reference.reference_type,
        content: reference.content,
        source_url: reference.source_url || "",
        thumbnail_url: reference.thumbnail_url || "",
      });
      setUploadedImages(reference.metadata?.image_urls || []);
      setVideoUrl(reference.metadata?.video_url || "");
    } else {
      setFormData({
        title: "",
        reference_type: "tweet",
        content: "",
        source_url: "",
        thumbnail_url: "",
      });
      setUploadedImages([]);
      setVideoUrl("");
    }
  }, [reference, open]);

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
        const filePath = `reference-images/${fileName}`;

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

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `reference-videos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-files')
        .getPublicUrl(filePath);

      setVideoUrl(publicUrl);
      toast({
        title: "Vídeo carregado",
        description: "Vídeo enviado com sucesso. Clique em 'Transcrever Vídeo' para extrair o conteúdo.",
      });
    } catch (error) {
      console.error("Error uploading video:", error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer upload do vídeo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataWithImages = {
      ...formData,
      metadata: {
        ...formData.metadata,
        image_urls: uploadedImages,
        video_url: videoUrl || undefined,
      },
    };
    onSave(dataWithImages);
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
                <SelectItem value="stories">Stories</SelectItem>
                <SelectItem value="static_image">Estático Único</SelectItem>
                <SelectItem value="reel">Reel</SelectItem>
                <SelectItem value="short_video">Vídeo Curto</SelectItem>
                <SelectItem value="long_video">Vídeo Longo</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="article">Artigo</SelectItem>
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
            <Label>Vídeo (opcional)</Label>
            <div className="space-y-2">
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
                >
                  {isTranscribingVideo ? (
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
              </div>
              <Input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                disabled={isUploading}
              />
              <p className="text-xs text-muted-foreground">
                Faça upload de um vídeo (max 20MB) ou cole o link e clique em "Transcrever"
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Conteúdo</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Cole o conteúdo completo da referência aqui ou transcreva das imagens/vídeo..."
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
