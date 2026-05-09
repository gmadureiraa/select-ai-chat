// HomeDashboard — entrypoint do KAI 2.0 (rota /início, ?tab=home).
//
// Reescrito 2026-05-09: alimentado 100% por dados reais (planning_items +
// metricool_posts + metricool_daily_snapshots). Substitui o dashboard antigo
// que era pesado em pipeline/Kanban e leve em performance.
//
// Layout (top-down):
//   1. Hero — saudação + workspace stats agregadas + plan badge + sino
//   2. Quick actions (4 cards grandes, sensitive a hasClients)
//   3. Pendências — NotificationsBell expandido em card
//   4. Performance Snapshot — grid de cards por cliente (sparkline real)
//   5. Top Performers — top 6 posts cross-cliente últimos 30d
//   6. Próximos Posts — timeline lateral de scheduled
//   7. Atividade recente — log discreto
//   8. Setup checklist — só se < 100% configurado
//
// Tudo é client-driven: cada bloco renderiza empty-state amigável quando
// não há dados (em vez de zeros silenciosos).
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  Eye,
  Film,
  Heart,
  Image as ImageIcon,
  LineChart,
  MessageCircle,
  MessageSquare,
  Radar as RadarIcon,
  Send,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  format,
  formatDistanceToNow,
  isPast,
  isToday,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useDashboardClientCards } from "@/hooks/useDashboardClientCards";
import { useDashboardTopPosts } from "@/hooks/useDashboardTopPosts";
import { useDashboardUpcoming } from "@/hooks/useDashboardUpcoming";
import { useMyTeamTasks } from "@/hooks/useTeamTasks";
import { useInboxUnreadCount } from "@/hooks/useMetricoolInbox";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getNetworkBranding } from "@/lib/network-branding";
import { ClientPerformanceCard } from "./ClientPerformanceCard";
import { NotificationsBell } from "./NotificationsBell";
import { RecentActivity } from "./RecentActivity";

interface HomeDashboardProps {
  onNavigate: (tab: string) => void;
  onOpenItem?: (itemId: string) => void;
  onSelectClient?: (clientId: string, tab?: string) => void;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — tudo inline pra um arquivo só (legibilidade > splits forçados)
// ─────────────────────────────────────────────────────────────────────────────

interface QuickActionCardProps {
  icon: React.ElementType;
  label: string;
  description: string;
  accent: string;
  primary?: boolean;
  onClick: () => void;
}

function QuickActionCard({
  icon: Icon,
  label,
  description,
  accent,
  primary,
  onClick,
}: QuickActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start gap-3 p-4 md:p-5 rounded-xl border transition-all duration-200 text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        primary
          ? "border-primary/40 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent hover:border-primary/70 hover:shadow-lg hover:shadow-primary/5 ring-1 ring-primary/20"
          : "border-border/50 bg-card hover:border-border hover:shadow-md hover:bg-accent/30",
      )}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
          accent,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 w-full">
        <p className="text-sm font-semibold text-foreground truncate">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {description}
        </p>
      </div>
      <ArrowRight className="absolute top-4 right-4 h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
    </button>
  );
}

interface TopPerformerCardProps {
  post: import("@/hooks/useDashboardTopPosts").TopPostRow;
  onClick?: () => void;
}

function TopPerformerCard({ post, onClick }: TopPerformerCardProps) {
  const branding = getNetworkBranding(post.network);
  const NetIcon = branding.icon;
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "shrink-0 w-[260px] sm:w-[280px] overflow-hidden transition-all",
        onClick &&
          "cursor-pointer hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-muted/30 overflow-hidden">
        {post.thumbnailUrl ? (
          <img
            src={post.thumbnailUrl}
            alt={post.caption?.slice(0, 80) ?? `Post ${post.network}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/30">
            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {/* Network badge top-left */}
        <div
          className={cn(
            "absolute top-2 left-2 h-7 w-7 rounded-md flex items-center justify-center shadow-sm",
            branding.bgGradient,
          )}
        >
          <NetIcon className={cn("h-3.5 w-3.5", branding.iconOnBgClass)} />
        </div>
        {/* Engagement badge top-right */}
        <Badge
          variant="secondary"
          className="absolute top-2 right-2 bg-background/85 backdrop-blur-sm text-foreground border-0 gap-1 font-medium"
        >
          <TrendingUp className="h-3 w-3 text-emerald-500" />
          {formatNumber(post.engagement)}
        </Badge>
      </div>

      <CardContent className="p-3 space-y-2">
        <p className="text-xs text-foreground line-clamp-2 leading-relaxed min-h-[32px]">
          {post.caption?.trim() || "—"}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Avatar className="h-4 w-4 rounded-full">
            <AvatarImage src={post.clientAvatar ?? undefined} />
            <AvatarFallback className="text-[7px]">
              {post.clientName.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate flex-1">{post.clientName}</span>
          {post.publishedAt && (
            <span className="shrink-0">
              {format(new Date(post.publishedAt), "dd/MM")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80 pt-1 border-t border-border/40">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" /> {formatNumber(post.likes)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" /> {formatNumber(post.comments)}
          </span>
          {post.reach > 0 && (
            <span className="ml-auto flex items-center gap-1 tabular-nums">
              {formatNumber(post.reach)} alc
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup checklist — primeira semana
// ─────────────────────────────────────────────────────────────────────────────

interface SetupItem {
  key: string;
  label: string;
  done: boolean;
  cta?: { label: string; tab: string };
}

function useSetupChecklist(opts: {
  hasClients: boolean;
  hasPlanningItems: boolean;
  metricoolPostsCount: number;
  hasRadarSources: boolean;
}): { items: SetupItem[]; pct: number } {
  return useMemo(() => {
    const items: SetupItem[] = [
      { key: "workspace", label: "Workspace criado", done: true },
      {
        key: "client",
        label: "Cadastrar primeiro cliente",
        done: opts.hasClients,
        cta: { label: "Cadastrar", tab: "clients" },
      },
      {
        key: "metricool",
        label: "Conectar Metricool (importar posts)",
        done: opts.metricoolPostsCount > 0,
        cta: { label: "Configurar", tab: "settings" },
      },
      {
        key: "planning",
        label: "Criar primeiro post no planejamento",
        done: opts.hasPlanningItems,
        cta: { label: "Planejamento", tab: "planning" },
      },
      {
        key: "radar",
        label: "Cadastrar fontes do Radar Viral",
        done: opts.hasRadarSources,
        cta: { label: "Configurar", tab: "settings" },
      },
    ];
    const completed = items.filter((i) => i.done).length;
    const pct = Math.round((completed / items.length) * 100);
    return { items, pct };
  }, [
    opts.hasClients,
    opts.hasPlanningItems,
    opts.metricoolPostsCount,
    opts.hasRadarSources,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function HomeDashboard({
  onNavigate,
  onOpenItem,
  onSelectClient,
}: HomeDashboardProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { workspace, subscription } = useWorkspaceContext();
  const { clients, isLoading: isLoadingClients } = useClients();
  const workspaceId = workspace?.id;
  const hasClients = (clients?.length ?? 0) > 0;

  // ── Stats agregadas (hero) ──
  const { data: stats, isLoading: isLoadingStats } = useDashboardStats();
  // ── Performance snapshot por cliente ──
  const { cards: clientCards, isLoading: isLoadingCards } =
    useDashboardClientCards();
  // ── Top performers ──
  const { data: topPosts, isLoading: isLoadingTop } = useDashboardTopPosts(6);
  // ── Próximos posts ──
  const { data: upcomingPosts, isLoading: isLoadingUpcoming } =
    useDashboardUpcoming(6);
  // ── Tasks pessoais ──
  const { data: myTasks = [] } = useMyTeamTasks(7);
  // ── Inbox (sample do 1º cliente) ──
  const { data: inboxUnread = 0 } = useInboxUnreadCount(clients?.[0]?.id ?? null);

  // ── Profile pra saudação ──
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

  const userName = useMemo(() => {
    const full =
      userProfile?.full_name ||
      user?.user_metadata?.full_name ||
      user?.email?.split("@")[0] ||
      "";
    return full.split(" ")[0]; // primeiro nome só
  }, [userProfile, user]);

  // ── Radar setup proxy: usa contagem de viral_radar_briefs (cliente recebeu
  //    pelo menos 1 brief) como sinal de que o radar está configurado.
  //    `radar_sources` real é gerenciada via Settings → Radar Sources, mas
  //    aqui só queremos saber se o user já interagiu com o sistema. ──
  const { data: radarBriefsCount = 0 } = useQuery({
    queryKey: ["dashboard-radar-briefs-count", workspaceId],
    queryFn: async () => {
      const clientIds = (clients ?? []).map((c) => c.id);
      if (clientIds.length === 0) return 0;
      const { count } = await supabase
        .from("viral_radar_briefs")
        .select("id", { count: "exact", head: true })
        .in("client_id", clientIds);
      return count ?? 0;
    },
    enabled: !!workspaceId && (clients?.length ?? 0) > 0,
    staleTime: 5 * 60_000,
  });

  // Setup checklist
  const { items: setupItems, pct: setupPct } = useSetupChecklist({
    hasClients,
    hasPlanningItems: (stats?.totalPlanningItems ?? 0) > 0,
    metricoolPostsCount: stats?.metricoolPostsLast30d ?? 0,
    hasRadarSources: radarBriefsCount > 0,
  });

  // Pendências breakdown
  const tasksDue = myTasks.filter((t) => {
    if (!t.due_date) return false;
    const d = parseISO(t.due_date);
    return (isPast(d) || isToday(d)) && t.status !== "done";
  }).length;

  const planLabel = subscription?.plan?.name ?? null;
  const now = new Date();

  // ── Render ──
  return (
    <div className={cn("h-full overflow-y-auto", isMobile ? "p-3" : "p-6 lg:p-8")}>
      <div className="max-w-[1400px] mx-auto space-y-6 md:space-y-8">
        {/* ─── HERO ─── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
          aria-labelledby="dashboard-hero-title"
        >
          {/* Top bar: workspace label + plan + sino */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="kai-eyebrow">{workspace?.name ?? "Cockpit"}</span>
              {planLabel && (
                <Badge
                  variant="outline"
                  className="text-[10px] h-5 px-2 capitalize border-primary/30 text-primary/80 bg-primary/5"
                >
                  {planLabel}
                </Badge>
              )}
            </div>
            <NotificationsBell onNavigate={onNavigate} />
          </div>

          {/* Greeting */}
          <div>
            <h1
              id="dashboard-hero-title"
              className="text-2xl md:text-4xl font-light text-foreground tracking-tight"
            >
              {getTimeGreeting()}
              {userName ? `, ${userName}` : ""}{" "}
              <span className="inline-block animate-pulse text-primary">✦</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}
              {!isLoadingStats && stats && hasClients && (
                <>
                  {" · "}
                  <span className="text-foreground/70">
                    {stats.itemsPublishedLast30d} posts publicados nos últimos
                    30 dias
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Hero stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                key: "clients",
                label: "Clientes",
                value: stats?.totalClients ?? 0,
                hint: stats
                  ? `${stats.activeClients30d} ativos (30d)`
                  : "—",
                icon: Users,
                accent: "text-primary",
                onClick: () => onNavigate("clients"),
              },
              {
                key: "scheduled",
                label: "Agendados (7d)",
                value: stats?.itemsScheduledNext7d ?? 0,
                hint: "Próxima semana",
                icon: CalendarDays,
                accent: "text-orange-500",
                onClick: () => onNavigate("planning"),
              },
              {
                key: "published",
                label: "Publicados (30d)",
                value: stats?.itemsPublishedLast30d ?? 0,
                hint:
                  stats && stats.metricoolPostsLast30d > 0
                    ? `${stats.metricoolPostsLast30d} no Metricool`
                    : "Pipeline + redes",
                icon: Send,
                accent: "text-emerald-500",
                onClick: () => onNavigate("planning"),
              },
              {
                key: "followers",
                label: "Seguidores",
                value:
                  stats?.totalFollowersLatest != null
                    ? formatNumber(stats.totalFollowersLatest)
                    : "—",
                hint: "Cross-network",
                icon: TrendingUp,
                accent: "text-fuchsia-500",
                onClick: () => {
                  if (clients?.[0]) {
                    onSelectClient?.(clients[0].id, "performance");
                  }
                },
              },
            ].map((card) => (
              <Card
                key={card.key}
                role="button"
                tabIndex={0}
                aria-label={`${card.label}: ${card.value}`}
                onClick={card.onClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    card.onClick();
                  }
                }}
                className="cursor-pointer transition-all duration-200 hover:border-border/80 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {card.label}
                    </span>
                    <card.icon className={cn("h-4 w-4", card.accent)} />
                  </div>
                  {isLoadingStats ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl md:text-3xl font-semibold tabular-nums text-foreground">
                      {card.value}
                    </p>
                  )}
                  <p className="text-[10.5px] text-muted-foreground/70 mt-1.5 line-clamp-1">
                    {card.hint}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        {/* ─── QUICK ACTIONS ─── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          aria-labelledby="dashboard-quick-actions-title"
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-primary" />
            <h2
              id="dashboard-quick-actions-title"
              className="text-sm font-semibold uppercase tracking-wider text-foreground/90"
            >
              Ações rápidas
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {!hasClients ? (
              <QuickActionCard
                icon={Users}
                label="Cadastrar cliente"
                description="Comece por aqui — destrava todas as ferramentas"
                accent="bg-primary/15 text-primary"
                primary
                onClick={() => onNavigate("clients")}
              />
            ) : (
              <>
                <QuickActionCard
                  icon={Sparkles}
                  label="Carrossel viral"
                  description="Brief curto → carrossel completo"
                  accent="bg-primary/10 text-primary"
                  onClick={() => onNavigate("viral-carrossel")}
                />
                <QuickActionCard
                  icon={Film}
                  label="Roteiro de Reels"
                  description="Cole um link → engenharia reversa"
                  accent="bg-purple-500/10 text-purple-400"
                  onClick={() => onNavigate("viral-reels-page")}
                />
                <QuickActionCard
                  icon={RadarIcon}
                  label="Radar viral"
                  description="Briefing diário de tendências"
                  accent="bg-orange-500/10 text-orange-400"
                  onClick={() => onNavigate("viral-radar-page")}
                />
                <QuickActionCard
                  icon={LineChart}
                  label="Performance"
                  description="Métricas detalhadas por canal"
                  accent="bg-emerald-500/10 text-emerald-500"
                  onClick={() => {
                    if (clients?.[0]) {
                      onSelectClient?.(clients[0].id, "performance");
                    }
                  }}
                />
              </>
            )}
          </div>
        </motion.section>

        {/* ─── PENDÊNCIAS (consolidadas, em card largo) ─── */}
        {hasClients && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  Pendências
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <PendencyTile
                    icon={MessageSquare}
                    label="Mensagens"
                    count={inboxUnread}
                    hint={
                      inboxUnread > 0
                        ? `Não respondidas em ${clients?.[0]?.name ?? "inbox"}`
                        : "Inbox em dia"
                    }
                    tone="info"
                    onClick={() => onNavigate("inbox")}
                  />
                  <PendencyTile
                    icon={Eye}
                    label="Aguardando revisão"
                    count={
                      stats &&
                      stats.totalPlanningItems > 0
                        ? // Conta drafts em revisão usando o totalPlanningItems é
                          // grosseiro — buscamos exato via NotificationsBell.
                          // Aqui só sinalizamos se tem pipeline.
                          0
                        : 0
                    }
                    hint="Drafts esperando aprovação"
                    tone="warning"
                    onClick={() => onNavigate("planning")}
                    fallback="Veja no Planning"
                  />
                  <PendencyTile
                    icon={Clock}
                    label="Hoje no calendário"
                    count={stats?.itemsScheduledNext7d ?? 0}
                    hint={
                      stats?.itemsScheduledNext7d
                        ? "Posts agendados próximos 7d"
                        : "Sem agendamentos"
                    }
                    tone="info"
                    onClick={() => onNavigate("planning")}
                  />
                  <PendencyTile
                    icon={CheckSquare}
                    label="Tarefas vencidas"
                    count={tasksDue}
                    hint={
                      tasksDue > 0
                        ? "Tarefas suas pra hoje ou atrasadas"
                        : "Tudo em dia"
                    }
                    tone={tasksDue > 0 ? "danger" : "neutral"}
                    onClick={() => onNavigate("tasks")}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.section>
        )}

        {/* ─── PERFORMANCE SNAPSHOT (cards por cliente) ─── */}
        {hasClients && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            aria-labelledby="dashboard-perf-title"
          >
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4 text-primary" />
                <h2
                  id="dashboard-perf-title"
                  className="text-sm font-semibold uppercase tracking-wider text-foreground/90"
                >
                  Performance por cliente
                </h2>
                <Badge variant="outline" className="text-[10px] h-5">
                  últimos 7 dias
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  if (clients?.[0]) {
                    onSelectClient?.(clients[0].id, "performance");
                  }
                }}
              >
                Ver detalhado <ArrowRight className="h-3 w-3" />
              </Button>
            </div>

            {isLoadingCards ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 rounded-xl" />
                ))}
              </div>
            ) : clientCards.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum cliente com dados ainda. Conecte Metricool ou aguarde o
                  primeiro snapshot diário.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {clientCards.map((card) => (
                  <ClientPerformanceCard
                    key={card.clientId}
                    data={card}
                    onClick={() =>
                      onSelectClient?.(card.clientId, "performance")
                    }
                  />
                ))}
              </div>
            )}
          </motion.section>
        )}

        {/* ─── TOP PERFORMERS + UPCOMING ─── */}
        {hasClients && (
          <div
            className={cn(
              "grid gap-5",
              isMobile ? "grid-cols-1" : "grid-cols-12",
            )}
          >
            {/* Top performers (carousel) */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={cn(isMobile ? "" : "col-span-8")}
              aria-labelledby="dashboard-top-title"
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    <span id="dashboard-top-title">
                      Top conteúdos (30d)
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5 ml-1">
                      por engajamento
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingTop ? (
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton
                          key={i}
                          className="shrink-0 w-[260px] sm:w-[280px] h-[290px] rounded-xl"
                        />
                      ))}
                    </div>
                  ) : !topPosts || topPosts.length === 0 ? (
                    <div className="py-10 text-center">
                      <Sparkles className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum post nos últimos 30 dias.
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        Conecte Metricool ou agende publicações pra ver ranking.
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin -mx-1 px-1">
                      {topPosts.map((post) => (
                        <TopPerformerCard
                          key={`${post.network}-${post.postId}`}
                          post={post}
                          onClick={() => {
                            if (post.url) window.open(post.url, "_blank");
                            else
                              onSelectClient?.(post.clientId, "performance");
                          }}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.section>

            {/* Upcoming posts */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className={cn(isMobile ? "" : "col-span-4")}
              aria-labelledby="dashboard-upcoming-title"
            >
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span id="dashboard-upcoming-title">Próximos posts</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {isLoadingUpcoming ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 rounded-md" />
                      ))}
                    </div>
                  ) : !upcomingPosts || upcomingPosts.length === 0 ? (
                    <div className="py-8 text-center">
                      <Clock className="h-7 w-7 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">
                        Nenhum post agendado próximos 14 dias.
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs mt-1 h-auto p-0"
                        onClick={() => onNavigate("planning")}
                      >
                        Agendar agora →
                      </Button>
                    </div>
                  ) : (
                    upcomingPosts.map((p) => {
                      const branding = getNetworkBranding(p.platform);
                      const NetIcon = branding.icon;
                      const clientName =
                        clients?.find((c) => c.id === p.clientId)?.name ??
                        "—";
                      const date = p.scheduledAt
                        ? new Date(p.scheduledAt)
                        : null;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onOpenItem?.(p.id)}
                          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent/40 transition-colors text-left"
                        >
                          <div
                            className={cn(
                              "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                              branding.bgGradient,
                            )}
                          >
                            <NetIcon
                              className={cn(
                                "h-3.5 w-3.5",
                                branding.iconOnBgClass,
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {p.title || "Sem título"}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {clientName}
                              {date && (
                                <>
                                  {" · "}
                                  {format(date, "EEE, dd/MM HH:mm", {
                                    locale: ptBR,
                                  })}
                                </>
                              )}
                            </p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        </button>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </motion.section>
          </div>
        )}

        {/* ─── ATIVIDADE RECENTE ─── */}
        {hasClients && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <RecentActivity />
          </motion.section>
        )}

        {/* ─── SETUP CHECKLIST (só se incompleto) ─── */}
        {setupPct < 100 && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/[0.05] via-background to-transparent">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
              <CardHeader className="pb-3 relative">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Configure o KAI
                  <Badge
                    variant="outline"
                    className="ml-auto text-[10px] h-5 border-primary/30 text-primary bg-primary/5"
                  >
                    {setupPct}% completo
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 relative">
                {setupItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 py-1.5"
                  >
                    <div
                      className={cn(
                        "h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-colors",
                        item.done
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-muted/50 text-muted-foreground/50",
                      )}
                    >
                      {item.done ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-current" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm flex-1",
                        item.done
                          ? "text-muted-foreground line-through"
                          : "text-foreground",
                      )}
                    >
                      {item.label}
                    </span>
                    {!item.done && item.cta && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
                        onClick={() => onNavigate(item.cta!.tab)}
                      >
                        {item.cta.label}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.section>
        )}

        {/* ─── EMPTY STATE GLOBAL — sem clientes ─── */}
        {!isLoadingClients && !hasClients && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="text-base font-semibold mb-1">
                  Nenhum cliente cadastrado ainda
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  Comece criando seu primeiro cliente — assim destrava todas
                  as ferramentas (carrossel, reels, radar, performance).
                </p>
                <Button onClick={() => onNavigate("clients")} className="gap-2">
                  <Users className="h-4 w-4" />
                  Cadastrar primeiro cliente
                </Button>
              </CardContent>
            </Card>
          </motion.section>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pendency Tile (helper)
// ─────────────────────────────────────────────────────────────────────────────

interface PendencyTileProps {
  icon: React.ElementType;
  label: string;
  count: number;
  hint: string;
  tone: "danger" | "warning" | "info" | "neutral";
  onClick: () => void;
  fallback?: string;
}

function PendencyTile({
  icon: Icon,
  label,
  count,
  hint,
  tone,
  onClick,
  fallback,
}: PendencyTileProps) {
  const toneClasses: Record<PendencyTileProps["tone"], string> = {
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-amber-500/10 text-amber-500",
    info: "bg-primary/10 text-primary",
    neutral: "bg-muted/40 text-muted-foreground",
  };
  const showCount = count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-card/40 hover:bg-accent/40 hover:border-border/80 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div
        className={cn(
          "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
          toneClasses[tone],
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {showCount ? (
            <>
              <span className="text-2xl font-semibold tabular-nums leading-none text-foreground">
                {count}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {label}
              </span>
            </>
          ) : (
            <span className="text-sm font-medium text-foreground/80 truncate">
              {fallback ?? label}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
          {hint}
        </p>
      </div>
    </button>
  );
}
