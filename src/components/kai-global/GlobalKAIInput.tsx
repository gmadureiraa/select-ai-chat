import { useState, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, X, FileText, Image, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { KAIFileAttachment } from "@/types/kaiActions";

interface GlobalKAIInputProps {
  onSend: (message: string, files?: File[]) => Promise<void>;
  isProcessing: boolean;
  attachedFiles: KAIFileAttachment[];
  onAttachFiles: (files: File[]) => void;
  onRemoveFile: (fileId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function GlobalKAIInput({
  onSend,
  isProcessing,
  attachedFiles,
  onAttachFiles,
  onRemoveFile,
  placeholder = "Digite sua mensagem...",
  disabled = false,
}: GlobalKAIInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!message.trim() && attachedFiles.length === 0) return;
    if (isProcessing || disabled) return;

    const files = attachedFiles.map((f) => f.file);
    await onSend(message.trim(), files.length > 0 ? files : undefined);
    setMessage("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onAttachFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return Image;
    return FileText;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border-t border-border bg-card/50 p-3">
      {/* Attached files preview */}
      <AnimatePresence>
        {attachedFiles.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 overflow-hidden"
          >
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((file) => {
                const Icon = getFileIcon(file.type);
                return (
                  <motion.div
                    key={file.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-lg",
                      "bg-muted/50 border border-border",
                      "text-xs"
                    )}
                  >
                    {file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        className="h-6 w-6 rounded object-cover"
                      />
                    ) : (
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="max-w-[100px] truncate text-foreground">
                      {file.name}
                    </span>
                    <span className="text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      onClick={() => onRemoveFile(file.id)}
                      className="ml-1 p-0.5 rounded-full hover:bg-muted-foreground/20 transition-colors"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* File upload button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing || disabled}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* Text input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isProcessing || disabled}
            rows={1}
            className={cn(
              "min-h-[40px] max-h-[120px] resize-none py-2.5 pr-10",
              "bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
            )}
          />
        </div>

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

      {/* Hint */}
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        Enter para enviar • Shift+Enter para nova linha • Anexe CSVs para importar métricas
      </p>
    </div>
  );
}
