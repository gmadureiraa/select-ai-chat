import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Image as ImageIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
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

  return (
    <div className="border-t bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-2">
        {imageFiles.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {imageFiles.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${index + 1}`}
                  className="h-20 w-20 object-cover rounded border"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
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
            variant="outline"
            size="icon"
            disabled={disabled || uploadingImages}
            className="h-[60px] w-[60px] flex-shrink-0"
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={disabled || uploadingImages}
            className="min-h-[60px] max-h-[200px] resize-none"
            rows={1}
          />
          <Button
            onClick={handleSubmit}
            disabled={(!input.trim() && imageFiles.length === 0) || disabled || charCount > maxChars || uploadingImages}
            size="icon"
            className="h-[60px] w-[60px] flex-shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
        {charCount > 0 && (
          <div className="text-xs text-muted-foreground text-right">
            {charCount}/{maxChars} caracteres
            {charCount > maxChars * 0.9 && charCount <= maxChars && (
              <span className="text-yellow-500 ml-1">
                (próximo do limite)
              </span>
            )}
            {charCount >= maxChars && (
              <span className="text-destructive ml-1">
                (limite atingido)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
