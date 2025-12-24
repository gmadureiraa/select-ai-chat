import { useState, useRef, useCallback } from "react";
import { Bold, Italic, List, ListOrdered, Heading2, Link, Image, Upload, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface RichContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  clientId?: string;
}

export function RichContentEditor({ 
  value, 
  onChange, 
  placeholder = "Digite aqui...",
  className,
  minRows = 6,
  clientId
}: RichContentEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = clientId 
        ? `content/${clientId}/${fileName}` 
        : `content/general/${fileName}`;

      const { data, error } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(data.path);

      // Insert markdown image at cursor position
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const imageMarkdown = `\n![${file.name}](${urlData.publicUrl})\n`;
        
        const newValue = 
          value.substring(0, start) + 
          imageMarkdown + 
          value.substring(start);
        
        onChange(newValue);
        toast.success('Imagem inserida');
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
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
    <div className={cn("space-y-1", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-1 bg-muted/50 rounded-md border border-border">
        <div className="flex items-center gap-0.5">
          {toolbarButtons.map((btn, idx) => (
            <Button
              key={idx}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                btn.action();
              }}
              title={btn.title}
              type="button"
            >
              <btn.icon className="h-3.5 w-3.5" />
            </Button>
          ))}
          
          <div className="w-px h-4 bg-border mx-1" />
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.preventDefault();
              fileInputRef.current?.click();
            }}
            disabled={isUploading}
            title="Inserir imagem"
            type="button"
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Image className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={(e) => {
            e.preventDefault();
            setShowPreview(!showPreview);
          }}
          type="button"
        >
          {showPreview ? (
            <>
              <EyeOff className="h-3 w-3" />
              Editar
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              Preview
            </>
          )}
        </Button>
      </div>
      
      {/* Editor / Preview */}
      {showPreview ? (
        <div className="min-h-[150px] p-3 rounded-md border border-border bg-background prose prose-sm dark:prose-invert max-w-none">
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
          className="resize-none font-mono text-sm min-h-[150px]"
          rows={minRows}
          onKeyDown={handleKeyDown}
        />
      )}
      
      {/* Help text */}
      <p className="text-[10px] text-muted-foreground">
        Suporta Markdown. Use ![alt](url) para imagens inline. Ctrl+B negrito, Ctrl+I itálico
      </p>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </div>
  );
}