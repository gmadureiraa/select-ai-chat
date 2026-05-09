// NotificationsBell — agregador de pendências do workspace, embutido no
// hero do HomeDashboard. Mostra contagem total + breakdown clicável.
//
// Fontes (todas no_workspaces escopo, scope=workspace_id):
//  1. planning_items.status='review'           → drafts esperando revisão
//  2. planning_items scheduled_at=hoje + status agendado/aprovado
//  3. planning_items overdue (scheduled_at<now e status!=published/failed)
//  4. team_tasks atribuídas ao user com due_date<=hoje e status!=done
//  5. metricool_inbox unread (já temos hook — agrega por todos clientes)
//
// Cada item tem onClick que dispara `onNavigate`/`onFilter` no pai pra
// abrir a tab correta com o filtro aplicado.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  AlertTriangle,
  Eye,
  Clock,
  CheckSquare,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { addDays, startOfDay, endOfDay, isPast, parseISO, isToday } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { useMyTeamTasks } from "@/hooks/useTeamTasks";
import { useClients } from "@/hooks/useClients";
import { useInboxUnreadCount } from "@/hooks/useMetricoolInbox";
import { cn } from "@/lib/utils";

interface NotificationsBellProps {
  onNavigate: (tab: string) => void;
  onFilterKpi?: (kpi: "overdue" | "today") => void;
}

export function NotificationsBell({ onNavigate, onFilterKpi }: NotificationsBellProps) {
  const { workspace } = useWorkspaceContext();
  const { user } = useAuth();
  const { clients } = useClients();
  const workspaceId = workspace?.id;

  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();

  // 1+2+3: drafts em revisão / agendados pra hoje / atrasados
  const { data: pipelineCounts } = useQuery({
    queryKey: ["home-notif-pipeline", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { review: 0, today: 0, overdue: 0 };
      const sixtyDaysAgo = addDays(now, -60).toISOString();
      const [{ count: review }, { count: today }, { data: overdueRows }] =
        await Promise.all([
          supabase
            .from("planning_items")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("status", "review"),
          supabase
            .from("planning_items")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .gte("scheduled_at", todayStart)
            .lte("scheduled_at", todayEnd)
            .in("status", ["scheduled", "approved", "review", "draft"]),
          supabase
            .from("planning_items")
            .select("id, status, scheduled_at")
            .eq("workspace_id", workspaceId)
            .gte("scheduled_at", sixtyDaysAgo)
            .lt("scheduled_at", now.toISOString())
            .not("status", "in", "(published,failed)"),
        ]);
      const overdue = (overdueRows ?? []).filter(
        (r) => r.scheduled_at && !isToday(new Date(r.scheduled_at))
      ).length;
      return {
        review: review ?? 0,
        today: today ?? 0,
        overdue,
      };
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // 4: tarefas vencidas / pra hoje
  const { data: myTasks = [] } = useMyTeamTasks(7);
  const tasksDueOrOverdue = useMemo(
    () =>
      myTasks.filter((t) => {
        if (!t.due_date) return false;
        const d = parseISO(t.due_date);
        return isPast(d) || isToday(d);
      }).length,
    [myTasks]
  );

  // 5: inbox unread — agregado simples (1º cliente como proxy)
  // Hook já existe per-client; somar todos seria N requests, então
  // pegamos o primeiro cliente como amostra "sentinela" (futuro: view agregada).
  const sentinelClientId = clients?.[0]?.id ?? null;
  const { data: inboxUnread = 0 } = useInboxUnreadCount(sentinelClientId);

  const items = useMemo(() => {
    const arr: Array<{
      key: string;
      label: string;
      hint: string;
      count: number;
      icon: React.ElementType;
      tone: "danger" | "warning" | "info" | "neutral";
      onClick: () => void;
    }> = [];

    if ((pipelineCounts?.overdue ?? 0) > 0) {
      arr.push({
        key: "overdue",
        label: "Itens atrasados",
        hint: "Posts com data passada que não foram publicados",
        count: pipelineCounts!.overdue,
        icon: AlertTriangle,
        tone: "danger",
        onClick: () => onFilterKpi?.("overdue"),
      });
    }
    if ((pipelineCounts?.review ?? 0) > 0) {
      arr.push({
        key: "review",
        label: "Aguardando revisão",
        hint: "Drafts prontos esperando aprovação",
        count: pipelineCounts!.review,
        icon: Eye,
        tone: "warning",
        onClick: () => onNavigate("planning"),
      });
    }
    if ((pipelineCounts?.today ?? 0) > 0) {
      arr.push({
        key: "today",
        label: "Agendados pra hoje",
        hint: "Posts que devem sair nas próximas horas",
        count: pipelineCounts!.today,
        icon: Clock,
        tone: "info",
        onClick: () => onFilterKpi?.("today"),
      });
    }
    if (tasksDueOrOverdue > 0) {
      arr.push({
        key: "tasks",
        label: "Tarefas pendentes",
        hint: "Tarefas suas vencidas ou pra hoje",
        count: tasksDueOrOverdue,
        icon: CheckSquare,
        tone: "warning",
        onClick: () => onNavigate("tasks"),
      });
    }
    if (inboxUnread > 0) {
      arr.push({
        key: "inbox",
        label: "DMs não lidas",
        hint: `Mensagens novas no inbox de ${clients?.[0]?.name ?? "cliente"}`,
        count: inboxUnread,
        icon: MessageSquare,
        tone: "info",
        onClick: () => onNavigate("inbox"),
      });
    }
    return arr;
  }, [
    pipelineCounts,
    tasksDueOrOverdue,
    inboxUnread,
    clients,
    onNavigate,
    onFilterKpi,
  ]);

  const total = items.reduce((sum, i) => sum + i.count, 0);
  const hasDanger = items.some((i) => i.tone === "danger");

  if (!user || !workspaceId) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "relative gap-1.5 kai-btn-rec",
            hasDanger && "border-destructive/40"
          )}
          aria-label={`Notificações${total > 0 ? `: ${total} pendentes` : ""}`}
        >
          <Bell
            className={cn(
              "h-3.5 w-3.5",
              hasDanger
                ? "text-destructive"
                : total > 0
                  ? "text-primary"
                  : "text-muted-foreground"
            )}
          />
          {total > 0 ? (
            <>
              <span className="text-xs font-medium tabular-nums">{total}</span>
              <span className="hidden md:inline text-[11px] text-muted-foreground">
                pendência{total === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <span className="hidden md:inline text-[11px] text-muted-foreground">
              tudo em dia
            </span>
          )}
          {hasDanger && (
            <motion.span
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border/40">
          <h4 className="text-sm font-medium">Pendências</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {total === 0
              ? "Nada pra revisar agora — bom trabalho!"
              : `${total} item${total === 1 ? "" : "s"} pedindo sua atenção`}
          </p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <AnimatePresence initial={false}>
            {items.length === 0 ? (
              <div className="py-8 text-center px-4">
                <Bell className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Nenhuma pendência no momento
                </p>
              </div>
            ) : (
              items.map((it) => (
                <motion.button
                  key={it.key}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  type="button"
                  onClick={it.onClick}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left border-b border-border/30 last:border-b-0"
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                      it.tone === "danger" && "bg-destructive/10 text-destructive",
                      it.tone === "warning" && "bg-amber-500/10 text-amber-500",
                      it.tone === "info" && "bg-primary/10 text-primary",
                      it.tone === "neutral" &&
                        "bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <it.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{it.label}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] h-4 px-1.5 tabular-nums",
                          it.tone === "danger" &&
                            "border-destructive/30 text-destructive bg-destructive/5",
                          it.tone === "warning" &&
                            "border-amber-500/30 text-amber-500 bg-amber-500/5",
                          it.tone === "info" &&
                            "border-primary/30 text-primary bg-primary/5"
                        )}
                      >
                        {it.count}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {it.hint}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                </motion.button>
              ))
            )}
          </AnimatePresence>
        </div>
      </PopoverContent>
    </Popover>
  );
}
