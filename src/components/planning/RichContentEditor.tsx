import { useState, useRef, useCallback } from "react";
import { Bold, Italic, List, ListOrdered, Heading2, Link, Image, Eye, EyeOff, Loader2, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { MentionRenderer } from "./MentionRenderer";
import { ReferencePopup } from "./ReferencePopup";
import { useMentionSearch, MentionItem } from "@/hooks/useMentionSearch";
import { createMentionString } from "@/lib/mentionParser";
import { FileText, BookOpen } from "lucide-react";

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
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPosition, setMentionStartPosition] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupType, setPopupType] = useState<'content' | 'reference'>('content');
  const [popupId, setPopupId] = useState("");
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { items: mentionItems, isLoading: isLoadingMentions } = useMentionSearch(clientId, mentionQuery);

  const handleMentionDoubleClick = useCallback((type: 'content' | 'reference', id: string) => {
    setPopupType(type);
    setPopupId(id);
    setPopupOpen(true);
  }, []);

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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart || 0;
    
    onChange(newValue);

    // Detecta se está digitando uma menção
    const textBeforeCursor = newValue.substring(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Verifica se não há espaço ou quebra de linha após o @
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n') && textAfterAt.length <= 30) {
        setMentionStartPosition(lastAtIndex);
        setMentionQuery(textAfterAt);
        setShowMentionPopover(true);
        setSelectedMentionIndex(0);
        return;
      }
    }
    
    setShowMentionPopover(false);
    setMentionStartPosition(null);
    setMentionQuery("");
  };

  const insertMention = useCallback((item: MentionItem) => {
    if (mentionStartPosition === null) return;

    const cursor = textareaRef.current?.selectionStart || value.length;
    const beforeMention = value.substring(0, mentionStartPosition);
    const afterMention = value.substring(cursor);
    const mentionStr = createMentionString(item.title, item.type, item.id);
    
    const newValue = beforeMention + mentionStr + ' ' + afterMention;
    onChange(newValue);
    
    setShowMentionPopover(false);
    setMentionStartPosition(null);
    setMentionQuery("");

    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = beforeMention.length + mentionStr.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  }, [value, onChange, mentionStartPosition]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle mention navigation
    if (showMentionPopover && mentionItems.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedMentionIndex(prev => (prev + 1) % mentionItems.length);
          return;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedMentionIndex(prev => (prev - 1 + mentionItems.length) % mentionItems.length);
          return;
        case 'Enter':
          e.preventDefault();
          if (mentionItems[selectedMentionIndex]) {
            insertMention(mentionItems[selectedMentionIndex]);
          }
          return;
        case 'Escape':
          e.preventDefault();
          setShowMentionPopover(false);
          return;
      }
    }

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
    <div className={cn("space-y-2 rounded-xl border border-border/50 p-4 shadow-sm", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-border/30">
        <div className="flex items-center gap-0.5">
          {toolbarButtons.map((btn, idx) => (
            <Button
              key={idx}
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-muted/50"
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
            className="h-7 w-7 hover:bg-muted/50"
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
          className="h-7 text-xs gap-1 hover:bg-muted/50"
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
        <div className="min-h-[150px] p-4 rounded-lg border border-border/50 bg-background prose prose-sm dark:prose-invert max-w-none">
          <MentionRenderer 
            text={value || "*Nenhum conteúdo*"} 
            onMentionDoubleClick={handleMentionDoubleClick}
          />
        </div>
      ) : (
        <Popover open={showMentionPopover} onOpenChange={setShowMentionPopover}>
          <PopoverAnchor asChild>
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={handleTextareaChange}
              placeholder={placeholder}
              className="resize-none font-mono text-sm min-h-[150px] rounded-lg border-border/50"
              rows={minRows}
              onKeyDown={handleKeyDown}
            />
          </PopoverAnchor>
          <PopoverContent 
            className="w-72 p-0" 
            align="start" 
            side="bottom"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="p-2 border-b">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AtSign className="h-3 w-3" />
                {mentionQuery ? `Buscando "${mentionQuery}"...` : 'Digite para buscar referências'}
              </p>
            </div>
            <ScrollArea className="max-h-60">
              {isLoadingMentions ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : mentionItems.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {mentionQuery ? 'Nenhuma referência encontrada' : 'Digite para buscar'}
                </div>
              ) : (
                <div className="p-1">
                  {mentionItems.map((item, index) => {
                    const Icon = item.type === 'content' ? FileText : BookOpen;
                    return (
                      <button
                        key={item.id}
                        className={cn(
                          "w-full flex items-start gap-2 p-2 rounded-md text-left text-sm transition-colors",
                          index === selectedMentionIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted"
                        )}
                        onClick={() => insertMention(item)}
                        onMouseEnter={() => setSelectedMentionIndex(index)}
                        type="button"
                      >
                        <div className={cn(
                          "p-1 rounded",
                          item.type === 'content' ? "bg-primary/10" : "bg-amber-500/10"
                        )}>
                          <Icon className={cn(
                            "h-3.5 w-3.5",
                            item.type === 'content' ? "text-primary" : "text-amber-600 dark:text-amber-400"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.category}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}
      
      {/* Help text */}
      <p className="text-[10px] text-muted-foreground">
        Suporta Markdown e @menções. Use @ para citar referências. Ctrl+B negrito, Ctrl+I itálico
      </p>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      <ReferencePopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        type={popupType}
        id={popupId}
      />
    </div>
  );
}