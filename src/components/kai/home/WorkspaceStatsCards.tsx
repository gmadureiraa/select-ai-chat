import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users,
  Send,
  CalendarClock,
  Coins,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { addDays, startOfMonth, endOfMonth, subMonths, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useClients } from "@/hooks/useClients";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface WorkspaceStatsCardsProps {
  onNavigate: (tab: string) => void;
}

type Trend = "up" | "down" | "flat";

interface StatCardData {
  key: string;
  label: string;
  value: string | number;
  hint?: string;
  trend?: { value: number; direction: Trend; suffix?: string };
  icon: React.ElementType;
  accent?: "primary" | "success" | "warning" | "destructive";
  onClick?: () => void;
  progress?: number;
  loading?: boolean;
}

function trendIcon(direction: Trend) {
  if (direction === "up") return TrendingUp;
  if (direction === "down") return TrendingDown;
  return Minus;
}

function trendClass(direction: Trend, invertColors = false) {
  if (direction === "flat") return "text-muted-foreground";
  // up = good (green), down = bad (red) — unless invertColors
  const goodUp = !invertColors;
  if (direction === "up") return goodUp ? "text-emerald-500" : "text-destructive";
  return goodUp ? "text-destructive" : "text-emerald-500";
}

export function WorkspaceStatsCards({ onNavigate }: WorkspaceStatsCardsProps) {
  const { workspace, tokens, subscription } = useWorkspaceContext();
  const { clients } = useClients();
  const workspaceId = workspace?.id;

  const now = new Date();
  const next7 = addDays(now, 7);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  // Posts agendados nos próximos 7 dias
  const { data: scheduledNext7, isLoading: loadingScheduled } = useQuery({
    queryKey: ["home-scheduled-next7", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return 0;
      const { count } = await supabase
        .from("planning_items")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", next7.toISOString())
        .in("status", ["scheduled", "approved", "review", "draft"]);
      return count ?? 0;
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  // Publicados este mês + mês passado
  const { data: publishedStats, isLoading: loadingPublished } = useQuery({
    queryKey: ["home-published-month", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { thisMonth: 0, lastMonth: 0 };
      const [{ count: thisMonth }, { count: lastMonth }] = await Promise.all([
        supabase
          .from("planning_items")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("status", "published")
          .gte("updated_at", monthStart.toISOString())
          .lte("updated_at", monthEnd.toISOString()),
        supabase
          .from("planning_items")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("status", "published")
          .gte("updated_at", lastMonthStart.toISOString())
          .lte("updated_at", lastMonthEnd.toISOString()),
      ]);
      return { thisMonth: thisMonth ?? 0, lastMonth: lastMonth ?? 0 };
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  // Clientes ativos = clientes com algum item nos últimos 30 dias
  const { data: activeClientCount, isLoading: loadingActive } = useQuery({
    queryKey: ["home-active-clients", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return 0;
      const since = addDays(now, -30).toISOString();
      const { data } = await supabase
        .from("planning_items")
        .select("client_id")
        .eq("workspace_id", workspaceId)
        .gte("updated_at", since)
        .not("client_id", "is", null);
      const ids = new Set((data || []).map((r) => r.client_id));
      return ids.size;
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const totalClients = clients?.length ?? 0;
  const active = activeClientCount ?? 0;
  const inactive = Math.max(0, totalClients - active);

  // Trend publicados
  const thisMonthPub = publishedStats?.thisMonth ?? 0;
  const lastMonthPub = publishedStats?.lastMonth ?? 0;
  const pubDelta = thisMonthPub - lastMonthPub;
  const pubPct =
    lastMonthPub > 0
      ? Math.round((pubDelta / lastMonthPub) * 100)
      : thisMonthPub > 0
      ? 100
      : 0;
  const pubDirection: Trend = pubDelta > 0 ? "up" : pubDelta < 0 ? "down" : "flat";

  // Tokens
  const balance = tokens?.balance ?? 0;
  const used = tokens?.tokens_used_this_period ?? 0;
  const monthlyAllowance = subscription?.plan?.tokens_monthly ?? balance + used;
  const usedPct =
    monthlyAllowance > 0 ? Math.min(100, Math.round((used / monthlyAllowance) * 100)) : 0;
  const periodEnd = tokens?.period_end ? new Date(tokens.period_end) : null;
  const periodHint = periodEnd
    ? `Renova ${formatDistanceToNow(periodEnd, { addSuffix: true, locale: ptBR })}`
    : undefined;

  const cards: StatCardData[] = [
    {
      key: "clients",
      label: "Clientes ativos",
      value: active,
      hint:
        totalClients > 0
          ? `${active}/${totalClients} clientes com atividade nos últimos 30d`
          : "Nenhum cliente ainda",
      icon: Users,
      accent: "primary",
      onClick: () => onNavigate("clients"),
      loading: loadingActive,
    },
    {
      key: "scheduled",
      label: "Agendados (7d)",
      value: scheduledNext7 ?? 0,
      hint: "Posts nos próximos 7 dias",
      icon: CalendarClock,
      accent: "warning",
      onClick: () => onNavigate("planning"),
      loading: loadingScheduled,
    },
    {
      key: "published",
      label: "Publicados este mês",
      value: thisMonthPub,
      hint: lastMonthPub > 0 ? `${lastMonthPub} no mês passado` : "Sem dados de comparação",
      trend:
        lastMonthPub > 0 || thisMonthPub > 0
          ? { value: Math.abs(pubPct), direction: pubDirection, suffix: "%" }
          : undefined,
      icon: Send,
      accent: "success",
      onClick: () => onNavigate("planning"),
      loading: loadingPublished,
    },
    {
      key: "tokens",
      label: "Tokens disponíveis",
      value: balance.toLocaleString("pt-BR"),
      hint: periodHint,
      icon: Coins,
      accent: usedPct >= 80 ? "destructive" : usedPct >= 50 ? "warning" : "primary",
      progress: usedPct,
      onClick: () => onNavigate("billing"),
      loading: !tokens && !!workspaceId,
    },
  ];

  const accentClass = (accent?: StatCardData["accent"]) => {
    switch (accent) {
      case "success":
        return "text-emerald-500";
      case "warning":
        return "text-orange-500";
      case "destructive":
        return "text-destructive";
      case "primary":
      default:
        return "text-primary";
    }
  };

  const progressClass = (accent?: StatCardData["accent"]) => {
    switch (accent) {
      case "destructive":
        return "[&>div]:bg-destructive";
      case "warning":
        return "[&>div]:bg-orange-500";
      case "success":
        return "[&>div]:bg-emerald-500";
      default:
        return "[&>div]:bg-primary";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
    >
      {cards.map((card) => {
        const TIcon = card.trend ? trendIcon(card.trend.direction) : null;
        return (
          <Card
            key={card.key}
            onClick={card.onClick}
            className={cn(
              "cursor-pointer transition-all duration-200 group relative overflow-hidden",
              "hover:border-border/80 hover:bg-accent/30"
            )}
          >
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {card.label}
                </span>
                <card.icon
                  className={cn("h-4 w-4 transition-colors", accentClass(card.accent))}
                />
              </div>
              {card.loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-semibold tabular-nums text-foreground">
                    {card.value}
                  </p>
                  {card.trend && TIcon && (
                    <span
                      className={cn(
                        "flex items-center gap-0.5 text-[11px] font-medium",
                        trendClass(card.trend.direction)
                      )}
                    >
                      <TIcon className="h-3 w-3" />
                      {card.trend.value}
                      {card.trend.suffix}
                    </span>
                  )}
                </div>
              )}
              {card.progress != null && !card.loading && (
                <Progress
                  value={card.progress}
                  className={cn("h-1 mt-3", progressClass(card.accent))}
                />
              )}
              {card.hint && !card.loading && (
                <p className="text-[10.5px] text-muted-foreground/70 mt-2 line-clamp-1">
                  {card.hint}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </motion.div>
  );
}
