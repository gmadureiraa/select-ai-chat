import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Image as ImageIcon,
  Sparkles,
  Search,
  LayoutGrid,
  MessageSquare,
  Workflow,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionMenuPopoverProps {
  onImageUpload: () => void;
  onGenerateImage?: () => void;
  onDeepResearch?: () => void;
  onSelectTemplate?: (type: string) => void;
  disabled?: boolean;
}

const actions = [
  {
    id: "image",
    icon: ImageIcon,
    label: "Adicionar imagem",
    description: "Upload de imagens para análise",
    color: "text-blue-500",
  },
  {
    id: "generate",
    icon: Sparkles,
    label: "Criar imagem IA",
    description: "Gerar imagem com inteligência artificial",
    color: "text-purple-500",
  },
  {
    id: "research",
    icon: Search,
    label: "Pesquisa profunda",
    description: "Análise aprofundada com múltiplas fontes",
    color: "text-amber-500",
  },
  {
    id: "carousel",
    icon: LayoutGrid,
    label: "Carrossel",
    description: "Criar conteúdo de carrossel",
    color: "text-green-500",
  },
  {
    id: "stories",
    icon: MessageSquare,
    label: "Stories",
    description: "Criar sequência de stories",
    color: "text-pink-500",
  },
  {
    id: "agent",
    icon: Workflow,
    label: "Modo Agente",
    description: "Execução autônoma de tarefas complexas",
    color: "text-cyan-500",
  },
];

export const ActionMenuPopover = ({
  onImageUpload,
  onGenerateImage,
  onDeepResearch,
  onSelectTemplate,
  disabled,
}: ActionMenuPopoverProps) => {
  const [open, setOpen] = useState(false);

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case "image":
        onImageUpload();
        break;
      case "generate":
        onGenerateImage?.();
        break;
      case "research":
        onDeepResearch?.();
        break;
      case "carousel":
      case "stories":
        onSelectTemplate?.(actionId);
        break;
      case "agent":
        // TODO: Implement agent mode
        break;
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            "h-9 w-9 rounded-xl transition-all",
            open
              ? "bg-primary/10 text-primary"
              : "hover:bg-muted/60 text-muted-foreground"
          )}
        >
          <Plus className={cn("h-5 w-5 transition-transform", open && "rotate-45")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-64 p-2 border-border/50 bg-popover/95 backdrop-blur-xl"
        sideOffset={8}
      >
        <div className="grid gap-1">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="flex items-center gap-3 w-full p-2.5 rounded-lg text-left hover:bg-muted/50 transition-colors group"
            >
              <div className={cn("p-1.5 rounded-lg bg-muted/50 group-hover:bg-muted", action.color)}>
                <action.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{action.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
