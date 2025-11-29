import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

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
          const fileExt = file.name.split('.').pop();
          const fileName = `chat-images/${crypto.randomUUID()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('client-files')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('client-files')
            .getPublicUrl(fileName);

          return publicUrl;
        });

        imageUrls = await Promise.all(uploadPromises);
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

    onSend(trimmed || "Veja a(s) imagem(ns) anexada(s)", imageUrls);
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
        description: "Você pode enviar no máximo 5 imagens por mensagem.",
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

  const isDisabled = disabled || uploadingImages;
  const canSubmit = (input.trim() || imageFiles.length > 0) && !isDisabled && charCount <= maxChars;

  return (
    <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-5xl mx-auto px-3 md:px-6 py-3 md:py-4">
        {/* Image previews */}
        {imageFiles.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3 animate-fade-in">
            {imageFiles.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${index + 1}`}
                  className="h-14 w-14 md:h-16 md:w-16 object-cover rounded-lg border shadow-sm"
                />
                <button
                  onClick={() => removeImage(index)}
                  disabled={isDisabled}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="flex gap-2 items-end">
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
            disabled={isDisabled || imageFiles.length >= 5}
            className="h-10 w-10 md:h-11 md:w-11 flex-shrink-0 hover:bg-muted transition-colors"
            title="Adicionar imagens (máx. 5)"
          >
            <ImageIcon className="h-4 w-4 md:h-5 md:w-5" />
          </Button>

          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              disabled={isDisabled}
              className={cn(
                "min-h-[44px] md:min-h-[52px] max-h-[180px] resize-none",
                "pr-11 md:pr-12 py-2.5 md:py-3 text-sm md:text-base",
                "rounded-2xl border-border bg-background",
                "focus:border-primary focus:ring-2 focus:ring-primary/20",
                "transition-all duration-200",
                "placeholder:text-muted-foreground/60"
              )}
              rows={1}
            />
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              size="icon"
              className={cn(
                "absolute right-1 bottom-1 h-8 w-8 md:h-9 md:w-9",
                "transition-all duration-200",
                canSubmit && "bg-primary hover:bg-primary/90"
              )}
            >
              {uploadingImages ? (
                <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Character counter */}
        {charCount > 0 && (
          <div className="text-xs text-muted-foreground text-right mt-1.5 px-1 animate-fade-in">
            {charCount.toLocaleString()}/{maxChars.toLocaleString()}
            {charCount > maxChars * 0.9 && charCount <= maxChars && (
              <span className="text-yellow-500 ml-1.5">• próximo do limite</span>
            )}
            {charCount >= maxChars && (
              <span className="text-destructive ml-1.5">• limite atingido</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};