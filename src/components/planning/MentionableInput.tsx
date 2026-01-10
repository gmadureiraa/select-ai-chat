import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { useMentionSearch, MentionItem } from "@/hooks/useMentionSearch";
import { createMentionString } from "@/lib/mentionParser";
import { MentionRenderer } from "./MentionRenderer";
import { ReferencePopup } from "./ReferencePopup";
import { cn } from "@/lib/utils";
import { FileText, BookOpen, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MentionableInputProps {
  value: string;
  onChange: (value: string) => void;
  clientId?: string;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
}

export function MentionableInput({
  value,
  onChange,
  clientId,
  placeholder,
  className,
  multiline = false,
  rows = 3,
  disabled = false
}: MentionableInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionStartPosition, setMentionStartPosition] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const { items, isLoading } = useMentionSearch(clientId, searchQuery);

  // Popup state
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupType, setPopupType] = useState<'content' | 'reference'>('content');
  const [popupId, setPopupId] = useState("");

  const handleMentionDoubleClick = useCallback((type: 'content' | 'reference', id: string) => {
    setPopupType(type);
    setPopupId(id);
    setPopupOpen(true);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(cursor);

    // Detecta se está digitando uma menção
    const textBeforeCursor = newValue.substring(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Verifica se não há espaço ou quebra de linha após o @
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n') && textAfterAt.length <= 30) {
        setMentionStartPosition(lastAtIndex);
        setSearchQuery(textAfterAt);
        setShowPopover(true);
        setSelectedIndex(0);
        return;
      }
    }
    
    setShowPopover(false);
    setMentionStartPosition(null);
    setSearchQuery("");
  };

  const insertMention = useCallback((item: MentionItem) => {
    if (mentionStartPosition === null) return;

    const beforeMention = value.substring(0, mentionStartPosition);
    const afterMention = value.substring(cursorPosition);
    const mentionStr = createMentionString(item.title, item.type, item.id);
    
    const newValue = beforeMention + mentionStr + ' ' + afterMention;
    onChange(newValue);
    
    setShowPopover(false);
    setMentionStartPosition(null);
    setSearchQuery("");

    // Foca no input após inserir
    setTimeout(() => {
      if (inputRef.current) {
        const newPosition = beforeMention.length + mentionStr.length + 1;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  }, [value, onChange, mentionStartPosition, cursorPosition]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showPopover || items.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (items[selectedIndex]) {
          insertMention(items[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowPopover(false);
        break;
    }
  };

  const InputComponent = multiline ? Textarea : Input;

  return (
    <>
      <Popover open={showPopover} onOpenChange={setShowPopover}>
        <PopoverAnchor asChild>
          <div className="relative">
            {isEditing ? (
              <InputComponent
                ref={inputRef as any}
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  // Delay para permitir clique no popover
                  setTimeout(() => setIsEditing(false), 200);
                }}
                placeholder={placeholder}
                className={className}
                rows={multiline ? rows : undefined}
                autoFocus
              />
            ) : (
              <div
                className={cn(
                  "cursor-text border rounded-md px-3 py-2 text-sm bg-background hover:border-primary/50 transition-colors",
                  "min-h-[38px] flex items-center flex-wrap gap-1 break-all",
                  multiline && "min-h-[80px] items-start",
                  !value && "text-muted-foreground",
                  disabled && "opacity-60 cursor-not-allowed",
                  className
                )}
                onClick={() => !disabled && setIsEditing(true)}
              >
                {value ? (
                  <MentionRenderer 
                    text={value} 
                    onMentionDoubleClick={handleMentionDoubleClick}
                  />
                ) : (
                  placeholder
                )}
              </div>
            )}
          </div>
        </PopoverAnchor>

        <PopoverContent 
          className="w-72 p-0" 
          align="start" 
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="p-2 border-b">
            <p className="text-xs text-muted-foreground">
              {searchQuery ? `Buscando "${searchQuery}"...` : 'Digite para buscar referências'}
            </p>
          </div>
          <ScrollArea className="max-h-60">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'Nenhuma referência encontrada' : 'Digite para buscar'}
              </div>
            ) : (
              <div className="p-1">
                {items.map((item, index) => {
                  const Icon = item.type === 'content' ? FileText : BookOpen;
                  return (
                    <button
                      key={item.id}
                      className={cn(
                        "w-full flex items-start gap-2 p-2 rounded-md text-left text-sm transition-colors",
                        index === selectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted"
                      )}
                      onClick={() => insertMention(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
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

      {popupId && (
        <ReferencePopup
          open={popupOpen}
          onClose={() => setPopupOpen(false)}
          type={popupType}
          id={popupId}
        />
      )}
    </>
  );
}
