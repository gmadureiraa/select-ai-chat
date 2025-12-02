import { useState, useRef, useEffect } from "react";
import { 
  Plus, 
  StickyNote, 
  Link as LinkIcon, 
  Youtube, 
  FileText, 
  Image, 
  Mic,
  Sparkles,
  Send,
  X,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface QuickCaptureProps {
  onCapture: (type: string, content?: string) => void;
  isProcessing?: boolean;
}

const captureTypes = [
  { id: "note", icon: StickyNote, label: "Nota", color: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20" },
  { id: "link", icon: LinkIcon, label: "Link", color: "bg-green-500/10 text-green-600 hover:bg-green-500/20" },
  { id: "youtube", icon: Youtube, label: "YouTube", color: "bg-red-500/10 text-red-600 hover:bg-red-500/20" },
  { id: "text", icon: FileText, label: "Texto", color: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20" },
  { id: "ai_chat", icon: Sparkles, label: "AI Chat", color: "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20" },
];

export const QuickCapture = ({ onCapture, isProcessing }: QuickCaptureProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Detect URL type automatically
  const detectType = (text: string): string | null => {
    if (text.includes("youtube.com") || text.includes("youtu.be")) return "youtube";
    if (text.startsWith("http://") || text.startsWith("https://")) return "link";
    return null;
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    const detected = detectType(value);
    if (detected && !selectedType) {
      setSelectedType(detected);
    }
  };

  const handleSubmit = () => {
    if (!input.trim()) return;
    
    const type = selectedType || detectType(input) || "note";
    onCapture(type, input.trim());
    setInput("");
    setSelectedType(null);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      setInput("");
      setSelectedType(null);
    }
  };

  const handleTypeSelect = (type: string) => {
    if (type === "ai_chat") {
      onCapture("ai_chat");
      setIsOpen(false);
      return;
    }
    setSelectedType(type);
    inputRef.current?.focus();
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <motion.div
            key="button"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="h-12 px-6 gap-2 rounded-full shadow-lg bg-card hover:bg-accent border border-border text-foreground"
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium">Captura Rápida</span>
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="panel"
            initial={{ y: -10, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[500px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Type Pills */}
            <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30">
              {captureTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleTypeSelect(type.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                    selectedType === type.id
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                      : "",
                    type.color
                  )}
                >
                  <type.icon className="h-3.5 w-3.5" />
                  {type.label}
                </button>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-4">
              <Textarea
                ref={inputRef}
                placeholder="Cole um link, escreva uma ideia ou faça upload de mídia..."
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[80px] border-0 bg-transparent resize-none focus-visible:ring-0 text-base placeholder:text-muted-foreground/60"
                disabled={isProcessing}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => document.getElementById('quick-capture-file')?.click()}
                  disabled={isProcessing}
                >
                  <Image className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleTypeSelect("audio")}
                  disabled={isProcessing}
                >
                  <Mic className="h-4 w-4" />
                </Button>
                <input
                  type="file"
                  id="quick-capture-file"
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsOpen(false);
                    setInput("");
                    setSelectedType(null);
                  }}
                  disabled={isProcessing}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!input.trim() || isProcessing}
                  className="gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Capturar
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
