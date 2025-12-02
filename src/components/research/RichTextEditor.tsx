import { useState, useRef, useCallback } from "react";
import { Bold, Italic, List, ListOrdered, Heading2, Link, Code, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Digite aqui...",
  className,
  minRows = 5
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    
    // Reset cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
      textarea.setSelectionRange(
        selectedText ? newCursorPos : start + prefix.length,
        selectedText ? newCursorPos : start + prefix.length
      );
    }, 0);
  }, [value, onChange]);

  const toolbarButtons = [
    { icon: Bold, action: () => insertMarkdown("**", "**"), title: "Negrito" },
    { icon: Italic, action: () => insertMarkdown("*", "*"), title: "Itálico" },
    { icon: Heading2, action: () => insertMarkdown("## ", ""), title: "Título" },
    { icon: List, action: () => insertMarkdown("- ", ""), title: "Lista" },
    { icon: ListOrdered, action: () => insertMarkdown("1. ", ""), title: "Lista numerada" },
    { icon: Quote, action: () => insertMarkdown("> ", ""), title: "Citação" },
    { icon: Code, action: () => insertMarkdown("`", "`"), title: "Código" },
    { icon: Link, action: () => insertMarkdown("[", "](url)"), title: "Link" },
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent node deletion when typing
    if (e.key === "Delete" || e.key === "Backspace") {
      e.stopPropagation();
    }
    
    // Markdown shortcuts
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
      <div className="flex items-center gap-0.5 p-1 bg-muted/50 rounded-md border border-border">
        {toolbarButtons.map((btn, idx) => (
          <Button
            key={idx}
            variant="ghost"
            size="icon"
            className="h-6 w-6"
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
      </div>
      
      {/* Editor */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="resize-none font-mono text-sm no-pan no-wheel"
        rows={minRows}
        onKeyDown={handleKeyDown}
        onWheel={(e) => e.stopPropagation()}
      />
      
      {/* Help text */}
      <p className="text-[10px] text-muted-foreground">
        Suporta Markdown. Atalhos: Ctrl+B negrito, Ctrl+I itálico
      </p>
    </div>
  );
}
