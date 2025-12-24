import { Coins, Infinity } from "lucide-react";
import { useTokens } from "@/hooks/useTokens";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TokensBadgeProps {
  className?: string;
  showLabel?: boolean;
}

export const TokensBadge = ({ className, showLabel = true }: TokensBadgeProps) => {
  const { balance, formattedBalance, isUnlimited, plan, isLoading } = useTokens();

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted animate-pulse", className)}>
        <div className="h-4 w-4 rounded-full bg-muted-foreground/20" />
        <div className="h-3 w-16 rounded bg-muted-foreground/20" />
      </div>
    );
  }

  const isLow = !isUnlimited && balance < 100;
  const isCritical = !isUnlimited && balance < 20;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors",
            isUnlimited && "bg-primary/10 border-primary/30 text-primary",
            !isUnlimited && !isLow && "bg-muted border-border",
            isLow && !isCritical && "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400",
            isCritical && "bg-destructive/10 border-destructive/30 text-destructive",
            className
          )}
        >
          {isUnlimited ? (
            <Infinity className="h-4 w-4" />
          ) : (
            <Coins className="h-4 w-4" />
          )}
          {showLabel && (
            <span className="text-sm font-medium">
              {isUnlimited ? "Ilimitado" : formattedBalance}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="text-sm">
          <p className="font-medium">
            {isUnlimited ? "Tokens Ilimitados" : `${formattedBalance} tokens`}
          </p>
          <p className="text-muted-foreground">
            Plano: {plan?.name ?? "Carregando..."}
          </p>
          {!isUnlimited && isLow && (
            <p className="text-yellow-600 dark:text-yellow-400 mt-1">
              ⚠️ Saldo baixo - considere fazer upgrade
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
