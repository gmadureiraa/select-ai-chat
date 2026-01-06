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
import { transcribeImagesChunked } from "@/lib/transcribeImages";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  ChevronDown, 
  Video, 
  Wand2, 
  Link as LinkIcon, 
  FileText, 
  Image as ImageIcon,
  X,
  ExternalLink,
  Sparkles
} from "lucide-react";
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

  // Video states
  const [videoUrl, setVideoUrl] = useState("");
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isTranscribingVideo, setIsTranscribingVideo] = useState(false);

  // Link states
  const [linkUrl, setLinkUrl] = useState("");
  const [isScrapingLink, setIsScrapingLink] = useState(false);
  const [scrapedLinkUrl, setScrapedLinkUrl] = useState<string | null>(null);

  // PDF states
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);

  // Image states
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isTranscribingImages, setIsTranscribingImages] = useState(false);

  // UI states
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [showImages, setShowImages] = useState(false);

  useEffect(() => {
    if (content) {
      setFormData({
        title: content.title,
        content_type: content.content_type,
        content: content.content,
        content_url: content.content_url || "",
        thumbnail_url: content.thumbnail_url || "",
      });
      
      // Restore attachments from metadata
      const metadata = content.metadata as Record<string, any> | null;
      if (metadata?.video_url) {
        setVideoUrl(metadata.video_url);
        setShowVideo(true);
      }
      if (metadata?.scraped_url) {
        setScrapedLinkUrl(metadata.scraped_url);
        setLinkUrl(metadata.scraped_url);
        setShowLink(true);
      }
      if (metadata?.pdf_url) {
        setPdfUrl(metadata.pdf_url);
        setPdfFileName(metadata.pdf_file_name || "documento.pdf");
        setShowPdf(true);
      }
      if (metadata?.image_urls?.length > 0) {
        setUploadedImages(metadata.image_urls);
        setShowImages(true);
      }
      
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
      setLinkUrl("");
      setScrapedLinkUrl(null);
      setPdfUrl(null);
      setPdfFileName(null);
      setUploadedImages([]);
      setShowVideo(false);
      setShowLink(false);
      setShowPdf(false);
      setShowImages(false);
      setShowAdvanced(false);
    }
  }, [content, open]);

  // ============== LINK HANDLERS ==============
  const handleScrapeLink = async () => {
    if (!linkUrl.trim()) {
      toast({ title: "Erro", description: "Insira uma URL válida", variant: "destructive" });
      return;
    }

    setIsScrapingLink(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("scrape-research-link", {
        body: { 
          url: linkUrl.trim(),
          userId: session?.user?.id 
        },
      });

      if (error) throw error;

      // Build content from scraped data
      let newContent = formData.content || "";
      
      if (data.title) {
        newContent += `\n\n## ${data.title}\n`;
      }
      if (data.description) {
        newContent += `\n${data.description}\n`;
      }
      if (data.content) {
        newContent += `\n${data.content}`;
      }
      if (data.imageDescriptions?.length > 0) {
        newContent += `\n\n### Imagens encontradas:\n${data.imageDescriptions.join("\n")}`;
      }

      setFormData(prev => ({ 
        ...prev, 
        content: newContent.trim(),
        thumbnail_url: prev.thumbnail_url || data.ogImage || data.images?.[0] || ""
      }));
      setScrapedLinkUrl(linkUrl.trim());
      
      toast({ title: "Sucesso", description: "Conteúdo extraído do link" });
    } catch (error) {
      console.error("Error scraping link:", error);
      toast({ title: "Erro", description: "Não foi possível extrair o conteúdo", variant: "destructive" });
    } finally {
      setIsScrapingLink(false);
    }
  };

  // ============== PDF HANDLERS ==============
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Erro", description: "PDF deve ter no máximo 20MB", variant: "destructive" });
      return;
    }

    setIsUploadingPdf(true);
    try {
      const { signedUrl, error } = await uploadAndGetSignedUrl(file, "content-pdfs");
      if (error || !signedUrl) throw error || new Error("Upload failed");
      
      setPdfUrl(signedUrl);
      setPdfFileName(file.name);
      toast({ title: "Sucesso", description: "PDF enviado. Clique em 'Extrair' para obter o texto." });
    } catch (error) {
      console.error("Error uploading PDF:", error);
      toast({ title: "Erro", description: "Falha ao enviar PDF", variant: "destructive" });
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleExtractPdf = async () => {
    if (!pdfUrl) {
      toast({ title: "Erro", description: "Envie um PDF primeiro", variant: "destructive" });
      return;
    }

    setIsExtractingPdf(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("extract-pdf", {
        body: { 
          fileUrl: pdfUrl,
          fileName: pdfFileName,
          userId: session?.user?.id
        },
      });

      if (error) throw error;

      if (data?.extractedText) {
        const newContent = formData.content 
          ? `${formData.content}\n\n---\n\n## Conteúdo do PDF: ${pdfFileName}\n\n${data.extractedText}`
          : `## Conteúdo do PDF: ${pdfFileName}\n\n${data.extractedText}`;
        
        setFormData(prev => ({ ...prev, content: newContent }));
        toast({ title: "Sucesso", description: `Texto extraído (${data.pageCount || "?"} páginas)` });
      }
    } catch (error) {
      console.error("Error extracting PDF:", error);
      toast({ title: "Erro", description: "Não foi possível extrair o texto", variant: "destructive" });
    } finally {
      setIsExtractingPdf(false);
    }
  };

  // ============== IMAGE HANDLERS ==============
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 10 - uploadedImages.length;
    if (files.length > remainingSlots) {
      toast({ 
        title: "Limite excedido", 
        description: `Você pode adicionar mais ${remainingSlots} imagens`, 
        variant: "destructive" 
      });
      return;
    }

    setIsUploadingImages(true);
    try {
      const newUrls: string[] = [];
      
      for (const file of Array.from(files)) {
        const { signedUrl, error } = await uploadAndGetSignedUrl(file, "content-images");
        if (error || !signedUrl) {
          console.error("Error uploading image:", error);
          continue;
        }
        newUrls.push(signedUrl);
      }

      setUploadedImages(prev => [...prev, ...newUrls]);
      toast({ title: "Sucesso", description: `${newUrls.length} imagem(ns) enviada(s)` });
    } catch (error) {
      console.error("Error uploading images:", error);
      toast({ title: "Erro", description: "Falha ao enviar imagens", variant: "destructive" });
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleTranscribeImages = async () => {
    if (uploadedImages.length === 0) {
      toast({ title: "Erro", description: "Envie imagens primeiro", variant: "destructive" });
      return;
    }

    setIsTranscribingImages(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const transcription = await transcribeImagesChunked(uploadedImages, {
        userId: session?.user?.id,
        clientId: clientId,
        chunkSize: 1,
      });

      if (transcription) {
        const newContent = formData.content
          ? `${formData.content}\n\n---\n\n## Transcrição das Imagens\n\n${transcription}`
          : `## Transcrição das Imagens\n\n${transcription}`;

        setFormData((prev) => ({ ...prev, content: newContent }));
        toast({ title: "Sucesso", description: "Imagens transcritas com sucesso" });
      }
    } catch (error) {
      console.error("Error transcribing images:", error);
      toast({ title: "Erro", description: "Não foi possível transcrever as imagens", variant: "destructive" });
    } finally {
      setIsTranscribingImages(false);
    }
  };

  // ============== VIDEO HANDLERS ==============
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
      const { data: { session } } = await supabase.auth.getSession();
      const isYouTube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");

      const { data, error } = await supabase.functions.invoke(
        isYouTube ? "extract-youtube" : "transcribe-video",
        {
          body: isYouTube 
            ? { url: videoUrl, userId: session?.user?.id }
            : { videoUrl, userId: session?.user?.id }
        }
      );

      if (error) throw error;

      const transcription = data?.transcription || data?.transcript;
      if (transcription) {
        const existingContent = formData.content.trim();
        const newContent = existingContent 
          ? `${existingContent}\n\n---\n\n## Transcrição do Vídeo\n\n${transcription}`
          : `## Transcrição do Vídeo\n\n${transcription}`;

        setFormData({ ...formData, content: newContent });
        toast({
          title: "Transcrição concluída",
          description: "O conteúdo do vídeo foi adicionado",
        });
      }
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

  // ============== AI GENERATION ==============
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

  // ============== SUBMIT ==============
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const metadata: Record<string, any> = {};
    
    if (videoUrl) metadata.video_url = videoUrl;
    if (scrapedLinkUrl) metadata.scraped_url = scrapedLinkUrl;
    if (pdfUrl) {
      metadata.pdf_url = pdfUrl;
      metadata.pdf_file_name = pdfFileName;
    }
    if (uploadedImages.length > 0) {
      metadata.image_urls = uploadedImages;
    }

    const dataWithMetadata = {
      ...formData,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
    onSave(dataWithMetadata);
    onClose();
  };

  const isProcessing = isGeneratingContent || isScrapingLink || isExtractingPdf || 
    isTranscribingImages || isUploadingVideo || isTranscribingVideo || 
    isUploadingPdf || isUploadingImages;

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

          {/* ============== LINK SECTION ============== */}
          <Collapsible open={showLink} onOpenChange={setShowLink}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground w-full justify-start"
              >
                <LinkIcon className="h-4 w-4" />
                Link (Blog, Artigo, Newsletter)
                {scrapedLinkUrl && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded ml-2">
                    Anexado
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showLink ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="p-3 rounded-md border border-border bg-muted/30 space-y-3">
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
                    disabled={isScrapingLink || !linkUrl.trim()}
                    variant="secondary"
                    size="sm"
                    className="gap-1"
                  >
                    {isScrapingLink ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    Ler
                  </Button>
                </div>
                {scrapedLinkUrl && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                    <LinkIcon className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate flex-1">{scrapedLinkUrl}</span>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 flex-shrink-0"
                      onClick={() => { setScrapedLinkUrl(null); setLinkUrl(""); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ============== PDF SECTION ============== */}
          <Collapsible open={showPdf} onOpenChange={setShowPdf}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground w-full justify-start"
              >
                <FileText className="h-4 w-4" />
                PDF (Documento)
                {pdfUrl && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded ml-2">
                    Anexado
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showPdf ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="p-3 rounded-md border border-border bg-muted/30 space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={handlePdfUpload}
                      disabled={isUploadingPdf}
                      className="cursor-pointer"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleExtractPdf}
                    disabled={isExtractingPdf || !pdfUrl}
                    variant="secondary"
                    size="sm"
                    className="gap-1"
                  >
                    {isExtractingPdf ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    Extrair
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Máx. 20MB</p>
                {pdfUrl && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                    <FileText className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate flex-1">{pdfFileName}</span>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 flex-shrink-0"
                      onClick={() => { setPdfUrl(null); setPdfFileName(null); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ============== IMAGES SECTION ============== */}
          <Collapsible open={showImages} onOpenChange={setShowImages}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground w-full justify-start"
              >
                <ImageIcon className="h-4 w-4" />
                Imagens (até 10)
                {uploadedImages.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded ml-2">
                    {uploadedImages.length}/10
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showImages ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="p-3 rounded-md border border-border bg-muted/30 space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      disabled={isUploadingImages || uploadedImages.length >= 10}
                      className="cursor-pointer"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleTranscribeImages}
                    disabled={isTranscribingImages || uploadedImages.length === 0}
                    variant="secondary"
                    size="sm"
                    className="gap-1"
                  >
                    {isTranscribingImages ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Transcrever
                  </Button>
                </div>
                
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-5 gap-2">
                    {uploadedImages.map((url, index) => (
                      <div key={index} className="relative group aspect-square">
                        <img
                          src={url}
                          alt={`Imagem ${index + 1}`}
                          className="w-full h-full object-cover rounded-md border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ============== VIDEO SECTION ============== */}
          <Collapsible open={showVideo} onOpenChange={setShowVideo}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground w-full justify-start"
              >
                <Video className="h-4 w-4" />
                Vídeo (Upload ou YouTube)
                {videoUrl && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded ml-2">
                    Anexado
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showVideo ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="p-3 rounded-md border border-border bg-muted/30 space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Cole o link do YouTube ou faça upload"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleTranscribeVideo}
                    disabled={isTranscribingVideo || !videoUrl}
                    variant="secondary"
                    size="sm"
                    className="gap-1"
                  >
                    {isTranscribingVideo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Transcrever
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    disabled={isUploadingVideo}
                    className="text-xs flex-1"
                  />
                  {isUploadingVideo && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload de vídeo (max 20MB) ou cole o link do YouTube
                </p>
                {videoUrl && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                    <Video className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate flex-1">{videoUrl}</span>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 flex-shrink-0"
                      onClick={() => setVideoUrl("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

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
            <Button type="submit" disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {content ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
