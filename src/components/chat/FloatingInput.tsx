import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X, Loader2, Image as ImageIcon, FileText, Lightbulb, MessageCircle, Sparkles, AtSign } from "lucide-react";
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ActionMenuPopover } from "./ActionMenuPopover";
import { CitationPopover, CitationItem } from "./CitationPopover";
import { CitationChip, Citation } from "./CitationChip";

export type ChatMode = "content" | "ideas" | "free_chat" | "image";

interface FloatingInputProps {
  onSend: (message: string, imageUrls?: string[], quality?: "fast" | "high", mode?: ChatMode, citations?: Citation[]) => void;
  disabled?: boolean;
  templateType?: "free_chat" | "content" | "image";
  placeholder?: string;
  contentLibrary?: Array<{ id: string; title: string; content_type: string; content: string }>;
  referenceLibrary?: Array<{ id: string; title: string; reference_type: string; content: string }>;
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
}: FloatingInputProps) => {
  const [input, setInput] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [mode, setMode] = useState<ChatMode>(
    templateType === "free_chat" ? "free_chat" : 
    templateType === "image" ? "image" : "content"
  );
  const [citations, setCitations] = useState<Citation[]>([]);
  const [showCitationPopover, setShowCitationPopover] = useState(false);
  const [citationSearchQuery, setCitationSearchQuery] = useState("");
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const citationAnchorRef = useRef<HTMLSpanElement>(null);
  const { toast } = useToast();
  const maxChars = 10000;

  useEffect(() => {
    if (templateType === "free_chat") {
      setMode("free_chat");
    } else if (templateType === "image") {
      setMode("image");
    } else if (mode === "free_chat" || mode === "image") {
      setMode("content");
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
    
    // Se tem algum formato (exceto ideias), modo conteúdo
    const hasFormatCitation = citationList.some(c => c.type === "format" && c.category !== "ideias");
    if (hasFormatCitation) return "content";
    
    // Se não tem formato, mas pode ter itens de biblioteca, chat livre
    return "free_chat";
  }, []);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if ((!trimmed && imageFiles.length === 0 && citations.length === 0) || disabled || trimmed.length > maxChars) {
      return;
    }

    let imageUrls: string[] = [];

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

    // Determinar modo baseado nas citações se não for template de imagem
    let effectiveMode: ChatMode;
    if (templateType === "image") {
      effectiveMode = "image";
    } else if (citations.length > 0) {
      // Se tem citações, o modo é determinado por elas
      effectiveMode = getEffectiveModeFromCitations(citations);
    } else {
      // Sem citações = chat livre
      effectiveMode = "free_chat";
    }
    
    const quality = templateType === "image" ? "high" : 
                    effectiveMode === "content" ? "high" : "fast";
    
    onSend(trimmed || "Analise esta imagem", imageUrls, quality, effectiveMode, citations.length > 0 ? citations : undefined);
    setInput("");
    setImageFiles([]);
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

  const isSubmitDisabled = (!input.trim() && imageFiles.length === 0 && citations.length === 0) || disabled || uploadingImages;
  const hasLibraryContent = contentLibrary.length > 0 || referenceLibrary.length > 0;

  return (
    <div className="p-4 space-y-3">
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

      {/* Main Input Container */}
      <div className="relative bg-muted/20 rounded-xl border border-border/30 focus-within:border-border/50 focus-within:bg-muted/30 transition-all">
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
          disabled={disabled || uploadingImages}
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
          
          {/* Action Menu */}
          <ActionMenuPopover
            onImageUpload={() => fileInputRef.current?.click()}
            disabled={disabled || uploadingImages}
          />

          {/* Citation Button */}
          {hasLibraryContent && (
            <Button
              onClick={openCitationPopover}
              variant="ghost"
              size="icon"
              disabled={disabled || uploadingImages}
              className={cn(
                "h-8 w-8 rounded-lg hover:bg-muted/40",
                citations.length > 0
                  ? "text-primary"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
              title="Citar conteúdo (@)"
            >
              <AtSign className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Direct Image Upload */}
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="ghost"
            size="icon"
            disabled={disabled || uploadingImages}
            className="h-8 w-8 rounded-lg hover:bg-muted/40 text-muted-foreground/60 hover:text-muted-foreground"
            title="Anexar imagem"
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </Button>

          {/* Send Button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            size="icon"
            className={cn(
              "h-8 w-8 rounded-lg transition-all",
              isSubmitDisabled 
                ? "bg-muted/50 text-muted-foreground/40" 
                : "bg-foreground hover:bg-foreground/90 text-background"
            )}
          >
            {uploadingImages ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mode indicator based on citations */}
      {templateType === "content" && (
        <div className="flex items-center justify-center">
          <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
            <span>Use</span>
            <span className="font-medium text-foreground/80">@</span>
            <span>para marcar formatos ou biblioteca</span>
          </div>
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
