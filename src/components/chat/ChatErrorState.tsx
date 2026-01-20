import { AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface ChatErrorStateProps {
  error: {
    type: "network" | "api" | "rate_limit" | "upgrade_required" | "unknown";
    message: string;
  };
  onRetry?: () => void;
  onClear?: () => void;
  onUpgrade?: () => void;
}

export function ChatErrorState({ error, onRetry, onClear, onUpgrade }: ChatErrorStateProps) {
  const getErrorConfig = () => {
    switch (error.type) {
      case "rate_limit":
        return {
          title: "Limite de requisições",
          description: "Você atingiu o limite. Aguarde alguns segundos e tente novamente.",
          showRetry: true,
          showClear: false,
          showUpgrade: false,
        };
      case "upgrade_required":
        return {
          title: "Upgrade necessário",
          description: "Seus créditos acabaram ou você precisa de um plano superior.",
          showRetry: false,
          showClear: false,
          showUpgrade: true,
        };
      case "network":
        return {
          title: "Erro de conexão",
          description: "Não foi possível conectar ao servidor. Verifique sua internet.",
          showRetry: true,
          showClear: false,
          showUpgrade: false,
        };
      case "api":
        return {
          title: "Erro no servidor",
          description: error.message || "Ocorreu um erro ao processar sua mensagem.",
          showRetry: true,
          showClear: true,
          showUpgrade: false,
        };
      default:
        return {
          title: "Algo deu errado",
          description: error.message || "Tente novamente em alguns segundos.",
          showRetry: true,
          showClear: true,
          showUpgrade: false,
        };
    }
  };

  const config = getErrorConfig();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-4 w-4 text-destructive" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground mb-1">
          {config.title}
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          {config.description}
        </p>
        
        <div className="flex items-center gap-2">
          {config.showRetry && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="gap-1.5 text-xs h-7"
            >
              <RefreshCw className="h-3 w-3" />
              Tentar novamente
            </Button>
          )}
          
          {config.showClear && onClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="gap-1.5 text-xs h-7 text-muted-foreground"
            >
              <Trash2 className="h-3 w-3" />
              Limpar
            </Button>
          )}
          
          {config.showUpgrade && onUpgrade && (
            <Button
              variant="default"
              size="sm"
              onClick={onUpgrade}
              className="gap-1.5 text-xs h-7"
            >
              Ver planos
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
