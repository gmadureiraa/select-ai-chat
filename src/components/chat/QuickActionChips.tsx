import { Newspaper, FileText, Video, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickActionChipsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

const chips = [
  { icon: Newspaper, label: "Newsletter", prompt: "Crie uma newsletter semanal" },
  { icon: FileText, label: "Carrossel", prompt: "Crie um carrossel de Instagram" },
  { icon: Video, label: "Stories", prompt: "Crie uma sequência de stories" },
  { icon: Mail, label: "Thread", prompt: "Escreva uma thread para X" },
  { icon: Sparkles, label: "Post LinkedIn", prompt: "Crie um post para LinkedIn" },
];

export const QuickActionChips = ({ onSelect, disabled }: QuickActionChipsProps) => {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {chips.map((chip) => (
        <Button
          key={chip.label}
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onSelect(chip.prompt)}
          className="h-7 px-2 text-xs gap-1 bg-muted/30 border-border/50 hover:bg-muted hover:border-border"
        >
          <chip.icon className="h-3 w-3" />
          {chip.label}
        </Button>
      ))}
    </div>
  );
};
