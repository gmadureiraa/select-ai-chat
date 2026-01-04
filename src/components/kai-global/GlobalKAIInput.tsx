import { useState, useRef, KeyboardEvent, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, X, FileText, Image, Loader2, Link as LinkIcon, File, Music, Video, FileSpreadsheet, FileCode, AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { KAIFileAttachment } from "@/types/kaiActions";
import { toast } from "sonner";
import { CitationPopover } from "@/components/chat/CitationPopover";
import { CitationChip, Citation } from "@/components/chat/CitationChip";

interface ContentLibraryItem {
  id: string;
  title: string;
  content_type: string;
  content: string;
}

interface ReferenceLibraryItem {
  id: string;
  title: string;
  reference_type: string;
  content: string;
}

interface AssigneeItem {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
}

interface ClientItem {
  id: string;
  name: string;
  avatar_url?: string;
}

interface GlobalKAIInputProps {
  onSend: (message: string, files?: File[], citations?: Citation[]) => Promise<void>;
  isProcessing: boolean;
  attachedFiles: KAIFileAttachment[];
  onAttachFiles: (files: File[]) => void;
  onRemoveFile: (fileId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  contentLibrary?: ContentLibraryItem[];
  referenceLibrary?: ReferenceLibraryItem[];
  assignees?: AssigneeItem[];
  clients?: ClientItem[];
}

// URL detection regex
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;
const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function GlobalKAIInput({
  onSend,
  isProcessing,
  attachedFiles,
  onAttachFiles,
  onRemoveFile,
  placeholder = "Digite sua mensagem...",
  disabled = false,
  contentLibrary = [],
  referenceLibrary = [],
  assignees = [],
  clients = [],
}: GlobalKAIInputProps) {
  const [message, setMessage] = useState("");
  const [detectedUrls, setDetectedUrls] = useState<string[]>([]);
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionAnchorRef = useRef<HTMLSpanElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Detect URLs in message
  useEffect(() => {
    const urls = message.match(URL_REGEX) || [];
    setDetectedUrls([...new Set(urls)]);
  }, [message]);

  // Transform libraries to CitationPopover format
  const formattedContentLibrary = contentLibrary.map(item => ({
    id: item.id,
    title: item.title,
    content_type: item.content_type,
    content: item.content,
  }));

  const formattedReferenceLibrary = referenceLibrary.map(item => ({
    id: item.id,
    title: item.title,
    reference_type: item.reference_type,
    content: item.content,
  }));

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Detect @ for mention popover
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's no space or newline after @ (user is still typing the mention)
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setShowMentionPopover(true);
        setMentionSearchQuery(textAfterAt);
        return;
      }
    }

    setShowMentionPopover(false);
    setMentionSearchQuery("");
  };

  const handleCitationSelect = (item: { id: string; title: string; type: "content_library" | "reference_library" | "format" | "assignee" | "client"; category: string }) => {
    // Add citation
    const newCitation: Citation = {
      id: item.id,
      title: item.title,
      type: item.type,
      category: item.category,
    };

    // Avoid duplicates
    if (!citations.find(c => c.id === item.id)) {
      setCitations(prev => [...prev, newCitation]);
    }

    // Replace @query with @[title]
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart || 0;
      const textBeforeCursor = message.substring(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1) {
        const beforeAt = message.substring(0, lastAtIndex);
        const afterCursor = message.substring(cursorPos);
        const newMessage = `${beforeAt}@[${item.title}] ${afterCursor}`;
        setMessage(newMessage);
      }
    }

    setShowMentionPopover(false);
    setMentionSearchQuery("");
    textareaRef.current?.focus();
  };

  const handleRemoveCitation = (citationId: string) => {
    setCitations(prev => prev.filter(c => c.id !== citationId));
  };

  const handleSend = async () => {
    if (!message.trim() && attachedFiles.length === 0) return;
    if (isProcessing || disabled) return;

    const files = attachedFiles.map((f) => f.file);
    await onSend(message.trim(), files.length > 0 ? files : undefined, citations.length > 0 ? citations : undefined);
    setMessage("");
    setDetectedUrls([]);
    setCitations([]);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && showMentionPopover) {
      e.preventDefault();
      setShowMentionPopover(false);
      return;
    }
    
    if (e.key === "Enter" && !e.shiftKey && !showMentionPopover) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;
    
    // Check total file limit
    const remainingSlots = MAX_FILES - attachedFiles.length;
    if (remainingSlots <= 0) {
      toast.error(`Limite de ${MAX_FILES} arquivos atingido`);
      return;
    }
    
    // Filter valid files
    const validFiles: File[] = [];
    const errors: string[] = [];
    
    files.slice(0, remainingSlots).forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: arquivo muito grande (máx 20MB)`);
      } else {
        validFiles.push(file);
      }
    });
    
    if (files.length > remainingSlots) {
      toast.warning(`Apenas ${remainingSlots} arquivo(s) adicionado(s). Limite: ${MAX_FILES}`);
    }
    
    errors.forEach(error => toast.error(error));
    
    if (validFiles.length > 0) {
      onAttachFiles(validFiles);
    }
    
    // Reset input
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
        if (file) {
          pastedFiles.push(file);
        }
      }
    }

    if (pastedFiles.length > 0) {
      const remainingSlots = MAX_FILES - attachedFiles.length;
      if (remainingSlots <= 0) {
        toast.error(`Limite de ${MAX_FILES} arquivos atingido`);
        return;
      }
      
      e.preventDefault();
      const filesToAdd = pastedFiles.slice(0, remainingSlots);
      onAttachFiles(filesToAdd);
      
      if (pastedFiles.length > remainingSlots) {
        toast.warning(`Apenas ${remainingSlots} arquivo(s) colado(s). Limite: ${MAX_FILES}`);
      }
    }
  }, [onAttachFiles, attachedFiles.length]);

  const getFileIcon = (type: string, name: string) => {
    if (type.startsWith("image/")) return Image;
    if (type.startsWith("video/")) return Video;
    if (type.startsWith("audio/")) return Music;
    if (type.includes("spreadsheet") || name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls")) return FileSpreadsheet;
    if (type.includes("javascript") || type.includes("typescript") || name.endsWith(".json") || name.endsWith(".html") || name.endsWith(".css")) return FileCode;
    if (type.includes("pdf") || type.includes("document") || type.includes("text")) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getUrlDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  };

  const getFileColor = (type: string, name: string) => {
    if (type.startsWith("image/")) return "text-blue-500";
    if (type.startsWith("video/")) return "text-purple-500";
    if (type.startsWith("audio/")) return "text-pink-500";
    if (type.includes("spreadsheet") || name.endsWith(".csv") || name.endsWith(".xlsx")) return "text-green-600";
    if (type.includes("pdf")) return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <div className="border-t border-border bg-card/50 p-3">
      {/* Citations display */}
      <AnimatePresence>
        {citations.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5">
              {citations.map((citation) => (
                <CitationChip
                  key={citation.id}
                  citation={citation}
                  onRemove={handleRemoveCitation}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detected URLs preview */}
      <AnimatePresence>
        {detectedUrls.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5">
              {detectedUrls.slice(0, 3).map((url, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20"
                >
                  <LinkIcon className="h-2.5 w-2.5" />
                  {getUrlDomain(url)}
                </Badge>
              ))}
              {detectedUrls.length > 3 && (
                <Badge variant="secondary" className="text-[10px]">
                  +{detectedUrls.length - 3} URLs
                </Badge>
              )}
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
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((file) => {
                const Icon = getFileIcon(file.type, file.name);
                const colorClass = getFileColor(file.type, file.name);
                const isCSV = file.name.endsWith(".csv");
                return (
                  <motion.div
                    key={file.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-lg",
                      "bg-muted/50 border border-border",
                      "text-xs",
                      isCSV && "border-green-500/30 bg-green-500/10"
                    )}
                  >
                    {file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        className="h-6 w-6 rounded object-cover"
                      />
                    ) : (
                      <Icon className={cn("h-4 w-4", colorClass)} />
                    )}
                    <span className="max-w-[100px] truncate text-foreground">
                      {file.name}
                    </span>
                    <span className="text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                    {isCSV && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-green-500/20 text-green-700">
                        CSV
                      </Badge>
                    )}
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
            {/* File count indicator */}
            <div className="mt-1 text-[10px] text-muted-foreground">
              {attachedFiles.length}/{MAX_FILES} arquivos
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
          accept="*/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing || disabled || attachedFiles.length >= MAX_FILES}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* Mention button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setMessage(prev => prev + "@");
            setShowMentionPopover(true);
            setMentionSearchQuery("");
            textareaRef.current?.focus();
          }}
          disabled={isProcessing || disabled}
        >
          <AtSign className="h-4 w-4" />
        </Button>

        {/* Text input */}
        <div className="flex-1 relative">
          <span ref={mentionAnchorRef} className="absolute top-0 left-0 pointer-events-none" />
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
              "min-h-[40px] max-h-[120px] resize-none py-2.5 pr-10",
              "bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
            )}
          />

          {/* Citation Popover */}
          <CitationPopover
            open={showMentionPopover}
            onOpenChange={setShowMentionPopover}
            onSelect={handleCitationSelect}
            contentLibrary={formattedContentLibrary}
            referenceLibrary={formattedReferenceLibrary}
            assignees={assignees}
            clients={clients}
            anchorRef={mentionAnchorRef}
            searchQuery={mentionSearchQuery}
            showFormats={true}
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

      {/* Hints */}
      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] text-muted-foreground">
          Enter para enviar • @ para mencionar • Shift+Enter para nova linha
        </p>
        <p className="text-[10px] text-muted-foreground">
          Até {MAX_FILES} arquivos
        </p>
      </div>
    </div>
  );
}
