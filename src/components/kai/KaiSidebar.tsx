import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  Plus,
  Library,
  Settings,
  Zap,
  Lock,
  MessageSquare,
  Home,
  Twitter,
  CheckSquare,
  MessagesSquare,
} from "lucide-react";
import { useDevAccess } from "@/hooks/useDevAccess";
import { cn } from "@/lib/utils";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useInboxUnreadCount } from "@/hooks/useMetricoolInbox";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { useQuery } from "@tanstack/react-query";

import { toast } from "sonner";
// 2026-05-09 — NotificationBell removida da sidebar desktop. Continua viva
// no MobileHeader (mobile sempre mostra). Preferências de notificação foram
// pra Settings → Notificações; histórico de notif fica no Bell mobile.

/**
 * Cabeçalho de seção da sidebar — agrupador visual não-clicável.
 * Some quando a sidebar está collapsed pra evitar texto cortado.
 */
function SidebarSectionHeader({ title, collapsed }: { title: string; collapsed: boolean }) {
  if (collapsed) {
    // Mantém um espacinho visual entre grupos mesmo collapsed.
    return <div className="h-2" aria-hidden="true" />;
  }
  return (
    <div className="px-3 mt-3 mb-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
        {title}
      </span>
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  collapsed?: boolean;
  disabled?: boolean;
  showLock?: boolean;
  /** Badge numérico (ex: não-lidas no Inbox). Mostra "9+" se > 9. */
  badge?: number;
}

function NavItem({ icon, label, active, onClick, collapsed, disabled, showLock, badge }: NavItemProps) {
  const badgeText =
    typeof badge === "number" && badge > 0
      ? badge > 9
        ? "9+"
        : String(badge)
      : null;

  const content = (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      className={cn(
        "w-full flex items-center gap-3 px-3 h-9 rounded-md text-sm transition-colors relative",
        active
          ? "bg-accent text-foreground font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        collapsed && "justify-center px-2",
        disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
      )}
    >
      <span className="flex-shrink-0 relative">
        {icon}
        {badgeText && collapsed && (
          <span
            aria-label={`${badge} não lidas`}
            className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center leading-none"
          >
            {badgeText}
          </span>
        )}
      </span>
      {!collapsed && (
        <span className="flex-1 text-left truncate flex items-center gap-2">
          {label}
          {showLock && <Lock className="h-3 w-3 text-muted-foreground/60 shrink-0" />}
          {badgeText && (
            <span
              aria-label={`${badge} não lidas`}
              className="ml-auto min-w-[18px] h-4 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none"
            >
              {badgeText}
            </span>
          )}
        </span>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="right">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

interface KaiSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  selectedClientId: string | null;
  onClientChange: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobile?: boolean;
}

export function KaiSidebar({ 
  activeTab, 
  onTabChange, 
  selectedClientId, 
  onClientChange,
  collapsed,
  onToggleCollapse,
  isMobile = false
}: KaiSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { clients } = useClients();
  // 2026-05-10 — `Perfis` agora navega pra rota dedicada `/kaleidos/clients`.
  // Highlight ativo precisa olhar o pathname além do tab (porque a rota dedicada
  // não tem ?tab=clients). Active quando o user está na rota OU vem de bookmark
  // antigo `?tab=clients` (ainda em redirect).
  const isOnClientsRoute = location.pathname.startsWith("/kaleidos/clients");
  const {
    canViewPerformance,
    canViewClients,
    canViewSettings,
    canViewPlanning,
    canViewLibrary,
    isViewer,
    canUseAssistant,
    canManageTeam,
    isOwner,
    workspace
  } = useWorkspace();
  
  const { user } = useAuth();
  
  const { hasDevAccess } = useDevAccess();
  const selectedClient = clients?.find(c => c.id === selectedClientId);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const hasClients = clients && clients.length > 0;
  
  const currentSlug = slug || (workspace as { slug?: string })?.slug || "";

  // Fetch user profile
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "U";
  const userName = userProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";

  // Contagem de não-lidas no Inbox — usado como badge no NavItem.
  // Hook com polling 60s próprio. Só roda quando tem cliente selecionado.
  const { data: inboxUnread = 0 } = useInboxUnreadCount(selectedClientId);

  // Handler para mostrar mensagem de permissão
  const showPermissionMessage = () => {
    toast.info("Você não tem permissão para esta área.");
  };

  return (
    <aside
      aria-label="Barra lateral KAI"
      className={cn(
        // 2026-05-16 — audit Mob-2: em mobile o Sheet já dá altura, double
        // h-screen causava 2 scrollbars. Em desktop, h-dvh evita salto iOS.
        "bg-sidebar flex flex-col transition-all duration-200",
        isMobile ? "h-full" : "h-dvh border-r border-sidebar-border",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Workspace */}
      <div className="p-3">
        <WorkspaceSwitcher collapsed={collapsed} />
        {!collapsed && (
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground/70 px-1">
            <span>Busca rápida</span>
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted/50 font-mono text-[9px] tracking-wider">
              ⌘K
            </kbd>
          </div>
        )}
      </div>

      {/* Profile Selector */}
      <div className={cn("px-3 pb-4", collapsed && "px-2")}>
        {!hasClients ? (
          <button
            onClick={() => {
              if (isViewer) {
                showPermissionMessage();
              } else {
                setShowClientDialog(true);
              }
            }}
            className={cn(
              "w-full flex items-center gap-2 rounded-md transition-colors",
              "border border-dashed border-border hover:border-primary hover:bg-accent",
              collapsed ? "p-2 justify-center" : "px-3 py-2"
            )}
          >
            <Plus className={cn("text-muted-foreground", collapsed ? "h-5 w-5" : "h-4 w-4")} />
            {!collapsed && (
              <span className="flex-1 text-left text-sm text-muted-foreground">
                Adicionar perfil
              </span>
            )}
          </button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "w-full flex items-center gap-2 rounded-md transition-colors",
                "bg-accent hover:bg-accent/80",
                collapsed ? "p-2 justify-center" : "px-3 py-2"
              )}>
                {selectedClient?.avatar_url ? (
                  <Avatar className={cn("rounded-md", collapsed ? "w-5 h-5" : "w-6 h-6")}>
                    <AvatarImage src={selectedClient.avatar_url} alt={selectedClient.name} />
                    <AvatarFallback className="rounded-md bg-primary/10 text-primary text-[10px] font-medium">
                      {selectedClient.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className={cn(
                    "rounded-md bg-primary/10 flex items-center justify-center text-primary text-[10px] font-medium",
                    collapsed ? "w-5 h-5" : "w-6 h-6"
                  )}>
                    {selectedClient?.name?.charAt(0) || "?"}
                  </div>
                )}
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left text-sm font-medium truncate">
                      {selectedClient?.name || "Selecionar"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {clients?.map((client) => (
                <DropdownMenuItem
                  key={client.id}
                  onClick={() => onClientChange(client.id)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    selectedClientId === client.id && "bg-accent"
                  )}
                >
                  {client.avatar_url ? (
                    <Avatar className="w-5 h-5 rounded-md">
                      <AvatarImage src={client.avatar_url} alt={client.name} />
                      <AvatarFallback className="rounded-md bg-primary/10 text-[9px] font-medium text-primary">
                        {client.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-medium text-primary">
                      {client.name.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm">{client.name}</span>
                </DropdownMenuItem>
              ))}
              
              {!isViewer && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowClientDialog(true)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm">Adicionar perfil</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <ClientDialog open={showClientDialog} onOpenChange={setShowClientDialog} />

      {/* Navigation — reorganizada em 5 seções (2026-05-09):
          DASHBOARD · OPERAÇÃO · ENGAJAMENTO · ANÁLISE · CONFIG · ADMIN.
          Eliminados duplicados: ThemeToggle do footer (já vive em Settings →
          Aparência) e "Configurações" do Workspace renomeada pra "Workspace"
          (a "Configurações" do footer é a global da conta). */}
      <nav
        aria-label="Navegação principal do workspace"
        className="flex-1 px-2 space-y-1 overflow-y-auto scrollbar-hide"
      >
        {isViewer ? (
          <>
            <SidebarSectionHeader title="Revisão" collapsed={collapsed} />
            <NavItem
              icon={<CalendarDays className="h-4 w-4" strokeWidth={1.5} />}
              label="Planejamento"
              active={activeTab === "planning"}
              onClick={() => onTabChange("planning")}
              collapsed={collapsed}
            />
          </>
        ) : (
          <>
        {/* ===== DASHBOARD ===== */}
        <NavItem
          icon={<Home className="h-4 w-4" strokeWidth={1.5} />}
          label="Início"
          active={activeTab === "home"}
          onClick={() => onTabChange("home")}
          collapsed={collapsed}
        />

        {/* ===== OPERAÇÃO — criar, planejar, agendar ===== */}
        <SidebarSectionHeader title="Operação" collapsed={collapsed} />

        <NavItem
          icon={<MessageSquare className="h-4 w-4" strokeWidth={1.5} />}
          label="kAI Chat"
          active={activeTab === "assistant"}
          onClick={() => canUseAssistant ? onTabChange("assistant") : showPermissionMessage()}
          collapsed={collapsed}
          disabled={!canUseAssistant}
          showLock={!canUseAssistant}
        />

        <NavItem
          icon={<CalendarDays className="h-4 w-4" strokeWidth={1.5} />}
          label="Planejamento"
          active={activeTab === "planning"}
          onClick={() => onTabChange("planning")}
          collapsed={collapsed}
        />

        <NavItem
          icon={<CheckSquare className="h-4 w-4" strokeWidth={1.5} />}
          label="Tarefas"
          active={activeTab === "tasks"}
          onClick={() => onTabChange("tasks")}
          collapsed={collapsed}
        />

        <NavItem
          icon={<Library className="h-4 w-4" strokeWidth={1.5} />}
          label="Biblioteca"
          active={activeTab === "library"}
          onClick={() => onTabChange("library")}
          collapsed={collapsed}
        />

        {/* Geradores virais — globais, não dependem de cliente. */}
        <NavItem
          icon={<Twitter className="h-4 w-4" strokeWidth={1.5} />}
          label="Carrossel"
          active={activeTab === "viral-carrossel"}
          onClick={() => onTabChange("viral-carrossel")}
          collapsed={collapsed}
        />

        {/* 2026-05-16 — Reels e Radar removidos do KAI; vivem como apps
            standalone em reels.kaleidos.com.br e radar.kaleidos.com.br. */}

        {/* Automações - Dev e admins do workspace */}
        {(hasDevAccess || canManageTeam) && (
          <NavItem
            icon={<Zap className="h-4 w-4" strokeWidth={1.5} />}
            label="Automações"
            active={activeTab === "automations"}
            onClick={() => onTabChange("automations")}
            collapsed={collapsed}
          />
        )}

        {/* ===== ENGAJAMENTO — DMs, comments, mentions ===== */}
        {(isOwner || canManageTeam) && (
          <>
            <SidebarSectionHeader title="Engajamento" collapsed={collapsed} />
            <NavItem
              icon={<MessagesSquare className="h-4 w-4" strokeWidth={1.5} />}
              label="Inbox"
              active={activeTab === "inbox"}
              onClick={() => onTabChange("inbox")}
              collapsed={collapsed}
              badge={inboxUnread}
            />
          </>
        )}

        {/* ===== ANÁLISE — só performance global agora.
            Hashtags/Concorrentes/Relatórios viraram per-client (Perfil → Viral
            → Hashtags/Concorrentes/Relatórios) — decisão UX 2026-05-09. */}
        <SidebarSectionHeader title="Análise" collapsed={collapsed} />

        <NavItem
          icon={<BarChart3 className="h-4 w-4" strokeWidth={1.5} />}
          label="Performance"
          active={activeTab === "performance"}
          onClick={() => onTabChange("performance")}
          collapsed={collapsed}
        />

        {/* ===== CONFIG — apenas Perfis aqui.
            Workspace/Membros/Fontes do Radar foram movidos pra
            Configurações (footer) — decisão UX 2026-05-09. */}
        {canViewClients && (
          <>
            <SidebarSectionHeader title="Config" collapsed={collapsed} />
            <NavItem
              icon={<Building2 className="h-4 w-4" strokeWidth={1.5} />}
              label="Perfis"
              active={isOnClientsRoute || activeTab === "clients"}
              onClick={() => {
                if (isViewer) {
                  showPermissionMessage();
                  return;
                }
                // Rota dedicada (2026-05-10): preserva o cliente selecionado
                // via query string pra continuidade visual quando voltar.
                const target = selectedClientId
                  ? `/kaleidos/clients?client=${encodeURIComponent(selectedClientId)}`
                  : "/kaleidos/clients";
                navigate(target);
              }}
              collapsed={collapsed}
              disabled={isViewer}
              showLock={isViewer}
            />
          </>
        )}
          </>
        )}
      </nav>

      {/* Footer — utilities globais.
          Reorg 2026-05-09:
            - "MCP kAI" virou Settings → Sistema → MCP kAI (workspace-wide).
            - NotificationBell saiu do desktop (preferências em Settings →
              Notificações; histórico continua no Bell do MobileHeader).
            - Tema removido (vivia duplicado: agora só Settings → Aparência).
          Footer agora tem só Configurações + Collapse toggle. */}
      <div className={cn("p-2 space-y-0.5 border-t border-sidebar-border", collapsed && "p-1.5")}>
        {/* Configurações pessoais — perfil, tema, notificações, segurança, AI usage, MCP */}
        {canViewSettings && (
          <NavItem
            icon={<Settings className="h-4 w-4" strokeWidth={1.5} />}
            label="Configurações"
            active={activeTab === "settings"}
            onClick={() => onTabChange("settings")}
            collapsed={collapsed}
          />
        )}

        {/* Collapse Toggle */}
        {!isMobile && (
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            aria-expanded={!collapsed}
            className={cn(
              "w-full flex items-center gap-3 px-3 h-9 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
              collapsed && "justify-center px-2",
            )}
          >
            {collapsed ? (
              <ChevronRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <>
                <ChevronLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
                <span>Recolher</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* User */}
      <div className={cn("p-2", collapsed && "p-1.5")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-2 rounded-md hover:bg-accent transition-colors p-2",
              collapsed && "justify-center p-1.5"
            )}>
              <Avatar className={cn("border border-border", collapsed ? "h-7 w-7" : "h-8 w-8")}>
                <AvatarImage src={userProfile?.avatar_url || undefined} alt={userName} />
                <AvatarFallback className="bg-accent text-foreground text-[10px] font-medium">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/login");
              }}
              className="text-destructive focus:text-destructive"
            >
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
