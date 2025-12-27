import { useState, useRef, useCallback } from "react";
import { Bold, Italic, List, ListOrdered, Heading2, Link, Image, FileText, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetSignedUrl } from "@/lib/storage";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface ContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  clientId?: string;
}

export function ContentEditor({ 
  value, 
  onChange, 
  placeholder = "Digite o conteúdo aqui...",
  className,
  minRows = 12,
  clientId
}: ContentEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const transcribeInputRef = useRef<HTMLInputElement>(null);

  const insertMarkdown = useCallback((prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    const newValue = 
      value.substring(0, start) + 
      prefix + selectedText + suffix + 
      value.substring(end);
    
    onChange(newValue);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
      textarea.setSelectionRange(
        selectedText ? newCursorPos : start + prefix.length,
        selectedText ? newCursorPos : start + prefix.length
      );
    }, 0);
  }, [value, onChange]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    setIsUploadingImage(true);

    try {
      const { signedUrl, error } = await uploadAndGetSignedUrl(file, "content-images");

      if (error) throw error;

      if (signedUrl) {
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const imageMarkdown = `\n![${file.name}](${signedUrl})\n`;
          
          const newValue = 
            value.substring(0, start) + 
            imageMarkdown + 
            value.substring(start);
          
          onChange(newValue);
          toast.success('Imagem inserida');
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const handleTranscribeImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsTranscribing(true);

    try {
      // Upload all images first
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < Math.min(files.length, 10); i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        
        const { signedUrl, error } = await uploadAndGetSignedUrl(file, "content-images");
        if (error) throw error;
        if (signedUrl) uploadedUrls.push(signedUrl);
      }

      if (uploadedUrls.length === 0) {
        toast.error('Nenhuma imagem válida encontrada');
        return;
      }

      // Now transcribe
      const { data, error } = await supabase.functions.invoke('transcribe-images', {
        body: { imageUrls: uploadedUrls }
      });

      if (error) throw error;

      // Insert transcribed text at cursor
      const textarea = textareaRef.current;
      if (textarea && data?.transcription) {
        const start = textarea.selectionStart;
        const transcribedText = `\n\n--- CONTEÚDO TRANSCRITO ---\n${data.transcription}\n`;
        
        const newValue = 
          value.substring(0, start) + 
          transcribedText + 
          value.substring(start);
        
        onChange(newValue);
        toast.success(`${uploadedUrls.length} imagem(ns) transcrita(s)`);
      }
    } catch (err) {
      console.error('Transcription error:', err);
      toast.error('Erro ao transcrever imagens');
    } finally {
      setIsTranscribing(false);
      if (transcribeInputRef.current) {
        transcribeInputRef.current.value = '';
      }
    }
  };

  const toolbarButtons = [
    { icon: Bold, action: () => insertMarkdown("**", "**"), title: "Negrito" },
    { icon: Italic, action: () => insertMarkdown("*", "*"), title: "Itálico" },
    { icon: Heading2, action: () => insertMarkdown("## ", ""), title: "Título" },
    { icon: List, action: () => insertMarkdown("- ", ""), title: "Lista" },
    { icon: ListOrdered, action: () => insertMarkdown("1. ", ""), title: "Lista numerada" },
    { icon: Link, action: () => insertMarkdown("[", "](url)"), title: "Link" },
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.stopPropagation();
    }
    
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case "b":
          e.preventDefault();
          insertMarkdown("**", "**");
          break;
        case "i":
          e.preventDefault();
          insertMarkdown("*", "*");
          break;
      }
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-1.5 bg-muted/50 rounded-md border border-border">
        <div className="flex items-center gap-0.5 flex-wrap">
          {toolbarButtons.map((btn, idx) => (
            <Button
              key={idx}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                btn.action();
              }}
              title={btn.title}
              type="button"
            >
              <btn.icon className="h-4 w-4" />
            </Button>
          ))}
          
          <div className="w-px h-5 bg-border mx-1.5" />
          
          {/* Insert Image Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={(e) => {
              e.preventDefault();
              imageInputRef.current?.click();
            }}
            disabled={isUploadingImage}
            title="Inserir imagem"
            type="button"
          >
            {isUploadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Image className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Inserir</span>
          </Button>
          
          {/* Transcribe Images Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={(e) => {
              e.preventDefault();
              transcribeInputRef.current?.click();
            }}
            disabled={isTranscribing}
            title="Transcrever imagem(ns)"
            type="button"
          >
            {isTranscribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Transcrever</span>
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={(e) => {
            e.preventDefault();
            setShowPreview(!showPreview);
          }}
          type="button"
        >
          {showPreview ? (
            <>
              <EyeOff className="h-4 w-4" />
              <span className="hidden sm:inline">Editar</span>
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </>
          )}
        </Button>
      </div>
      
      {/* Editor / Preview */}
      {showPreview ? (
        <div className="min-h-[300px] p-4 rounded-md border border-border bg-background prose prose-sm dark:prose-invert max-w-none overflow-auto">
          <ReactMarkdown
            components={{
              img: ({ node, ...props }) => (
                <img {...props} className="max-w-full h-auto rounded-md my-2" />
              ),
            }}
          >
            {value || "*Nenhum conteúdo*"}
          </ReactMarkdown>
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="resize-none font-mono text-sm min-h-[300px]"
          rows={minRows}
          onKeyDown={handleKeyDown}
        />
      )}
      
      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        Suporta Markdown. Use ![alt](url) para imagens inline. Ctrl+B negrito, Ctrl+I itálico
      </p>
      
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
      <input
        ref={transcribeInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleTranscribeImages}
        className="hidden"
      />
    </div>
  );
}
