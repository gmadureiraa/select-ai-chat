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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionMenuPopoverProps {
  onImageUpload: () => void;
  onGenerateImage?: () => void;
  onDeepResearch?: () => void;
  disabled?: boolean;
}

const actions = [
  {
    id: "image",
    icon: ImageIcon,
    label: "Anexar imagem",
    shortcut: "⌘I",
  },
  {
    id: "generate",
    icon: Sparkles,
    label: "Gerar imagem",
    shortcut: "⌘G",
  },
  {
    id: "research",
    icon: Search,
    label: "Pesquisa profunda",
    shortcut: "⌘R",
  },
];

export const ActionMenuPopover = ({
  onImageUpload,
  onGenerateImage,
  onDeepResearch,
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
            "h-8 w-8 rounded-lg transition-all",
            open
              ? "bg-primary/10 text-primary"
              : "hover:bg-muted/60 text-muted-foreground"
          )}
        >
          <Plus className={cn("h-4 w-4 transition-transform", open && "rotate-45")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-48 p-1.5 border-border/50 bg-popover/95 backdrop-blur-xl"
        sideOffset={8}
      >
        <div className="space-y-0.5">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="flex items-center justify-between w-full px-2.5 py-2 rounded-md text-left hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <action.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-sm text-foreground">{action.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/60 font-mono">{action.shortcut}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
