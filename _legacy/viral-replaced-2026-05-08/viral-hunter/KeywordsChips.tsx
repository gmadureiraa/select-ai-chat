/**
 * Chips editáveis de keywords — input + chips removíveis.
 * Usado como configurador compartilhado de "termos do nicho" em várias tabs.
 */

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface KeywordsChipsProps {
  keywords: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function KeywordsChips({
  keywords,
  onChange,
  placeholder = "Adicionar palavra-chave...",
  disabled,
  className,
}: KeywordsChipsProps) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (keywords.includes(v.toLowerCase())) {
      setInput("");
      return;
    }
    onChange([...keywords, v.toLowerCase()]);
    setInput("");
  };

  const remove = (k: string) => onChange(keywords.filter((x) => x !== k));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20"
          >
            {k}
            <button
              type="button"
              onClick={() => remove(k)}
              disabled={disabled}
              className="hover:text-destructive"
              aria-label={`Remover ${k}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {keywords.length === 0 && (
          <span className="text-xs text-muted-foreground italic">Nenhuma keyword ainda</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="h-8 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={add}
          disabled={disabled || !input.trim()}
          className="h-8"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
