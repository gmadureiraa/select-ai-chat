import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, X, Loader2, Image as ImageIcon, FileText, Lightbulb, MessageCircle, Sparkles, AtSign, Mic } from "lucide-react";
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ActionMenuPopover } from "./ActionMenuPopover";
import { CitationPopover, CitationItem } from "./CitationPopover";
import { CitationChip, Citation } from "./CitationChip";
import { detectFormat, type DetectedFormat } from "@/lib/formatDetection";

import { ChatMode } from "./ModeSelector";

interface FloatingInputProps {
  onSend: (message: string, imageUrls?: string[], quality?: "fast" | "high", mode?: ChatMode, citations?: Citation[], audioUrls?: string[]) => void;
  disabled?: boolean;
  templateType?: "free_chat" | "content" | "image";
  placeholder?: string;
  contentLibrary?: Array<{ id: string; title: string; content_type: string; content: string }>;
  referenceLibrary?: Array<{ id: string; title: string; reference_type: string; content: string }>;
  selectedMode?: ChatMode; // Mode from ModeSelector - used as base when no format citation
  /** Conteúdo externo que populará o input (ex: clique em sugestão da KaiToolsTray).
   *  Trocar o valor reseta o input pro novo conteúdo e foca o textarea. */
  externalInput?: { value: string; nonce: number } | null;
  /** Slot de ação extra renderizado ao lado do botão de imagem (ex: tools tray). */
  leftActions?: React.ReactNode;
}

const modeConfig = {
  content: {
    label: "Conteúdo",
    description: "4 agentes",
    quality: "high" as const,
    activeClass: "bg-primary/15 text-primary border-primary/30",
    icon: FileText,
    badge: "PRO",
    badgeClass: "bg-primary/20 text-primary",
  },
  ideas: {
    label: "Ideias",
    description: "Rápido",
    quality: "fast" as const,
    activeClass: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    icon: Lightbulb,
    badge: null,
    badgeClass: "",
  },
  free_chat: {
    label: "Chat",
    description: "Rápido",
    quality: "fast" as const,
    activeClass: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    icon: MessageCircle,
    badge: null,
    badgeClass: "",
  },
};

export const FloatingInput = ({
  onSend,
  disabled,
  templateType = "content",
  placeholder = "Digite sua mensagem... Use @ para citar conteúdo",
  contentLibrary = [],
  referenceLibrary = [],
  selectedMode,
  externalInput,
  leftActions,
}: FloatingInputProps) => {
  const [input, setInput] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [mode, setMode] = useState<ChatMode>(
    templateType === "free_chat" ? "free_chat" : "ideas"
  );
  const [citations, setCitations] = useState<Citation[]>([]);
  const [showCitationPopover, setShowCitationPopover] = useState(false);
  const [citationSearchQuery, setCitationSearchQuery] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const citationAnchorRef = useRef<HTMLSpanElement>(null);
  const { toast } = useToast();
  const maxChars = 10000;
  const maxImages = 5;
  const maxAudios = 3;
  // 25MB UI cap (backend corta inline em 18MB). Defensivo.
  const maxAudioBytes = 25 * 1024 * 1024;
  // mp3, wav, m4a/aac, ogg, opus, webm. Aceita variações de MIME.
  const acceptedAudioMime = /^audio\//;
  const acceptedAudioExt = /\.(mp3|wav|m4a|aac|ogg|opus|webm)$/i;
  const isAudioFile = (f: File) =>
    acceptedAudioMime.test(f.type) || acceptedAudioExt.test(f.name);
  const isImageFile = (f: File) => f.type.startsWith("image/");
  const formatBytes = (b: number) =>
    b < 1024 * 1024
      ? `${(b / 1024).toFixed(0)} KB`
      : `${(b / 1024 / 1024).toFixed(1)} MB`;

  useEffect(() => {
    if (templateType === "free_chat") {
      setMode("free_chat");
    } else if (mode === "free_chat") {
      setMode("ideas");
    }
  }, [templateType, mode]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + "px";
    }
  }, [input]);

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  // Sync external input (ex: tray de tools sugerindo prompt). O `nonce` força
  // re-render quando o user clica na mesma sugestão duas vezes seguidas.
  useEffect(() => {
    if (!externalInput) return;
    setInput(externalInput.value);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      const len = externalInput.value.length;
      ta.setSelectionRange(len, len);
    });
  }, [externalInput?.nonce, externalInput?.value]);

  // Detectar @ para abrir popover de citação
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Detectar se o usuário digitou @
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Se não tem espaço depois do @, é uma busca
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setShowCitationPopover(true);
        setCitationSearchQuery(textAfterAt);
        return;
      }
    }
    
    setShowCitationPopover(false);
    setCitationSearchQuery("");
  }, []);

  // Detectar formato a partir do texto digitado
  const detectedFormat = useMemo((): DetectedFormat | null => {
    if (!input || input.length < 5) return null;
    
    // Se já tem citação de formato, não detectar automaticamente
    const hasFormatCitation = citations.some(c => c.type === "format");
    if (hasFormatCitation) return null;
    
    return detectFormat(input);
  }, [input, citations]);

  const handleCitationSelect = useCallback((item: CitationItem) => {
    // Adicionar citação
    const newCitation: Citation = {
      id: item.id,
      title: item.title,
      type: item.type,
      category: item.category,
    };

    // Evitar duplicatas
    if (!citations.some((c) => c.id === item.id)) {
      setCitations((prev) => [...prev, newCitation]);
    }

    // MANTER o @ no texto - apenas substituir a busca pelo título completo
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = input.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      // Manter o @titulo no input visível
      const newInput = input.substring(0, lastAtIndex) + "@" + item.title + " " + input.substring(cursorPos);
      setInput(newInput);
      
      // Posicionar cursor após o título inserido
      setTimeout(() => {
        if (textareaRef.current) {
          const newPos = lastAtIndex + item.title.length + 2; // +2 for @ and space
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }

    setShowCitationPopover(false);
    setCitationSearchQuery("");
    
    // Focar no textarea
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [citations, input]);

  const handleRemoveCitation = useCallback((id: string) => {
    setCitations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Determinar modo baseado nas citações
  const getEffectiveModeFromCitations = useCallback((citationList: Citation[]): ChatMode => {
    // Se tem @ideias, modo ideias
    const hasIdeasCitation = citationList.some(c => c.id === "format_ideias" || c.category === "ideias");
    if (hasIdeasCitation) return "ideas";
    
    // Se tem algum formato de conteúdo, modo conteúdo
    const hasFormatCitation = citationList.some(c => c.type === "format" && c.category !== "ideias");
    if (hasFormatCitation) return "content";
    
    // Se não tem formato, mas pode ter itens de biblioteca, chat livre
    return "free_chat";
  }, []);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (
      (!trimmed && imageFiles.length === 0 && audioFiles.length === 0 && citations.length === 0) ||
      disabled ||
      trimmed.length > maxChars
    ) {
      return;
    }

    let imageUrls: string[] = [];
    let audioUrls: string[] = [];

    if (imageFiles.length > 0) {
      setUploadingImages(true);
      try {
        const uploadPromises = imageFiles.map(async (file) => {
          const { signedUrl, error } = await uploadAndGetSignedUrl(file, "chat-images");
          if (error) throw error;
          return signedUrl;
        });

        imageUrls = (await Promise.all(uploadPromises)).filter((url): url is string => url !== null);
      } catch (error: any) {
        toast({
          title: "Erro ao enviar imagens",
          description: error.message,
          variant: "destructive",
        });
        setUploadingImages(false);
        return;
      }
      setUploadingImages(false);
    }

    if (audioFiles.length > 0) {
      setUploadingAudio(true);
      try {
        const uploadPromises = audioFiles.map(async (file) => {
          const { signedUrl, error } = await uploadAndGetSignedUrl(file, "chat-audio");
          if (error) throw error;
          return signedUrl;
        });

        audioUrls = (await Promise.all(uploadPromises)).filter((url): url is string => url !== null);
      } catch (error: any) {
        toast({
          title: "Erro ao enviar áudio",
          description: error.message,
          variant: "destructive",
        });
        setUploadingAudio(false);
        return;
      }
      setUploadingAudio(false);
    }

    // Determinar modo baseado nas citações E no modo selecionado
    // Prioridade: citação de formato > citação de ideias > modo selecionado pelo ModeSelector > fallback
    let effectiveMode: ChatMode;
    if (citations.some(c => c.category === "ideias" || c.id === "format_ideias")) {
      // Citação explícita de @ideias
      effectiveMode = "ideas";
    } else if (citations.some(c => c.type === "format" && c.category !== "ideias")) {
      // Citação de formato específico (ex: @LinkedIn, @Carrossel)
      effectiveMode = "content";
    } else if (selectedMode) {
      // Modo selecionado pelo ModeSelector (Conteúdo, Ideias, Performance, Chat)
      effectiveMode = selectedMode;
    } else {
      // Fallback: sem citações e sem modo = chat livre
      effectiveMode = "free_chat";
    }
    
    // Modo "content" SEMPRE usa alta qualidade (pipeline multi-agente)
    const quality = effectiveMode === "content" ? "high" : "fast";
    
    const fallbackPrompt = audioUrls.length > 0 ? "Transcreva e analise este áudio" : "Analise esta imagem";
    onSend(
      trimmed || fallbackPrompt,
      imageUrls,
      quality,
      effectiveMode,
      citations.length > 0 ? citations : undefined,
      audioUrls.length > 0 ? audioUrls : undefined,
    );
    setInput("");
    setImageFiles([]);
    setAudioFiles([]);
    setCitations([]);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imageFiles.length > 5) {
      toast({
        title: "Limite de imagens",
        description: "Máximo de 5 imagens por mensagem.",
        variant: "destructive",
      });
      return;
    }
    setImageFiles([...imageFiles, ...files]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index));
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const accepted: File[] = [];
    let rejectedType = 0;
    let rejectedSize = 0;
    for (const f of files) {
      if (!isAudioFile(f)) {
        rejectedType++;
        continue;
      }
      if (f.size > maxAudioBytes) {
        rejectedSize++;
        continue;
      }
      accepted.push(f);
    }
    if (rejectedType > 0) {
      toast({
        title: "Formato de áudio inválido",
        description: "Aceitos: mp3, wav, m4a, ogg, opus, webm.",
        variant: "destructive",
      });
    }
    if (rejectedSize > 0) {
      toast({
        title: "Áudio muito grande",
        description: "Limite de 25 MB por arquivo.",
        variant: "destructive",
      });
    }
    if (accepted.length + audioFiles.length > maxAudios) {
      toast({
        title: "Limite de áudios",
        description: `Máximo de ${maxAudios} áudios por mensagem.`,
        variant: "destructive",
      });
      const remaining = Math.max(0, maxAudios - audioFiles.length);
      setAudioFiles([...audioFiles, ...accepted.slice(0, remaining)]);
    } else if (accepted.length > 0) {
      setAudioFiles([...audioFiles, ...accepted]);
    }
    if (audioInputRef.current) {
      audioInputRef.current.value = "";
    }
  };

  const removeAudio = (index: number) => {
    setAudioFiles(audioFiles.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Se o popover de citação está aberto, deixar o Command lidar com as teclas
    if (showCitationPopover) {
      if (e.key === "Escape") {
        setShowCitationPopover(false);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const openCitationPopover = useCallback(() => {
    setShowCitationPopover(true);
    setCitationSearchQuery("");
  }, []);

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const imageFilesFromDrop = files.filter(isImageFile);
    const audioFilesFromDrop = files.filter(isAudioFile);
    const unsupported = files.length - imageFilesFromDrop.length - audioFilesFromDrop.length;

    if (imageFilesFromDrop.length === 0 && audioFilesFromDrop.length === 0) {
      toast({
        title: "Arquivo não suportado",
        description: "Aceitos: imagens (jpg/png/webp) e áudios (mp3/wav/m4a/ogg/opus/webm).",
        variant: "destructive",
      });
      return;
    }

    if (imageFilesFromDrop.length > 0) {
      const remainingSlots = maxImages - imageFiles.length;
      if (remainingSlots <= 0) {
        toast({
          title: "Limite de imagens",
          description: `Máximo de ${maxImages} imagens por mensagem.`,
          variant: "destructive",
        });
      } else {
        const filesToAdd = imageFilesFromDrop.slice(0, remainingSlots);
        setImageFiles(prev => [...prev, ...filesToAdd]);
        if (imageFilesFromDrop.length > remainingSlots) {
          toast({
            title: "Limite de imagens",
            description: `Apenas ${remainingSlots} imagem(ns) adicionada(s).`,
          });
        }
      }
    }

    if (audioFilesFromDrop.length > 0) {
      const validAudio = audioFilesFromDrop.filter(f => f.size <= maxAudioBytes);
      const oversize = audioFilesFromDrop.length - validAudio.length;
      if (oversize > 0) {
        toast({
          title: "Áudio muito grande",
          description: "Limite de 25 MB por arquivo.",
          variant: "destructive",
        });
      }
      const remainingSlots = maxAudios - audioFiles.length;
      if (remainingSlots <= 0) {
        toast({
          title: "Limite de áudios",
          description: `Máximo de ${maxAudios} áudios por mensagem.`,
          variant: "destructive",
        });
      } else {
        const filesToAdd = validAudio.slice(0, remainingSlots);
        if (filesToAdd.length > 0) {
          setAudioFiles(prev => [...prev, ...filesToAdd]);
        }
        if (validAudio.length > remainingSlots) {
          toast({
            title: "Limite de áudios",
            description: `Apenas ${remainingSlots} áudio(s) adicionado(s).`,
          });
        }
      }
    }

    if (unsupported > 0) {
      toast({
        title: "Alguns arquivos foram ignorados",
        description: `${unsupported} arquivo(s) não suportado(s).`,
      });
    }
  }, [imageFiles.length, audioFiles.length, toast]);

  const isUploading = uploadingImages || uploadingAudio;
  const isSubmitDisabled =
    (!input.trim() && imageFiles.length === 0 && audioFiles.length === 0 && citations.length === 0) ||
    disabled ||
    isUploading;
  const hasLibraryContent = contentLibrary.length > 0 || referenceLibrary.length > 0;

  return (
    <div className="p-4 space-y-3">
      {/* Detected Format Chip */}
      {detectedFormat && (
        <div className="flex items-center gap-2 px-1">
          <Badge 
            variant="secondary" 
            className="bg-primary/10 text-primary border border-primary/20 text-xs font-medium gap-1.5"
          >
            <Sparkles className="h-3 w-3" />
            {detectedFormat.formatLabel} detectado
          </Badge>
        </div>
      )}

      {/* Citations Display */}
      {citations.length > 0 && (
        <div className="flex gap-2 flex-wrap px-1">
          {citations.map((citation) => (
            <CitationChip
              key={citation.id}
              citation={citation}
              onRemove={handleRemoveCitation}
            />
          ))}
        </div>
      )}

      {/* Image Preview */}
      {imageFiles.length > 0 && (
        <div className="flex gap-2 flex-wrap px-1">
          {imageFiles.map((file, index) => (
            <div key={index} className="relative group">
              <img
                src={URL.createObjectURL(file)}
                alt={`Preview ${index + 1}`}
                className="h-14 w-14 object-cover rounded-lg border border-border/30"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-1 -right-1 bg-muted-foreground/80 text-background rounded-full p-0.5 shadow-sm hover:bg-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Audio Preview */}
      {audioFiles.length > 0 && (
        <div className="flex gap-2 flex-wrap px-1">
          {audioFiles.map((file, index) => (
            <div
              key={index}
              className="relative group flex items-center gap-2 pl-2 pr-7 py-1.5 rounded-lg border border-border/30 bg-muted/30 text-xs max-w-[260px]"
            >
              <Mic className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="truncate font-medium text-foreground/80" title={file.name}>
                {file.name}
              </span>
              <span className="text-muted-foreground/70 flex-shrink-0">
                {formatBytes(file.size)}
              </span>
              <button
                onClick={() => removeAudio(index)}
                className="absolute -top-1 -right-1 bg-muted-foreground/80 text-background rounded-full p-0.5 shadow-sm hover:bg-muted-foreground transition-colors"
                aria-label={`Remover áudio ${file.name}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Input Container */}
      <div 
        className={cn(
          "relative bg-muted/20 rounded-xl border border-border/30 focus-within:border-border/50 focus-within:bg-muted/30 transition-all",
          isDragOver && "bg-primary/5 border-primary/30"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Citation Anchor (hidden) */}
        <span ref={citationAnchorRef} className="absolute left-4 bottom-12" />
        
        {/* Citation Popover */}
        <CitationPopover
          open={showCitationPopover}
          onOpenChange={setShowCitationPopover}
          onSelect={handleCitationSelect}
          contentLibrary={contentLibrary}
          referenceLibrary={referenceLibrary}
          anchorRef={citationAnchorRef}
          searchQuery={citationSearchQuery}
        />

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isUploading}
          className={cn(
            "min-h-[48px] max-h-[120px] resize-none border-0 bg-transparent text-sm",
            "px-4 py-3 pr-32",
            "focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
            "placeholder:text-muted-foreground/40"
          )}
          rows={1}
        />
        
        {/* Action Buttons */}
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.webm"
            multiple
            onChange={handleAudioSelect}
            className="hidden"
          />

          {/* Action Menu */}
          <ActionMenuPopover
            onImageUpload={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
          />

          {/* Citation Button */}
          {hasLibraryContent && (
            <Button
              onClick={openCitationPopover}
              variant="ghost"
              size="icon"
              disabled={disabled || isUploading}
              className={cn(
                "h-8 w-8 rounded-lg hover:bg-muted/40",
                citations.length > 0
                  ? "text-primary"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
              title="Citar conteúdo (@)"
              aria-label={citations.length > 0 ? `Citações ativas (${citations.length})` : "Citar conteúdo da biblioteca"}
            >
              <AtSign aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Direct Image Upload */}
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="ghost"
            size="icon"
            disabled={disabled || isUploading}
            className="h-8 w-8 rounded-lg hover:bg-muted/40 text-muted-foreground/60 hover:text-muted-foreground"
            title="Anexar imagem"
            aria-label="Anexar imagem"
          >
            <ImageIcon aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>

          {/* Direct Audio Upload */}
          <Button
            onClick={() => audioInputRef.current?.click()}
            variant="ghost"
            size="icon"
            disabled={disabled || isUploading}
            className={cn(
              "h-8 w-8 rounded-lg hover:bg-muted/40",
              audioFiles.length > 0
                ? "text-primary"
                : "text-muted-foreground/60 hover:text-muted-foreground"
            )}
            title="Anexar áudio (mp3, wav, m4a, ogg, opus, webm — até 25 MB)"
            aria-label={
              audioFiles.length > 0
                ? `Áudios anexados (${audioFiles.length})`
                : "Anexar áudio"
            }
          >
            <Mic aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>

          {/* Send Button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            size="icon"
            aria-label={isUploading ? "Enviando..." : "Enviar mensagem"}
            className={cn(
              "h-8 w-8 rounded-lg transition-all",
              isSubmitDisabled
                ? "bg-muted/50 text-muted-foreground/40"
                : "bg-foreground hover:bg-foreground/90 text-background"
            )}
          >
            {isUploading ? (
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Footer row: tools tray (left) + hint (center) */}
      {(leftActions || templateType === "content") && (
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            {leftActions}
          </div>
          {templateType === "content" && (
            <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <span>Use</span>
              <span className="font-medium text-foreground/80">@</span>
              <span>para marcar formatos ou biblioteca</span>
            </div>
          )}
        </div>
      )}

      {/* Image Template Indicator */}
      {templateType === "image" && (
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-muted text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Geração de Imagem
          </div>
        </div>
      )}
    </div>
  );
};
