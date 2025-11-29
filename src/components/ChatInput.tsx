import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [input, setInput] = useState("");
  const [charCount, setCharCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled && trimmed.length <= maxChars) {
      onSend(trimmed);
      setInput("");
      setCharCount(0);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
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
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            disabled={disabled}
            className="min-h-[60px] max-h-[200px] resize-none"
            rows={1}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled || charCount > maxChars}
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
