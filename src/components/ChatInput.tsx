import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string, imageUrls?: string[]) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [input, setInput] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
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

    onSend(trimmed || "Analise esta imagem", imageUrls);
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
    <div className="border-t bg-background/95 backdrop-blur-sm p-3 sm:p-4">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Preview de imagens */}
        {imageFiles.length > 0 && (
          <div className="flex gap-2 flex-wrap p-2 bg-muted/30 rounded-lg">
            {imageFiles.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${index + 1}`}
                  className="h-14 w-14 object-cover rounded-md border border-border"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm hover:bg-destructive/90 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <span className="text-xs text-muted-foreground self-end pb-1">
              {imageFiles.length}/5 imagens
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
            className="h-10 w-10 flex-shrink-0 hover:bg-muted rounded-xl"
            title="Anexar imagem"
          >
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
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
                  ? "Descreva o que você quer sobre as imagens..." 
                  : "Digite sua mensagem..."
              }
              disabled={disabled || uploadingImages}
              className={cn(
                "min-h-[44px] max-h-[180px] resize-none pr-12 rounded-xl border-border",
                "focus:border-primary/50 focus:ring-1 focus:ring-primary/20",
                "placeholder:text-muted-foreground/60"
              )}
              rows={1}
            />
            
            {/* Botão de enviar */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              size="icon"
              className={cn(
                "absolute right-1.5 bottom-1.5 h-8 w-8 rounded-lg transition-all",
                !isSubmitDisabled && "bg-primary hover:bg-primary/90"
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

        {/* Contador de caracteres */}
        {charCount > maxChars * 0.8 && (
          <div className="text-xs text-right px-1">
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
