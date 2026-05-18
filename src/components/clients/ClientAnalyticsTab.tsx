// ClientAnalyticsTab — analytics per-cliente plugado em ClientEditTabsSimplified.
// Mostra:
//   1. Stats virais do cliente (carrosséis, reels, briefs, planning) — 30d
//   2. Gráfico de criação de conteúdo por mês (último 6 meses) — SVG custom
//   3. Top 10 conteúdo do cliente por engagement (client_top_content view)
//   4. Tokens consumidos por feature (carousel/reel/brief/outros) — token_transactions
//   5. Últimos 5 eventos relevantes do cliente em user_activities
//
// Tudo usa apenas as tabelas que já existem (workspace_tokens, viral_*,
// planning_items, client_content_library, token_transactions, user_activities).
//
// 2026-05-17 — Migrado de Recharts → SVG primitive custom (svg-primitives).

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { VerticalBarChart } from "@/components/kai/charts/svg-primitives";
import {
  Activity,
  TrendingUp,
  Trophy,
  Coins,
  CalendarDays,
  Clock,
  FileText,
  Video,
  Radar as RadarIcon,
  Heart,
} from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useViralStats } from "@/hooks/useViralStats";
import { useTopViralContent } from "@/hooks/useTopViralContent";

interface ClientAnalyticsTabProps {
  clientId: string;
}

interface PlanningCreationRow {
  created_at: string;
}

interface TokenTxRow {
  description: string | null;
  amount: number;
  metadata: Record<string, any> | null;
  created_at: string;
}

interface UserActivityRow {
  id: string;
  activity_type: string;
  description: string;
  entity_name: string | null;
  created_at: string | null;
}

function formatScore(score: number | null | undefined) {
  if (!score || score < 1) return "—";
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`;
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}k`;
  return Math.round(score).toString();
}

// Heurística pra classificar token_transaction por feature.
function classifyTokenTx(tx: TokenTxRow): "carousel" | "reel" | "brief" | "other" {
  const desc = (tx.description || "").toLowerCase();
  const meta = JSON.stringify(tx.metadata || {}).toLowerCase();
  const haystack = `${desc} ${meta}`;
  if (haystack.includes("carousel") || haystack.includes("carrossel")) return "carousel";
  if (haystack.includes("reel")) return "reel";
  if (haystack.includes("brief") || haystack.includes("radar")) return "brief";
  return "other";
}

const featureLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  carousel: { label: "Carrosséis", icon: FileText, color: "text-blue-400" },
  reel: { label: "Reels", icon: Video, color: "text-purple-400" },
  brief: { label: "Briefs", icon: RadarIcon, color: "text-amber-400" },
  other: { label: "Outros", icon: Coins, color: "text-muted-foreground" },
};

export function ClientAnalyticsTab({ clientId }: ClientAnalyticsTabProps) {
  const { data: stats, isLoading: loadingStats } = useViralStats({ clientId, range: "30d" });
  const { data: topContent, isLoading: loadingTop } = useTopViralContent({
    clientId,
    limit: 10,
  });

  // Cliente -> workspace_id (pra tokens). Pula se já temos cliente — mas
  // também precisamos do workspace pra filtrar token_transactions por features.
  const { data: clientRow } = useQuery({
    queryKey: ["client-workspace", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("workspace_id, user_id")
        .eq("id", clientId)
        .single();
      return data as { workspace_id: string | null; user_id: string | null } | null;
    },
    staleTime: 5 * 60_000,
  });

  // Criação de planning_items por mês (últimos 6 meses) — gráfico de tendência
  const sixMonthsAgo = useMemo(() => startOfMonth(subMonths(new Date(), 5)), []);
  const { data: planningCreation, isLoading: loadingPlanning } = useQuery({
    queryKey: ["client-planning-creation", clientId, sixMonthsAgo.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("planning_items")
        .select("created_at")
        .eq("client_id", clientId)
        .gte("created_at", sixMonthsAgo.toISOString())
        .order("created_at", { ascending: true });
      return (data || []) as PlanningCreationRow[];
    },
    staleTime: 60_000,
  });

  const monthlyChartData = useMemo(() => {
    const months: { key: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      months.push({
        key: format(d, "yyyy-MM"),
        label: format(d, "MMM", { locale: ptBR }),
        count: 0,
      });
    }
    if (planningCreation) {
      planningCreation.forEach((row) => {
        const key = format(new Date(row.created_at), "yyyy-MM");
        const slot = months.find((m) => m.key === key);
        if (slot) slot.count++;
      });
    }
    return months;
  }, [planningCreation]);

  // Token transactions — últimos 30d, do workspace, classificadas por feature
  const { data: tokenTxs, isLoading: loadingTxs } = useQuery({
    queryKey: ["client-token-tx", clientRow?.workspace_id],
    enabled: !!clientRow?.workspace_id,
    queryFn: async () => {
      const since = subMonths(new Date(), 1).toISOString();
      const { data } = await supabase
        .from("token_transactions")
        .select("description, amount, metadata, created_at")
        .eq("workspace_id", clientRow!.workspace_id!)
        .lt("amount", 0) // só débitos
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      return (data || []) as TokenTxRow[];
    },
    staleTime: 60_000,
  });

  const tokensByFeature = useMemo(() => {
    const totals = { carousel: 0, reel: 0, brief: 0, other: 0 };
    (tokenTxs || []).forEach((tx) => {
      const cat = classifyTokenTx(tx);
      totals[cat] += Math.abs(tx.amount);
    });
    return totals;
  }, [tokenTxs]);

  const totalTokensSpent =
    tokensByFeature.carousel +
    tokensByFeature.reel +
    tokensByFeature.brief +
    tokensByFeature.other;

  // Atividades recentes — filtradas por entity_name = nome do cliente quando
  // possível, mas como user_activities é user-scoped, pegamos as últimas
  // que tenham descrição/entity contendo o id ou nome do cliente.
  const { data: clientName } = useQuery({
    queryKey: ["client-name", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();
      return data?.name as string | undefined;
    },
    staleTime: 5 * 60_000,
  });

  const { data: recentActivities, isLoading: loadingActivities } = useQuery({
    queryKey: ["client-activities", clientId, clientName, clientRow?.user_id],
    enabled: !!clientId,
    queryFn: async () => {
      // Pega últimas 50 atividades do user dono e filtra cliente-scoped
      let q = supabase
        .from("user_activities")
        .select("id, activity_type, description, entity_name, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (clientRow?.user_id) q = q.eq("user_id", clientRow.user_id);
      const { data } = await q;
      const rows = (data || []) as UserActivityRow[];
      if (!clientName) return rows.slice(0, 5);
      const filtered = rows.filter((r) => {
        const hay = `${r.description || ""} ${r.entity_name || ""}`.toLowerCase();
        return hay.includes(clientName.toLowerCase()) || hay.includes(clientId);
      });
      return (filtered.length > 0 ? filtered : rows).slice(0, 5);
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4 mt-4">
      {/* ─── Stats viral 30d ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Atividade viral — últimos 30 dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Cell
                icon={FileText}
                label="Carrosséis"
                value={stats?.carousels.this_period ?? 0}
                sub={`${stats?.carousels.total ?? 0} no total`}
              />
              <Cell
                icon={Video}
                label="Reels"
                value={stats?.reels.this_period ?? 0}
                sub={`${stats?.reels.total ?? 0} no total`}
              />
              <Cell
                icon={RadarIcon}
                label="Briefs Radar"
                value={stats?.briefs.this_period ?? 0}
                sub={`${stats?.briefs.total ?? 0} no total`}
              />
              <Cell
                icon={CalendarDays}
                label="Planning"
                value={stats?.planning.published_this_period ?? 0}
                sub={`${stats?.planning.scheduled ?? 0} agendados`}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Criação por mês (chart) ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Criação de itens por mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPlanning ? (
            <Skeleton className="h-[180px] w-full" />
          ) : monthlyChartData.every((m) => m.count === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sem itens criados nos últimos 6 meses
            </p>
          ) : (
            <VerticalBarChart
              data={monthlyChartData.map((m) => ({ label: m.label, value: m.count }))}
              color="hsl(var(--primary))"
              height={180}
              formatValue={(v) => String(Math.round(v))}
              topRadius={4}
              ariaLabel="Criação de itens por mês — últimos 6 meses"
            />
          )}
        </CardContent>
      </Card>

      {/* ─── Top conteúdo ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500/80" />
            Top 10 conteúdo por engagement
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTop ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !topContent || topContent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sem histórico de conteúdo. Importe via Library pra ver o ranking.
            </p>
          ) : (
            <div className="space-y-1">
              {topContent.map((row) => {
                const platform = row.metadata?.platform as string | undefined;
                return (
                  <div
                    key={row.id}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors"
                  >
                    <div className="h-5 w-5 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center text-[10px] font-semibold shrink-0">
                      {row.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug line-clamp-2">
                        {row.title || row.content?.slice(0, 80) || "Sem título"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {platform && (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1 capitalize"
                          >
                            {platform}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <Heart className="h-3 w-3" />
                      <span className="tabular-nums">
                        {formatScore(row.engagement_score)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Tokens por feature ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-500/80" />
            Tokens consumidos (workspace, últimos 30d)
            {totalTokensSpent > 0 && (
              <span className="ml-auto text-[11px] font-normal text-muted-foreground tabular-nums">
                {totalTokensSpent.toLocaleString("pt-BR")} total
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTxs ? (
            <Skeleton className="h-20 w-full" />
          ) : totalTokensSpent === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum token consumido nesse período
            </p>
          ) : (
            <div className="space-y-2.5">
              {(["carousel", "reel", "brief", "other"] as const).map((cat) => {
                const meta = featureLabels[cat];
                const value = tokensByFeature[cat];
                const pct =
                  totalTokensSpent > 0
                    ? Math.round((value / totalTokensSpent) * 100)
                    : 0;
                if (value === 0) return null;
                const Icon = meta.icon;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-28 shrink-0">
                      <Icon className={cn("h-3.5 w-3.5", meta.color)} />
                      <span className="text-xs text-muted-foreground">
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full bg-primary")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-medium tabular-nums w-16 text-right">
                      {value.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">
                      {pct}%
                    </span>
                  </div>
                );
              })}
              <p className="text-[10.5px] text-muted-foreground/60 mt-2">
                Workspace-level: todos os clientes compartilham o mesmo pool. Filtro por
                cliente ainda não disponível em token_transactions.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Atividade recente ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Atividade recente do cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingActivities ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !recentActivities || recentActivities.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma atividade recente
            </p>
          ) : (
            <div className="space-y-1">
              {recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start gap-2 p-2 rounded-md"
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground/90 leading-tight">
                      {act.description}
                      {act.entity_name && (
                        <span className="text-muted-foreground/80">
                          {" "}
                          · {act.entity_name}
                        </span>
                      )}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground/60 mt-0.5">
                      {act.created_at
                        ? format(new Date(act.created_at), "dd/MM HH:mm", {
                            locale: ptBR,
                          })
                        : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Cell({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="p-3 rounded-lg border border-border/40">
      <div className="flex items-center gap-2 text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
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
    </div>
  );
}
