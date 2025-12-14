import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X, Loader2, Image as ImageIcon, FileText, Lightbulb, MessageCircle, Sparkles, Zap } from "lucide-react";
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ActionMenuPopover } from "./ActionMenuPopover";

export type ChatMode = "content" | "ideas" | "free_chat";

interface FloatingInputProps {
  onSend: (message: string, imageUrls?: string[], quality?: "fast" | "high", mode?: ChatMode) => void;
  disabled?: boolean;
  templateType?: "free_chat" | "content";
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

    const effectiveMode = templateType === "free_chat" ? "free_chat" : mode;
    const quality = modeConfig[effectiveMode].quality;
    
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
                className="h-16 w-16 object-cover rounded-xl border border-border/50"
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

      {/* Main Input Container */}
      <div className="relative bg-muted/40 rounded-2xl border border-border/50 focus-within:border-primary/40 focus-within:bg-muted/60 transition-all shadow-sm">
        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || uploadingImages}
          className={cn(
            "min-h-[52px] max-h-[140px] resize-none border-0 bg-transparent text-sm",
            "px-4 py-3.5 pr-28",
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
            className="h-9 w-9 rounded-xl hover:bg-muted/60 text-muted-foreground"
            title="Anexar imagem"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          {/* Send Button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            size="icon"
            className={cn(
              "h-9 w-9 rounded-xl transition-all",
              !isSubmitDisabled && "bg-primary hover:bg-primary/90 shadow-md"
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

      {/* Mode Selector Pills - Only for content templates */}
      {templateType === "content" && (
        <div className="flex items-center justify-center gap-2">
          {(["content", "ideas", "free_chat"] as ChatMode[]).map((m) => {
            const config = modeConfig[m];
            const Icon = config.icon;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={disabled}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                  mode === m
                    ? config.activeClass
                    : "text-muted-foreground border-transparent hover:bg-muted/50"
                )}
              >
                <Icon className="h-3 w-3" />
                {config.label}
                {mode === m && config.badge && (
                  <span className={cn("ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold", config.badgeClass)}>
                    {config.badge}
                  </span>
                )}
                {mode === m && !config.badge && (
                  <Zap className="h-2.5 w-2.5 ml-0.5 opacity-70" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
