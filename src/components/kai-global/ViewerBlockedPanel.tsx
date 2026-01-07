import { Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ViewerBlockedPanelProps {
  onClose: () => void;
}

export function ViewerBlockedPanel({ onClose }: ViewerBlockedPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-foreground">Assistente kAI</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2 text-foreground">Acesso Restrito</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-[280px]">
          O assistente kAI não está disponível para usuários com permissão de visualizador.
        </p>
        <p className="text-xs text-muted-foreground max-w-[280px]">
          Entre em contato com o administrador do workspace para solicitar acesso.
        </p>
      </div>
    </div>
  );
}
