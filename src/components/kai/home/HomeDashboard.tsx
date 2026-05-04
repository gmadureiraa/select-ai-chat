import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  ArrowRight,
  X,
  Filter,
  Sparkles,
  Send,
  Eye,
  Edit3,
  Lightbulb,
  LayoutGrid,
  Twitter,
  Linkedin,
  Instagram,
  Mail,
  FileText,
  Video,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  format,
  isToday,
  isPast,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isWithinInterval,
  isTomorrow,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { MyTasksWidget } from "./MyTasksWidget";

interface HomeDashboardProps {
  onNavigate: (tab: string) => void;
  onOpenItem?: (itemId: string) => void;
  selectedClientId?: string;
}

type ActiveFilter = {
  type: "client" | "status" | "kpi";
  value: string;
  label: string;
} | null;

const platformIcons: Record<string, React.ElementType> = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  newsletter: Mail,
  blog: FileText,
  tiktok: Video,
};

const statusLabels: Record<string, string> = {
  idea: "Ideias",
  draft: "Rascunho",
  review: "Revisão",
  approved: "Aprovado",
  scheduled: "Agendado",
  published: "Publicado",
  publishing: "Publicando",
  failed: "Falhou",
};

const statusDots: Record<string, string> = {
  idea: "bg-purple-400",
  draft: "bg-blue-400",
  review: "bg-yellow-400",
  approved: "bg-emerald-400",
  scheduled: "bg-orange-400",
  published: "bg-muted-foreground/50",
  publishing: "bg-primary",
  failed: "bg-destructive",
};

const statusBg: Record<string, string> = {
  idea: "bg-purple-500/8 text-purple-400 border-purple-500/20",
  draft: "bg-blue-500/8 text-blue-400 border-blue-500/20",
  review: "bg-yellow-500/8 text-yellow-400 border-yellow-500/20",
  approved: "bg-emerald-500/8 text-emerald-400 border-emerald-500/20",
  scheduled: "bg-orange-500/8 text-orange-400 border-orange-500/20",
  published: "bg-muted/50 text-muted-foreground border-border/50",
  publishing: "bg-primary/8 text-primary border-primary/20",
  failed: "bg-destructive/8 text-destructive border-destructive/20",
};

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomeDashboard({ onNavigate, onOpenItem, selectedClientId }: HomeDashboardProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { clients } = useClients();
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-home", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const userName = useMemo(
    () =>
      userProfile?.full_name ||
      user?.user_metadata?.full_name ||
      user?.email?.split("@")[0] ||
      "",
    [userProfile, user]
  );

  const { data: planningItems } = useQuery({
    queryKey: ["home-dashboard-items", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data } = await supabase
        .from("planning_items")
        .select(
          "id, title, status, scheduled_at, client_id, platform, assigned_to, updated_at, content_type, priority"
        )
        .eq("workspace_id", workspaceId)
        .order("scheduled_at", { ascending: true })
        .limit(2000);
      return data || [];
    },
    enabled: !!workspaceId,
  });

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // ── derived stats ──
  const stats = useMemo(() => {
    if (!planningItems)
      return {
        overdue: [],
        today: [],
        tomorrow: [],
        thisWeek: [],
        byClient: [] as {
          clientId: string;
          total: number;
          pending: number;
          published: number;
          review: number;
        }[],
        byStatus: {} as Record<string, number>,
        totalItems: 0,
        byPlatform: {} as Record<string, number>,
      };

    const overdue = planningItems.filter(
      (i) =>
        i.scheduled_at &&
        isPast(new Date(i.scheduled_at)) &&
        !isToday(new Date(i.scheduled_at)) &&
        !["published", "failed"].includes(i.status)
    );

    const today = planningItems.filter(
      (i) => i.scheduled_at && isToday(new Date(i.scheduled_at))
    );

    const tomorrow = planningItems.filter(
      (i) => i.scheduled_at && isTomorrow(new Date(i.scheduled_at))
    );

    const thisWeek = planningItems.filter((i) => {
      if (!i.scheduled_at) return false;
      const d = new Date(i.scheduled_at);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    });

    const byClient: Record<
      string,
      { total: number; pending: number; published: number; review: number }
    > = {};
    const byPlatform: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    planningItems.forEach((item) => {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
      if (item.platform) byPlatform[item.platform] = (byPlatform[item.platform] || 0) + 1;
      if (!item.client_id) return;
      if (!byClient[item.client_id])
        byClient[item.client_id] = { total: 0, pending: 0, published: 0, review: 0 };
      byClient[item.client_id].total++;
      if (item.status === "published") byClient[item.client_id].published++;
      else if (item.status === "review") byClient[item.client_id].review++;
      else byClient[item.client_id].pending++;
    });

    return {
      overdue,
      today,
      tomorrow,
      thisWeek,
      byClient: Object.entries(byClient)
        .map(([clientId, s]) => ({ clientId, ...s }))
        .sort((a, b) => b.pending - a.pending),
      byStatus,
      totalItems: planningItems.length,
      byPlatform,
    };
  }, [planningItems, weekStart, weekEnd]);

  // ── filtered items based on active filter ──
  const filteredItems = useMemo(() => {
    if (!planningItems || !activeFilter) return null;
    let items = planningItems;
    if (activeFilter.type === "client") {
      items = items.filter((i) => i.client_id === activeFilter.value);
    } else if (activeFilter.type === "status") {
      items = items.filter((i) => i.status === activeFilter.value);
    } else if (activeFilter.type === "kpi") {
      if (activeFilter.value === "overdue") {
        items = stats.overdue;
      } else if (activeFilter.value === "today") {
        items = stats.today;
      } else if (activeFilter.value === "week") {
        items = stats.thisWeek;
      } else if (activeFilter.value === "published") {
        items = items.filter((i) => i.status === "published");
      }
    }
    return items.slice(0, 20);
  }, [planningItems, activeFilter, stats]);

  const recentlyPublished = useMemo(() => {
    if (!planningItems) return [];
    return planningItems
      .filter((i) => i.status === "published")
      .sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
      .slice(0, 5);
  }, [planningItems]);

  // ── weekly timeline items ──
  const weeklyTimeline = useMemo(() => {
    if (!planningItems) return weekDays.map((d) => ({ date: d, items: [] as typeof planningItems }));
    return weekDays.map((day) => ({
      date: day,
      items: planningItems.filter(
        (i) => i.scheduled_at && isSameDay(new Date(i.scheduled_at), day)
      ),
    }));
  }, [planningItems, weekDays]);

  const getClientName = (clientId: string) =>
    clients?.find((c) => c.id === clientId)?.name || "—";
  const getClientAvatar = (clientId: string) =>
    clients?.find((c) => c.id === clientId)?.avatar_url || null;

  const handleFilter = (filter: ActiveFilter) => {
    if (
      activeFilter &&
      filter &&
      activeFilter.type === filter.type &&
      activeFilter.value === filter.value
    ) {
      setActiveFilter(null);
    } else {
      setActiveFilter(filter);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "idea": return <Lightbulb className="h-3 w-3" />;
      case "draft": return <Edit3 className="h-3 w-3" />;
      case "review": return <Eye className="h-3 w-3" />;
      case "approved": return <CheckCircle2 className="h-3 w-3" />;
      case "scheduled": return <Clock className="h-3 w-3" />;
      case "published": return <Send className="h-3 w-3" />;
      default: return <LayoutGrid className="h-3 w-3" />;
    }
  };

  // Pipeline order
  const pipelineStatuses = ["idea", "draft", "review", "approved", "scheduled"];
  const pipelineTotal = pipelineStatuses.reduce(
    (sum, s) => sum + (stats.byStatus[s] || 0),
    0
  );

  return (
    <div className={cn("h-full overflow-y-auto", isMobile ? "p-3" : "p-6 lg:p-8")}>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* ─── Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-end justify-between"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-light text-foreground tracking-tight">
              {getTimeGreeting()}
              {userName ? `, ${userName}` : ""}{" "}
              <span className="inline-block animate-pulse">✦</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })} ·{" "}
              <span className="text-foreground/70">{stats.totalItems} itens no pipeline</span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 hidden md:flex"
            onClick={() => onNavigate("planning")}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Ver planejamento
          </Button>
        </motion.div>

        {/* ─── Active filter indicator ─── */}
        <AnimatePresence>
          {activeFilter && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                <Filter className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm text-foreground/80">
                  Filtrando por: <strong className="text-primary">{activeFilter.label}</strong>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 ml-auto"
                  onClick={() => setActiveFilter(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── KPI Row ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {[
            {
              key: "overdue",
              label: "Atrasados",
              value: stats.overdue.length,
              icon: AlertTriangle,
              danger: stats.overdue.length > 0,
            },
            {
              key: "today",
              label: "Hoje",
              value: stats.today.length,
              icon: Clock,
              accent: true,
            },
            {
              key: "week",
              label: "Esta semana",
              value: stats.thisWeek.length,
              icon: CalendarDays,
            },
            {
              key: "published",
              label: "Publicados",
              value: stats.byStatus["published"] || 0,
              icon: CheckCircle2,
              success: true,
            },
          ].map((kpi) => {
            const isActive =
              activeFilter?.type === "kpi" && activeFilter.value === kpi.key;
            return (
              <Card
                key={kpi.key}
                className={cn(
                  "cursor-pointer transition-all duration-200 group relative overflow-hidden",
                  isActive
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                    : kpi.danger
                    ? "border-destructive/30 hover:border-destructive/50"
                    : "hover:border-border/80 hover:bg-accent/30"
                )}
                onClick={() =>
                  handleFilter({ type: "kpi", value: kpi.key, label: kpi.label })
                }
              >
                <CardContent className="p-4 relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {kpi.label}
                    </span>
                    <kpi.icon
                      className={cn(
                        "h-4 w-4 transition-colors",
                        kpi.danger
                          ? "text-destructive"
                          : kpi.success
                          ? "text-emerald-500"
                          : kpi.accent
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <p
                    className={cn(
                      "text-3xl font-semibold tabular-nums",
                      kpi.danger && kpi.value > 0
                        ? "text-destructive"
                        : "text-foreground"
                    )}
                  >
                    {kpi.value}
                  </p>
                </CardContent>
                {/* Subtle gradient accent */}
                {kpi.danger && kpi.value > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-t from-destructive/5 to-transparent pointer-events-none" />
                )}
              </Card>
            );
          })}
        </motion.div>

        {/* ─── Filtered results panel ─── */}
        <AnimatePresence>
          {filteredItems && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    {activeFilter?.label} ({filteredItems.length} itens)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Nenhum item encontrado
                    </p>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {filteredItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 py-2.5 px-1 hover:bg-muted/20 rounded-md transition-colors cursor-pointer -mx-1"
                          onClick={() => onOpenItem?.(item.id)}
                        >
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              statusDots[item.status] || "bg-muted-foreground"
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">
                              {item.title || "Sem título"}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">
                                {getClientName(item.client_id)}
                              </span>
                              {item.scheduled_at && (
                                <span className="text-[11px] text-muted-foreground/60">
                                  · {format(new Date(item.scheduled_at), "dd/MM")}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] border shrink-0",
                              statusBg[item.status] || ""
                            )}
                          >
                            {statusLabels[item.status] || item.status}
                          </Badge>
                          {item.platform && (
                            (() => {
                              const Icon = platformIcons[item.platform];
                              return Icon ? (
                                <Icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                              ) : null;
                            })()
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Main Grid ─── */}
        <div
          className={cn(
            "grid gap-5",
            isMobile ? "grid-cols-1" : "grid-cols-12"
          )}
        >
          {/* Left column — content feed */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(isMobile ? "" : "col-span-7 space-y-5")}
          >
            {/* Overdue */}
            {stats.overdue.length > 0 && (
              <Card className="border-destructive/15 bg-destructive/[0.02]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Atrasados
                    <Badge variant="destructive" className="ml-auto text-[10px] h-5">
                      {stats.overdue.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {stats.overdue.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-destructive/5 transition-colors cursor-pointer"
                      onClick={() => onOpenItem?.(item.id)}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.title || "Sem título"}</p>
                        <span className="text-[11px] text-muted-foreground">
                          {getClientName(item.client_id)}
                          {item.scheduled_at && (
                            <> · {format(new Date(item.scheduled_at), "dd/MM")}</>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                  {stats.overdue.length > 4 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-destructive/70 hover:text-destructive"
                      onClick={() =>
                        handleFilter({
                          type: "kpi",
                          value: "overdue",
                          label: "Atrasados",
                        })
                      }
                    >
                      Ver todos ({stats.overdue.length}){" "}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Today */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Hoje
                  <span className="text-muted-foreground font-normal ml-1">
                    ({stats.today.length})
                  </span>
                  {stats.tomorrow.length > 0 && (
                    <span className="ml-auto text-[11px] text-muted-foreground/60 font-normal">
                      Amanhã: {stats.tomorrow.length}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.today.length === 0 ? (
                  <div className="py-8 text-center">
                    <Sparkles className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Agenda livre hoje
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {stats.tomorrow.length > 0
                        ? `${stats.tomorrow.length} item${stats.tomorrow.length > 1 ? "s" : ""} amanhã`
                        : "Nenhum item agendado para os próximos dias"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {stats.today.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => onOpenItem?.(item.id)}
                      >
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            statusDots[item.status]
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate group-hover:text-foreground transition-colors">
                            {item.title || "Sem título"}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground">
                              {getClientName(item.client_id)}
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] border shrink-0",
                            statusBg[item.status]
                          )}
                        >
                          {statusLabels[item.status] || item.status}
                        </Badge>
                        {item.platform &&
                          (() => {
                            const Icon = platformIcons[item.platform];
                            return Icon ? (
                              <Icon className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                            ) : null;
                          })()}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recently Published */}
            {recentlyPublished.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500/70" />
                    Publicados recentemente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {recentlyPublished.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => onOpenItem?.(item.id)}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate text-muted-foreground">
                          {item.title || "Sem título"}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground/60 shrink-0">
                        {getClientName(item.client_id)}
                      </span>
                      <span className="text-[11px] text-muted-foreground/40 shrink-0">
                        {format(new Date(item.updated_at), "dd/MM")}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Right column — Pipeline + Clients */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={cn(isMobile ? "" : "col-span-5 space-y-5")}
          >
            {/* Pipeline */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Pipeline
                  <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
                    {pipelineTotal} ativos
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {pipelineStatuses.map((status) => {
                  const count = stats.byStatus[status] || 0;
                  const pct = pipelineTotal > 0 ? (count / pipelineTotal) * 100 : 0;
                  const isActive =
                    activeFilter?.type === "status" &&
                    activeFilter.value === status;
                  return (
                    <div
                      key={status}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all",
                        isActive
                          ? "bg-primary/5 ring-1 ring-primary/20"
                          : "hover:bg-muted/30"
                      )}
                      onClick={() =>
                        handleFilter({
                          type: "status",
                          value: status,
                          label: statusLabels[status] || status,
                        })
                      }
                    >
                      <div className="flex items-center gap-2 w-24 shrink-0">
                        {statusIcon(status)}
                        <span className="text-xs text-muted-foreground">
                          {statusLabels[status]}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: 0.3, duration: 0.6 }}
                            className={cn(
                              "h-full rounded-full",
                              statusDots[status]
                            )}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium tabular-nums w-8 text-right">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Clients */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Clientes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {stats.byClient.slice(0, 10).map(({ clientId, total, pending, published, review }) => {
                  const avatarUrl = getClientAvatar(clientId);
                  const isActive =
                    activeFilter?.type === "client" &&
                    activeFilter.value === clientId;
                  const pubPct = total > 0 ? (published / total) * 100 : 0;
                  return (
                    <div
                      key={clientId}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all",
                        isActive
                          ? "bg-primary/5 ring-1 ring-primary/20"
                          : "hover:bg-muted/30"
                      )}
                      onClick={() =>
                        handleFilter({
                          type: "client",
                          value: clientId,
                          label: getClientName(clientId),
                        })
                      }
                    >
                      <Avatar className="h-7 w-7 rounded-md shrink-0">
                        {avatarUrl && <AvatarImage src={avatarUrl} />}
                        <AvatarFallback className="rounded-md bg-primary/10 text-primary text-[10px] font-medium">
                          {getClientName(clientId).charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getClientName(clientId)}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex-1 h-1 rounded-full bg-muted/50 overflow-hidden max-w-[80px]">
                            <div
                              className="h-full rounded-full bg-emerald-500/60"
                              style={{ width: `${pubPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground/60">
                            {published}/{total}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {review > 0 && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge
                                variant="outline"
                                className="text-[9px] h-4 px-1 border-yellow-500/30 text-yellow-400"
                              >
                                {review}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              {review} em revisão
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {pending}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Platform distribution */}
            {Object.keys(stats.byPlatform).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Plataformas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.byPlatform)
                      .sort(([, a], [, b]) => b - a)
                      .map(([platform, count]) => {
                        const Icon = platformIcons[platform];
                        return (
                          <div
                            key={platform}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/30 border border-border/30"
                          >
                            {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />}
                            <span className="text-xs text-muted-foreground capitalize">
                              {platform}
                            </span>
                            <span className="text-xs font-medium tabular-nums">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>

        {/* ─── Weekly Timeline ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Semana
                <span className="font-normal text-muted-foreground">
                  {format(weekStart, "d MMM", { locale: ptBR })} –{" "}
                  {format(weekEnd, "d MMM", { locale: ptBR })}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "grid gap-2",
                  isMobile ? "grid-cols-1" : "grid-cols-7"
                )}
              >
                {weeklyTimeline.map(({ date, items }) => {
                  const isCurrentDay = isToday(date);
                  const isPastDay = isPast(date) && !isToday(date);
                  return (
                    <div
                      key={date.toISOString()}
                      className={cn(
                        "rounded-lg border p-2.5 min-h-[100px] transition-colors",
                        isCurrentDay
                          ? "border-primary/40 bg-primary/[0.03]"
                          : isPastDay
                          ? "border-border/30 bg-muted/10 opacity-60"
                          : "border-border/30 hover:border-border/60"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={cn(
                            "text-[11px] font-medium uppercase tracking-wider",
                            isCurrentDay
                              ? "text-primary"
                              : "text-muted-foreground/70"
                          )}
                        >
                          {format(date, "EEE", { locale: ptBR })}
                        </span>
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            isCurrentDay
                              ? "text-primary font-semibold bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center"
                              : "text-muted-foreground/60"
                          )}
                        >
                          {format(date, "d")}
                        </span>
                      </div>
                      {items.length === 0 ? (
                        <div className="flex items-center justify-center h-12">
                          <span className="text-[10px] text-muted-foreground/30">
                            —
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {items.slice(0, 3).map((item) => (
                            <Tooltip key={item.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] cursor-pointer transition-colors",
                                    "hover:bg-muted/30"
                                  )}
                                  onClick={() => onOpenItem?.(item.id)}
                                >
                                  <div
                                    className={cn(
                                      "w-1.5 h-1.5 rounded-full shrink-0",
                                      statusDots[item.status]
                                    )}
                                  />
                                  <span className="truncate flex-1">
                                    {item.title || "—"}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[200px]">
                                <p className="font-medium text-xs">
                                  {item.title || "Sem título"}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {getClientName(item.client_id)} ·{" "}
                                  {statusLabels[item.status]}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                          {items.length > 3 && (
                            <span className="text-[10px] text-muted-foreground/50 pl-1.5">
                              +{items.length - 3} mais
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}