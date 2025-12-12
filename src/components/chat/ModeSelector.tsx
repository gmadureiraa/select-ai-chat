import { Lightbulb, FileText, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ChatMode = "content" | "ideas" | "free_chat";

interface ModeSelectorProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

// Modos disponíveis para templates de conteúdo (sem free_chat)
const contentModes = [
  {
    id: "content" as const,
    icon: FileText,
    label: "Conteúdo",
    description: "Gera conteúdo completo com 4 agentes especializados (alta qualidade).",
    activeClass: "bg-primary/10 text-primary border border-primary/20",
  },
  {
    id: "ideas" as const,
    icon: Lightbulb,
    label: "Ideias",
    description: "Gera ideias criativas baseadas na biblioteca do cliente (rápido).",
    activeClass: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  },
  {
    id: "free_chat" as const,
    icon: MessageCircle,
    label: "Chat",
    description: "Conversa livre com dados reais do cliente (rápido).",
    activeClass: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  },
];

export const ModeSelector = ({ mode, onChange, disabled }: ModeSelectorProps) => {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
        {contentModes.map((m) => (
          <Tooltip key={m.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onChange(m.id)}
                disabled={disabled}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  mode === m.id
                    ? m.activeClass
                    : "text-muted-foreground hover:text-foreground",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <m.icon className="h-3 w-3" />
                {m.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px]">
              <p className="text-xs">{m.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};
