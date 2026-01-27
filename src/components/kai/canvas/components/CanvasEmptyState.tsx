import { motion } from "framer-motion";
import { Sparkles, FileInput, Zap, Lightbulb, BookOpen, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

interface CanvasEmptyStateProps {
  clientName?: string;
  onAddAttachment: () => void;
  onAddGenerator: () => void;
  onOpenLibrary: () => void;
  onLoadTemplate?: (templateId: string) => void;
  className?: string;
}

export function CanvasEmptyState({
  clientName,
  onAddAttachment,
  onAddGenerator,
  onOpenLibrary,
  className,
}: CanvasEmptyStateProps) {
  const quickActions: QuickAction[] = [
    {
      icon: <FileInput className="h-5 w-5" />,
      label: "Adicionar Anexo",
      description: "Importe YouTube, PDF, áudio ou texto",
      onClick: onAddAttachment,
      variant: "primary",
    },
    {
      icon: <Zap className="h-5 w-5" />,
      label: "Criar Gerador",
      description: "Configure e gere conteúdo com IA",
      onClick: onAddGenerator,
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      label: "Usar da Biblioteca",
      description: "Aproveite conteúdos e referências",
      onClick: onOpenLibrary,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "absolute inset-0 flex items-center justify-center pointer-events-none z-10",
        className
      )}
    >
      <div className="pointer-events-auto bg-background/80 backdrop-blur-sm border border-border rounded-2xl shadow-xl p-8 max-w-lg text-center">
        {/* Header */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Canvas de Criação
        </h2>
        
        <p className="text-sm text-muted-foreground mb-2">
          {clientName ? (
            <>Crie conteúdo para <span className="font-medium text-foreground">{clientName}</span></>
          ) : (
            "Seu espaço visual para criação de conteúdo com IA"
          )}
        </p>
        
        <p className="text-xs text-muted-foreground/70 mb-6">
          Conecte anexos → geradores para transformar ideias em conteúdo
        </p>

        {/* Quick Actions */}
        <div className="space-y-2 mb-6">
          {quickActions.map((action, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.1 }}
              onClick={action.onClick}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                "border hover:shadow-md",
                action.variant === "primary"
                  ? "bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/30"
                  : "bg-muted/50 border-border hover:bg-muted hover:border-border"
              )}
            >
              <div className={cn(
                "flex items-center justify-center h-10 w-10 rounded-lg",
                action.variant === "primary" 
                  ? "bg-primary/10 text-primary" 
                  : "bg-background text-muted-foreground"
              )}>
                {action.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {action.label}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {action.description}
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Tips */}
        <div className="flex items-start gap-2 text-left p-3 rounded-lg bg-muted/30">
          <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <strong className="font-medium text-foreground">Dica:</strong>{" "}
            Conecte um <span className="text-primary">Anexo</span> a um{" "}
            <span className="text-primary">Gerador</span> arrastando do ponto de saída 
            para o ponto de entrada.
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">A</kbd>
            <span>Anexo</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">G</kbd>
            <span>Gerador</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">L</kbd>
            <span>Biblioteca</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
