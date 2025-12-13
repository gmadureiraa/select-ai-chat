import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ModeSelector, ChatMode } from "@/components/chat/ModeSelector";

interface ChatInputProps {
  onSend: (message: string, imageUrls?: string[], quality?: "fast" | "high", mode?: ChatMode) => void;
  disabled?: boolean;
  templateType?: "free_chat" | "content";
}

export const ChatInput = ({ onSend, disabled, templateType = "content" }: ChatInputProps) => {
  const [input, setInput] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [mode, setMode] = useState<ChatMode>(templateType === "free_chat" ? "free_chat" : "content");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const maxChars = 10000;

  useEffect(() => {
    if (templateType === "free_chat") {
      setMode("free_chat");
    } else if (mode === "free_chat") {
      setMode("content");
    }
  }, [templateType]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

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

  const getQualityForMode = (m: ChatMode): "fast" | "high" => {
    return m === "content" ? "high" : "fast";
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

    const effectiveMode = templateType === "free_chat" ? "free_chat" : mode;
    const quality = getQualityForMode(effectiveMode);
    
    onSend(trimmed || "Analise esta imagem", imageUrls, quality, effectiveMode);
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

  const getStatusText = () => {
    if (templateType === "free_chat") return null;
    if (mode === "content") return "Alta qualidade • 4 agentes";
    if (mode === "ideas") return "Ideias • Rápido";
    return "Chat • Rápido";
  };

  const getPlaceholder = () => {
    if (templateType === "free_chat") {
      return "Pergunte sobre o cliente...";
    }
    if (imageFiles.length > 0) {
      return "Descreva o que você quer...";
    }
    return "Digite sua mensagem...";
  };

  return (
    <div className="p-4">
      <div className="space-y-3">
        {/* Mode Selector - Compact pill style for content templates */}
        {templateType === "content" && (
          <div className="flex items-center justify-center">
            <ModeSelector 
              mode={mode} 
              onChange={setMode} 
              disabled={disabled || uploadingImages}
            />
          </div>
        )}

        {/* Image Preview */}
        {imageFiles.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {imageFiles.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${index + 1}`}
                  className="h-14 w-14 object-cover rounded-lg border border-border/50"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm hover:bg-destructive/90 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main Input Area - Gemini/Manus Style */}
        <div className="relative bg-muted/30 rounded-2xl border border-border/40 focus-within:border-primary/30 focus-within:bg-muted/50 transition-all">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={disabled || uploadingImages}
            className={cn(
              "min-h-[48px] max-h-[140px] resize-none border-0 bg-transparent text-sm px-4 py-3.5 pr-24",
              "focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-muted-foreground/50"
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
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="ghost"
              size="icon"
              disabled={disabled || uploadingImages}
              className="h-8 w-8 rounded-lg hover:bg-muted/60"
              title="Anexar imagem"
            >
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              size="icon"
              className={cn(
                "h-8 w-8 rounded-lg transition-all",
                !isSubmitDisabled && "bg-primary hover:bg-primary/90 shadow-sm"
              )}
            >
              {uploadingImages ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Status Footer */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            {charCount > maxChars * 0.8 && (
              <span className={cn(
                "text-[10px]",
                charCount > maxChars * 0.9 && charCount <= maxChars && "text-yellow-500",
                charCount >= maxChars && "text-destructive"
              )}>
                {charCount.toLocaleString()}/{maxChars.toLocaleString()}
              </span>
            )}
          </div>
          {getStatusText() && (
            <span className="text-[10px] text-muted-foreground/60">
              {getStatusText()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
