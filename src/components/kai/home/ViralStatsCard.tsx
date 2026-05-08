// ViralStatsCard — sumário de uso das ferramentas virais (Carrossel, Reels,
// Radar Briefs) + saldo de tokens, scoped ao workspace ou ao cliente.
// Plugado no HomeDashboard logo após WorkspaceStatsCards.
// Cada célula é clicável e navega pra tab correspondente via onNavigate.

import { motion } from "framer-motion";
import {
  TrendingUp,
  FileText,
  Video,
  Radar as RadarIcon,
  Coins,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useViralStats, type ViralStatsRange } from "@/hooks/useViralStats";

interface ViralStatsCardProps {
  clientId?: string | null;
  range?: ViralStatsRange;
  onNavigate: (tab: string) => void;
}

interface CellProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "primary" | "success" | "warning" | "destructive";
  onClick?: () => void;
}

function StatCell({ icon: Icon, label, value, sub, accent, onClick }: CellProps) {
  const accentClass =
    accent === "success"
      ? "text-emerald-500"
      : accent === "warning"
        ? "text-orange-500"
        : accent === "destructive"
          ? "text-destructive"
          : "text-primary";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left p-3 rounded-lg border border-transparent transition-all",
        onClick
          ? "hover:bg-muted/30 hover:border-border/60 cursor-pointer"
          : "cursor-default",
      )}
    >
      <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        <Icon className={cn("h-3.5 w-3.5", accentClass)} />
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {sub && (
        <div className="text-[10.5px] text-muted-foreground/70 mt-1 line-clamp-1">
          {sub}
        </div>
      )}
    </button>
  );
}

export function ViralStatsCard({
  clientId,
  range = "30d",
  onNavigate,
}: ViralStatsCardProps) {
  const { data, isLoading } = useViralStats({ clientId, range });

  const rangeLabel =
    range === "7d" ? "últimos 7 dias" : range === "90d" ? "últimos 90 dias" : "últimos 30 dias";

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Viral — {rangeLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 rounded-lg space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const tokensQuota = data.tokens.quota || 0;
  const tokensRemaining = data.tokens.remaining ?? 0;
  const tokensUsedPct =
    tokensQuota > 0
      ? Math.min(100, Math.round((data.tokens.used / tokensQuota) * 100))
      : 0;
  const tokenAccent: CellProps["accent"] =
    tokensUsedPct >= 80 ? "destructive" : tokensUsedPct >= 50 ? "warning" : "primary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Viral — {rangeLabel}
            {clientId && (
              <span className="text-[11px] font-normal text-muted-foreground ml-1">
                (cliente)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCell
            icon={FileText}
            label="Carrosséis"
            value={data.carousels.this_period ?? 0}
            sub={
              data.carousels.published > 0
                ? `${data.carousels.published} publicados no total`
                : `${data.carousels.total ?? 0} no total`
            }
            accent="primary"
            onClick={() => onNavigate("viral-carrossel")}
          />
          <StatCell
            icon={Video}
            label="Reels analisados"
            value={data.reels.this_period ?? 0}
            sub={
              data.reels.total > 0 ? `${data.reels.total} no total` : "Sem histórico"
            }
            accent="primary"
            onClick={() => onNavigate("viral-reels-page")}
          />
          <StatCell
            icon={RadarIcon}
            label="Briefs Radar"
            value={data.briefs.this_period ?? 0}
            sub={
              data.briefs.total > 0
                ? `${data.briefs.total} no total`
                : "Nenhum brief gerado"
            }
            accent="primary"
            onClick={() => onNavigate("viral-radar-page")}
          />
          <StatCell
            icon={Coins}
            label="Tokens"
            value={
              tokensQuota > 0
                ? `${tokensRemaining.toLocaleString("pt-BR")}/${tokensQuota.toLocaleString("pt-BR")}`
                : tokensRemaining.toLocaleString("pt-BR")
            }
            sub={
              tokensQuota > 0
                ? `${tokensUsedPct}% do plano usado`
                : "Sem plano configurado"
            }
            accent={tokenAccent}
            onClick={() => onNavigate("billing")}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}
