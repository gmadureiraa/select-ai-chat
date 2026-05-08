/**
 * TokensRemainingBadge — badge compacto mostrando uso mensal de tokens.
 *
 * Comportamento:
 *   - tokens_remaining / monthly_quota
 *   - Variant muda conforme % restante: secondary (>20%), outline (<20%), destructive (=0)
 *   - Esconde durante loading inicial pra não piscar
 *
 * Uso típico: header do KAI (ao lado do client selector) ou no canto superior
 * direito dos viral tabs.
 */
import { useViralAccess } from "@/hooks/useViralAccess";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface TokensRemainingBadgeProps {
  className?: string;
  /** Mostra label completo ("X créditos restantes") em vez de "X/Y". */
  verbose?: boolean;
}

export function TokensRemainingBadge({ className, verbose = false }: TokensRemainingBadgeProps) {
  const { tokensRemaining, monthlyTokens, tokensExhausted, isLoading } = useViralAccess();

  if (isLoading) return null;

  const pct = monthlyTokens > 0 ? (tokensRemaining / monthlyTokens) * 100 : 0;
  const variant: "destructive" | "outline" | "secondary" = tokensExhausted
    ? "destructive"
    : pct < 20
    ? "outline"
    : "secondary";

  const label = verbose
    ? tokensExhausted
      ? "Créditos esgotados"
      : `${tokensRemaining} créditos restantes`
    : `${tokensRemaining}/${monthlyTokens}`;

  return (
    <Badge variant={variant} className={cn("gap-1 font-mono", className)} title={`${tokensRemaining} de ${monthlyTokens} créditos restantes este mês`}>
      <Coins className="h-3 w-3" />
      {label}
    </Badge>
  );
}
