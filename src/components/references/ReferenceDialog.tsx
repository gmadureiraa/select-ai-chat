import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateReferenceData, ReferenceItem } from "@/hooks/useReferenceLibrary";
import { CONTENT_TYPE_OPTIONS } from "@/types/contentTypes";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Link, FileText, ExternalLink } from "lucide-react";

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
  
  // New states for URL and PDF
  const [linkUrl, setLinkUrl] = useState("");
  const [isScrapingLink, setIsScrapingLink] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);

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
      setLinkUrl(reference.metadata?.scraped_url || "");
      setPdfUrl(reference.metadata?.pdf_url || "");
      setPdfFileName(reference.metadata?.pdf_file_name || "");
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
      setLinkUrl("");
      setPdfUrl("");
      setPdfFileName("");
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
        const { signedUrl, error } = await uploadAndGetSignedUrl(file, "reference-images");

        if (error) throw error;
        if (signedUrl) newImageUrls.push(signedUrl);
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

  // Convert image URL to base64
  const urlToBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch image");
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error converting image to base64:", error);
      return null;
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
      // Convert all images to base64 to avoid signed URL issues
      toast({
        title: "Preparando imagens...",
        description: "Convertendo imagens para processamento",
      });

      const base64Images: string[] = [];
      for (const imageUrl of uploadedImages) {
        const base64 = await urlToBase64(imageUrl);
        if (base64) {
          base64Images.push(base64);
        }
      }

      if (base64Images.length === 0) {
        throw new Error("Não foi possível processar as imagens");
      }

      const { data, error } = await supabase.functions.invoke('transcribe-images', {
        body: { imageUrls: base64Images }
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
      const { signedUrl, error } = await uploadAndGetSignedUrl(file, "reference-videos");

      if (error) throw error;
      if (signedUrl) setVideoUrl(signedUrl);
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

  // Scrape URL content (blog posts, newsletters)
  const handleScrapeLink = async () => {
    if (!linkUrl) {
      toast({
        title: "Nenhum link",
        description: "Cole um link para fazer a leitura do conteúdo",
        variant: "destructive",
      });
      return;
    }

    // Validate URL
    try {
      new URL(linkUrl);
    } catch {
      toast({
        title: "Link inválido",
        description: "Por favor, insira uma URL válida (ex: https://exemplo.com)",
        variant: "destructive",
      });
      return;
    }

    setIsScrapingLink(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('scrape-research-link', {
        body: { url: linkUrl }
      });

      if (error) throw error;

      // The edge function returns { success, data: { content, title, thumbnail, ... } }
      const scrapedData = response?.data || response;
      const scrapedContent = scrapedData?.content || scrapedData?.textContent || "";
      const title = scrapedData?.title || "";
      const thumbnail = scrapedData?.thumbnail || scrapedData?.ogImage || "";

      if (!scrapedContent) {
        throw new Error("Não foi possível extrair conteúdo do link");
      }

      const existingContent = formData.content.trim();
      const newContent = existingContent 
        ? `${existingContent}\n\n--- CONTEÚDO DO LINK ---\n${scrapedContent}`
        : scrapedContent;

      setFormData({ 
        ...formData, 
        content: newContent,
        title: formData.title || title,
        source_url: linkUrl,
        thumbnail_url: formData.thumbnail_url || thumbnail
      });
      
      toast({
        title: "Leitura concluída",
        description: "O conteúdo do link foi extraído com sucesso",
      });
    } catch (error) {
      console.error("Error scraping link:", error);
      toast({
        title: "Erro",
        description: "Não foi possível ler o conteúdo do link. Tente novamente ou cole manualmente.",
        variant: "destructive",
      });
    } finally {
      setIsScrapingLink(false);
    }
  };

  // Handle PDF upload
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O PDF deve ter no máximo 20MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const { signedUrl, error } = await uploadAndGetSignedUrl(file, "reference-pdfs");

      if (error) throw error;
      if (signedUrl) {
        setPdfUrl(signedUrl);
        setPdfFileName(file.name);
      }
      toast({
        title: "PDF carregado",
        description: "PDF enviado com sucesso. Clique em 'Extrair Texto' para ler o conteúdo.",
      });
    } catch (error) {
      console.error("Error uploading PDF:", error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer upload do PDF",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Extract text from PDF
  const handleExtractPdf = async () => {
    if (!pdfUrl) {
      toast({
        title: "Nenhum PDF",
        description: "Faça upload de um PDF primeiro",
        variant: "destructive",
      });
      return;
    }

    setIsExtractingPdf(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke('extract-pdf', {
        body: { 
          fileUrl: pdfUrl, 
          fileName: pdfFileName,
          userId: user?.id
        }
      });

      if (error) throw error;

      const existingContent = formData.content.trim();
      const newContent = existingContent 
        ? `${existingContent}\n\n--- CONTEÚDO DO PDF ---\n${data.content}`
        : data.content;

      setFormData({ 
        ...formData, 
        content: newContent,
        title: formData.title || pdfFileName.replace(/\.pdf$/i, "")
      });
      
      toast({
        title: "Extração concluída",
        description: `Texto extraído de ~${data.pageCount} páginas`,
      });
    } catch (error) {
      console.error("Error extracting PDF:", error);
      toast({
        title: "Erro",
        description: "Não foi possível extrair o texto do PDF",
        variant: "destructive",
      });
    } finally {
      setIsExtractingPdf(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataWithMetadata = {
      ...formData,
      metadata: {
        ...formData.metadata,
        image_urls: uploadedImages.length > 0 ? uploadedImages : undefined,
        video_url: videoUrl || undefined,
        scraped_url: linkUrl || undefined,
        pdf_url: pdfUrl || undefined,
        pdf_file_name: pdfFileName || undefined,
      },
    };
    onSave(dataWithMetadata);
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
                {CONTENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Link/URL Section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Link (Blog, Newsletter, Artigo)
            </Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://exemplo.com/artigo"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleScrapeLink}
                  disabled={isScrapingLink || !linkUrl}
                  variant="secondary"
                >
                  {isScrapingLink ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Lendo...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Ler Conteúdo
                    </>
                  )}
                </Button>
              </div>
              {linkUrl && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Link className="h-3 w-3" />
                  Link anexado: {linkUrl.substring(0, 50)}...
                </p>
              )}
            </div>
          </div>

          {/* PDF Section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              PDF (Documento)
            </Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handlePdfUpload}
                  disabled={isUploading}
                  className="flex-1"
                />
                {pdfUrl && (
                  <Button
                    type="button"
                    onClick={handleExtractPdf}
                    disabled={isExtractingPdf}
                    variant="secondary"
                  >
                    {isExtractingPdf ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Extraindo...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Extrair Texto
                      </>
                    )}
                  </Button>
                )}
              </div>
              {pdfFileName && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  PDF anexado: {pdfFileName}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Max 20MB • Faça upload e clique em "Extrair Texto" para ler o conteúdo
              </p>
            </div>
          </div>

          {/* Images Section */}
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

          {/* Video Section */}
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
              placeholder="Cole o conteúdo completo da referência aqui ou extraia de links/PDFs/imagens/vídeo..."
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
