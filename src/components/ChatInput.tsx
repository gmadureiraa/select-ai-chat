import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { QualitySelector } from "@/components/chat/QualitySelector";
import { ModeSelector, ChatMode } from "@/components/chat/ModeSelector";

interface ChatInputProps {
  onSend: (message: string, imageUrls?: string[], quality?: "fast" | "high", mode?: ChatMode) => void;
  disabled?: boolean;
  showQualitySelector?: boolean;
}

export const ChatInput = ({ onSend, disabled, showQualitySelector = true }: ChatInputProps) => {
  const [input, setInput] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [quality, setQuality] = useState<"fast" | "high">("fast");
  const [mode, setMode] = useState<ChatMode>("content");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const maxChars = 10000;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + "px";
    }
  }, [input]);

  // Focus no textarea quando não estiver desabilitado
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxChars) {
      setInput(value);
      setCharCount(value.length);
    }
  };

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if ((!trimmed && imageFiles.length === 0) || disabled || trimmed.length > maxChars) {
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

    onSend(trimmed || "Analise esta imagem", imageUrls, quality, mode);
    setInput("");
    setCharCount(0);
    setImageFiles([]);
    
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isSubmitDisabled = (!input.trim() && imageFiles.length === 0) || disabled || charCount > maxChars || uploadingImages;

  return (
    <div className="border-t bg-background/80 backdrop-blur-xl p-3">
      <div className="max-w-3xl mx-auto space-y-2.5">
        {/* Seletores de modo e qualidade */}
        {showQualitySelector && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ModeSelector 
                mode={mode} 
                onChange={setMode} 
                disabled={disabled || uploadingImages}
              />
              {mode === "content" && (
                <QualitySelector 
                  quality={quality} 
                  onChange={setQuality} 
                  disabled={disabled || uploadingImages}
                />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground/70">
              {mode === "free_chat"
                ? "Chat livre"
                : mode === "ideas" 
                  ? "Modo ideias" 
                  : quality === "high" 
                    ? "4 agentes" 
                    : "Rápido"
              }
            </span>
          </div>
        )}

        {/* Preview de imagens */}
        {imageFiles.length > 0 && (
          <div className="flex gap-1.5 flex-wrap p-2 bg-muted/30 rounded-xl border border-border/40">
            {imageFiles.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${index + 1}`}
                  className="h-12 w-12 object-cover rounded-lg border border-border/50"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm hover:bg-destructive/90 transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            <span className="text-[10px] text-muted-foreground self-end pb-0.5">
              {imageFiles.length}/5
            </span>
          </div>
        )}

        {/* Input principal */}
        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
          
          {/* Botão de imagem */}
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="ghost"
            size="icon"
            disabled={disabled || uploadingImages}
            className="h-9 w-9 flex-shrink-0 hover:bg-muted/60 rounded-xl"
            title="Anexar imagem"
          >
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </Button>

          {/* Campo de texto */}
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                imageFiles.length > 0 
                  ? "Descreva o que você quer..." 
                  : "Digite sua mensagem..."
              }
              disabled={disabled || uploadingImages}
              className={cn(
                "min-h-[40px] max-h-[160px] resize-none pr-11 rounded-xl border-border/60 text-sm",
                "bg-card/50 focus:bg-card",
                "focus:border-primary/40 focus:ring-1 focus:ring-primary/10",
                "placeholder:text-muted-foreground/50"
              )}
              rows={1}
            />
            
            {/* Botão de enviar */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              size="icon"
              className={cn(
                "absolute right-1 bottom-1 h-7 w-7 rounded-lg transition-all",
                !isSubmitDisabled && "bg-primary hover:bg-primary/90 shadow-sm"
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

        {/* Contador de caracteres */}
        {charCount > maxChars * 0.8 && (
          <div className="text-[10px] text-right">
            <span className={cn(
              charCount > maxChars * 0.9 && charCount <= maxChars && "text-yellow-500",
              charCount >= maxChars && "text-destructive"
            )}>
              {charCount.toLocaleString()}/{maxChars.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
