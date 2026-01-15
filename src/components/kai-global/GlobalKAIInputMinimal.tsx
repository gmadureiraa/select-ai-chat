import { useState, useRef, KeyboardEvent, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, X, FileText, Image, Loader2, File, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { KAIFileAttachment } from "@/types/kaiActions";
import { toast } from "sonner";

interface GlobalKAIInputMinimalProps {
  onSend: (message: string, files?: File[]) => Promise<void>;
  isProcessing: boolean;
  attachedFiles: KAIFileAttachment[];
  onAttachFiles: (files: File[]) => void;
  onRemoveFile: (fileId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function GlobalKAIInputMinimal({
  onSend,
  isProcessing,
  attachedFiles,
  onAttachFiles,
  onRemoveFile,
  placeholder = "Pergunte qualquer coisa...",
  disabled = false,
}: GlobalKAIInputMinimalProps) {
  const [message, setMessage] = useState("");
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

  const handleSend = async () => {
    if (!message.trim() && attachedFiles.length === 0) return;
    if (isProcessing || disabled) return;

    const MAX_MESSAGE_LENGTH = 25000;
    if (message.trim().length > MAX_MESSAGE_LENGTH) {
      toast.error(`Mensagem muito longa. Máximo: ${MAX_MESSAGE_LENGTH.toLocaleString()} caracteres.`);
      return;
    }

    const files = attachedFiles.map((f) => f.file);
    await onSend(message.trim(), files.length > 0 ? files : undefined);
    setMessage("");
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div 
      className={cn(
        "border-t border-border bg-card/50 p-3 transition-colors",
        isDragOver && "bg-primary/5 border-primary/30"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Attached files preview - compact */}
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
                const isCSV = file.name.endsWith(".csv");
                return (
                  <Badge
                    key={file.id}
                    variant="secondary"
                    className={cn(
                      "gap-1.5 pr-1 max-w-[150px]",
                      isCSV && "border-green-500/30 bg-green-500/10"
                    )}
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

      {/* Minimal input area: [📎] [____________] [→] */}
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
          className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing || disabled || attachedFiles.length >= MAX_FILES}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* Text input */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={isProcessing || disabled}
          rows={1}
          className={cn(
            "flex-1 min-h-[40px] max-h-[120px] resize-none py-2.5",
            "bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
          )}
        />

        {/* Send button */}
        <Button
          size="icon"
          className="h-10 w-10 shrink-0"
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
      <p className="text-[10px] text-muted-foreground text-center mt-2">
        Enter para enviar • Shift+Enter para nova linha
      </p>
    </div>
  );
}
