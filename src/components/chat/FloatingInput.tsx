import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X, Loader2, Image as ImageIcon, FileText, Lightbulb, MessageCircle, Sparkles, Zap } from "lucide-react";
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ActionMenuPopover } from "./ActionMenuPopover";

export type ChatMode = "content" | "ideas" | "free_chat" | "image";

interface FloatingInputProps {
  onSend: (message: string, imageUrls?: string[], quality?: "fast" | "high", mode?: ChatMode) => void;
  disabled?: boolean;
  templateType?: "free_chat" | "content" | "image";
  placeholder?: string;
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
  placeholder = "Digite sua mensagem...",
}: FloatingInputProps) => {
  const [input, setInput] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [mode, setMode] = useState<ChatMode>(
    templateType === "free_chat" ? "free_chat" : 
    templateType === "image" ? "image" : "content"
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

    const effectiveMode = templateType === "free_chat" ? "free_chat" : 
                          templateType === "image" ? "image" : mode;
    const quality = templateType === "image" ? "high" : (modeConfig[effectiveMode as keyof typeof modeConfig]?.quality || "fast");
    
    onSend(trimmed || "Analise esta imagem", imageUrls, quality, effectiveMode);
    setInput("");
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

  const isSubmitDisabled = (!input.trim() && imageFiles.length === 0) || disabled || uploadingImages;

  return (
    <div className="p-4 space-y-3">
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
        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || uploadingImages}
          className={cn(
            "min-h-[48px] max-h-[120px] resize-none border-0 bg-transparent text-sm",
            "px-4 py-3 pr-24",
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

      {/* Mode Selector Pills - Only for content templates (NOT for image templates) */}
      {templateType === "content" && (
        <div className="flex items-center justify-center gap-1.5">
          {(["content", "ideas", "free_chat"] as ChatMode[]).map((m) => {
            const config = modeConfig[m];
            const Icon = config.icon;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={disabled}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                  mode === m
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30"
                )}
              >
                <Icon className="h-3 w-3" />
                {config.label}
              </button>
            );
          })}
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
