import { Zap, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SimpleModeToggleProps {
  isSimpleMode: boolean;
  onToggle: () => void;
}

export function SimpleModeToggle({ isSimpleMode, onToggle }: SimpleModeToggleProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isSimpleMode ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs transition-all",
              isSimpleMode && "bg-primary text-primary-foreground"
            )}
            onClick={onToggle}
          >
            {isSimpleMode ? (
              <>
                <Zap className="h-4 w-4" />
                Modo Simples
              </>
            ) : (
              <>
                <Layers className="h-4 w-4" />
                Modo Avançado
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isSimpleMode 
            ? "Mostrando apenas Anexo → Resultado. Clique para modo avançado."
            : "Clique para simplificar a interface (oculta nós intermediários)"
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
