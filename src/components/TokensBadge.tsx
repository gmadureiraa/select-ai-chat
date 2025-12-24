import { Coins, Infinity } from "lucide-react";
import { useTokens } from "@/hooks/useTokens";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";

interface TokensBadgeProps {
  className?: string;
  showLabel?: boolean;
  variant?: "default" | "compact" | "header";
}

export const TokensBadge = ({ className, showLabel = true, variant = "default" }: TokensBadgeProps) => {
  const { balance, formattedBalance, isUnlimited, plan, isLoading } = useTokens();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();

  const handleClick = () => {
    if (workspace?.slug) {
      navigate(`/${workspace.slug}?tab=settings`);
    }
  };

  if (isLoading) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-full bg-muted animate-pulse",
        variant === "compact" ? "px-2 py-1" : "px-3 py-1.5",
        className
      )}>
        <div className="h-4 w-4 rounded-full bg-muted-foreground/20" />
        {showLabel && <div className="h-3 w-12 rounded bg-muted-foreground/20" />}
      </div>
    );
  }

  const tokensMonthly = plan?.tokens_monthly || 1000;
  const isLow = !isUnlimited && balance < (tokensMonthly * 0.1);
  const isCritical = !isUnlimited && balance < (tokensMonthly * 0.02);

  const sizeClasses = {
    default: "px-3 py-1.5",
    compact: "px-2 py-1",
    header: "px-3 py-1.5",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleClick}
          className={cn(
            "flex items-center gap-2 rounded-full border transition-all hover:opacity-80 cursor-pointer",
            sizeClasses[variant],
            isUnlimited && "bg-primary/10 border-primary/30 text-primary",
            !isUnlimited && !isLow && "bg-muted/80 border-border hover:bg-muted",
            isLow && !isCritical && "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400 animate-pulse",
            isCritical && "bg-destructive/10 border-destructive/30 text-destructive animate-pulse",
            className
          )}
        >
          {isUnlimited ? (
            <Infinity className={cn("h-4 w-4", variant === "compact" && "h-3.5 w-3.5")} />
          ) : (
            <Coins className={cn("h-4 w-4", variant === "compact" && "h-3.5 w-3.5")} />
          )}
          {showLabel && (
            <span className={cn(
              "font-medium",
              variant === "compact" ? "text-xs" : "text-sm"
            )}>
              {isUnlimited ? "∞" : formattedBalance}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="text-sm space-y-1">
          <p className="font-medium">
            {isUnlimited ? "Créditos Ilimitados" : `${formattedBalance} créditos disponíveis`}
          </p>
          <p className="text-muted-foreground">
            Plano: {plan?.name ?? "Carregando..."}
          </p>
          {!isUnlimited && isLow && (
            <p className="text-yellow-600 dark:text-yellow-400">
              ⚠️ Saldo baixo - clique para ver opções de upgrade
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Clique para gerenciar seu plano
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
