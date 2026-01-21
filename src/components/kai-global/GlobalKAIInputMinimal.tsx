import { useState, useRef, KeyboardEvent, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, X, FileText, Image, Loader2, File, FileSpreadsheet, AtSign, BookOpen, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { KAIFileAttachment } from "@/types/kaiActions";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SimpleCitation } from "@/hooks/useKAISimpleChat";

interface GlobalKAIInputMinimalProps {
  onSend: (message: string, files?: File[], citations?: SimpleCitation[]) => Promise<void>;
  isProcessing: boolean;
  attachedFiles: KAIFileAttachment[];
  onAttachFiles: (files: File[]) => void;
  onRemoveFile: (fileId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clientId?: string;
  contentLibrary?: { id: string; title: string; content_type: string }[];
  referenceLibrary?: { id: string; title: string; reference_type: string }[];
}

const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Predefined formats
const FORMATS = [
  { id: "carrossel", title: "Carrossel", type: "format" },
  { id: "post", title: "Post", type: "format" },
  { id: "newsletter", title: "Newsletter", type: "format" },
  { id: "thread", title: "Thread", type: "format" },
  { id: "reels", title: "Roteiro Reels", type: "format" },
  { id: "stories", title: "Stories", type: "format" },
];

export function GlobalKAIInputMinimal({
  onSend,
  isProcessing,
  attachedFiles,
  onAttachFiles,
  onRemoveFile,
  placeholder = "Pergunte qualquer coisa... Use @ para citar",
  disabled = false,
  clientId,
  contentLibrary = [],
  referenceLibrary = [],
}: GlobalKAIInputMinimalProps) {
  const [message, setMessage] = useState("");
  const [citations, setCitations] = useState<SimpleCitation[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Build mention items
  const mentionItems = [
    ...FORMATS.map(f => ({ id: f.id, title: f.title, type: "format" as const, category: "Formato" })),
    ...contentLibrary.slice(0, 10).map(c => ({ 
      id: c.id, 
      title: c.title, 
      type: "content" as const, 
      category: c.content_type 
    })),
    ...referenceLibrary.slice(0, 10).map(r => ({ 
      id: r.id, 
      title: r.title, 
      type: "reference" as const, 
      category: r.reference_type 
    })),
  ];

  // Filter mentions by search
  const filteredMentions = mentionSearch 
    ? mentionItems.filter(item => 
        item.title.toLowerCase().includes(mentionSearch.toLowerCase())
      )
    : mentionItems;

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Detect @ for mentions
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const afterAt = value.slice(lastAtIndex + 1);
      // Check if we're still typing a mention (no space after @)
      if (!afterAt.includes(" ") && afterAt.length < 30) {
        setMentionSearch(afterAt);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const handleSelectMention = (item: typeof mentionItems[0]) => {
    // Add to citations if not already there
    if (!citations.find(c => c.id === item.id && c.type === item.type)) {
      setCitations(prev => [...prev, { id: item.id, type: item.type, title: item.title }]);
    }

    // Remove the @search from message
    const lastAtIndex = message.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      setMessage(message.slice(0, lastAtIndex));
    }

    setShowMentions(false);
    setMentionSearch("");
    textareaRef.current?.focus();
  };

  const removeCitation = (id: string) => {
    setCitations(prev => prev.filter(c => c.id !== id));
  };

  const handleSend = async () => {
    if (!message.trim() && attachedFiles.length === 0) return;
    if (isProcessing || disabled) return;

    const MAX_MESSAGE_LENGTH = 25000;
    if (message.trim().length > MAX_MESSAGE_LENGTH) {
      toast.error(`Mensagem muito longa. Máximo: ${MAX_MESSAGE_LENGTH.toLocaleString()} caracteres.`);
      return;
    }

    const files = attachedFiles.map((f) => f.file);
    await onSend(message.trim(), files.length > 0 ? files : undefined, citations.length > 0 ? citations : undefined);
    setMessage("");
    setCitations([]);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Close mentions on Escape
    if (e.key === "Escape" && showMentions) {
      e.preventDefault();
      setShowMentions(false);
      return;
    }

    // Select first mention on Tab/Enter when popover is open
    if ((e.key === "Tab" || e.key === "Enter") && showMentions && filteredMentions.length > 0) {
      e.preventDefault();
      handleSelectMention(filteredMentions[0]);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const remainingSlots = MAX_FILES - attachedFiles.length;
    if (remainingSlots <= 0) {
      toast.error(`Limite de ${MAX_FILES} arquivos atingido`);
      return;
    }
    
    const validFiles = files.slice(0, remainingSlots).filter(f => f.size <= MAX_FILE_SIZE);
    if (validFiles.length > 0) {
      onAttachFiles(validFiles);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const pastedFiles: File[] = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }

    if (pastedFiles.length > 0) {
      const remainingSlots = MAX_FILES - attachedFiles.length;
      if (remainingSlots <= 0) {
        toast.error(`Limite de ${MAX_FILES} arquivos atingido`);
        return;
      }
      e.preventDefault();
      onAttachFiles(pastedFiles.slice(0, remainingSlots));
    }
  }, [onAttachFiles, attachedFiles.length]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    const remainingSlots = MAX_FILES - attachedFiles.length;
    if (remainingSlots <= 0) {
      toast.error(`Limite de ${MAX_FILES} arquivos atingido`);
      return;
    }
    
    const validFiles = files.slice(0, remainingSlots).filter(f => f.size <= MAX_FILE_SIZE);
    if (validFiles.length > 0) {
      onAttachFiles(validFiles);
    }
  };

  const getFileIcon = (type: string, name: string) => {
    if (type.startsWith("image/")) return Image;
    if (type.includes("spreadsheet") || name.endsWith(".csv")) return FileSpreadsheet;
    if (type.includes("pdf") || type.includes("document")) return FileText;
    return File;
  };

  const getCitationIcon = (type: string) => {
    if (type === "format") return Layers;
    if (type === "content") return FileText;
    return BookOpen;
  };

  return (
    <div 
      className={cn(
        "border-t border-border bg-background p-3 transition-colors",
        isDragOver && "bg-muted/50"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Citations preview */}
      <AnimatePresence>
        {citations.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5">
              {citations.map((citation) => {
                const Icon = getCitationIcon(citation.type);
                return (
                  <Badge
                    key={`${citation.type}-${citation.id}`}
                    variant="outline"
                    className="gap-1.5 pr-1 max-w-[150px] bg-primary/5 border-primary/20 text-primary"
                  >
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate text-xs">{citation.title}</span>
                    <button
                      onClick={() => removeCitation(citation.id)}
                      className="ml-0.5 p-0.5 rounded-full hover:bg-primary/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attached files preview */}
      <AnimatePresence>
        {attachedFiles.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5">
              {attachedFiles.map((file) => {
                const Icon = getFileIcon(file.type, file.name);
                return (
                  <Badge
                    key={file.id}
                    variant="secondary"
                    className="gap-1.5 pr-1 max-w-[150px] bg-muted"
                  >
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate text-xs">{file.name}</span>
                    <button
                      onClick={() => onRemoveFile(file.id)}
                      className="ml-0.5 p-0.5 rounded-full hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mentions popover */}
      <Popover open={showMentions} onOpenChange={setShowMentions}>
        <PopoverTrigger asChild>
          <div /> {/* Hidden trigger */}
        </PopoverTrigger>
        <PopoverContent 
          className="w-64 p-0" 
          align="start"
          side="top"
          sideOffset={8}
        >
          <ScrollArea className="max-h-60">
            <div className="p-1">
              {filteredMentions.length === 0 ? (
                <div className="text-sm text-muted-foreground p-2 text-center">
                  Nenhum resultado
                </div>
              ) : (
                filteredMentions.map((item) => {
                  const Icon = getCitationIcon(item.type);
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleSelectMention(item)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{item.title}</div>
                        <div className="text-xs text-muted-foreground">{item.category}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* File upload */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="*/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing || disabled || attachedFiles.length >= MAX_FILES}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* @ button for mentions */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => {
            setMessage(prev => prev + "@");
            setShowMentions(true);
            textareaRef.current?.focus();
          }}
          disabled={isProcessing || disabled}
        >
          <AtSign className="h-4 w-4" />
        </Button>

        {/* Text input */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={isProcessing || disabled}
          rows={1}
          className={cn(
            "flex-1 min-h-[36px] max-h-[120px] resize-none py-2 px-3",
            "bg-muted border-0 rounded-lg",
            "focus-visible:ring-1 focus-visible:ring-ring",
            "placeholder:text-muted-foreground/60"
          )}
        />

        {/* Send button */}
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleSend}
          disabled={(!message.trim() && attachedFiles.length === 0) || isProcessing || disabled}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Minimal hint */}
      <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
        Enter para enviar · @ para citar · Shift+Enter para nova linha
      </p>
    </div>
  );
}
