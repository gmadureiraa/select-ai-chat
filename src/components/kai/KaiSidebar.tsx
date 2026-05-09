import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  Film,
  Terminal,
  CheckSquare,
  Radar,
  Users,
  MessagesSquare,
  Hash,
  Target,
  Link2,
  FileText,
  Calendar,
} from "lucide-react";
import { useDevAccess } from "@/hooks/useDevAccess";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
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
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { useQuery } from "@tanstack/react-query";

import { toast } from "sonner";
import { NotificationBell } from "@/components/notifications/NotificationBell";

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
            className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none"
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
              className="ml-auto min-w-[18px] h-4 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none"
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
  const { slug } = useParams<{ slug: string }>();
  const { clients } = useClients();
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
  const { isSuperAdmin } = useSuperAdmin();
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
        "h-screen bg-sidebar flex flex-col transition-all duration-200",
        !isMobile && "border-r border-sidebar-border",
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

      {/* Navigation */}
      <nav
        aria-label="Navegação principal do workspace"
        className="flex-1 px-2 space-y-1 overflow-y-auto scrollbar-hide"
      >
        {/* Home Dashboard */}
        <NavItem
          icon={<Home className="h-4 w-4" strokeWidth={1.5} />}
          label="Início"
          active={activeTab === "home"}
          onClick={() => onTabChange("home")}
          collapsed={collapsed}
        />

        {/* kAI Chat - Bloqueado para Viewers */}
        <NavItem
          icon={<MessageSquare className="h-4 w-4" strokeWidth={1.5} />}
          label="kAI Chat"
          active={activeTab === "assistant"}
          onClick={() => canUseAssistant ? onTabChange("assistant") : showPermissionMessage()}
          collapsed={collapsed}
          disabled={!canUseAssistant}
          showLock={!canUseAssistant}
        />

        {/* Planning - Viewers podem ver (read-only) */}
        <NavItem
          icon={<CalendarDays className="h-4 w-4" strokeWidth={1.5} />}
          label="Planejamento"
          active={activeTab === "planning"}
          onClick={() => onTabChange("planning")}
          collapsed={collapsed}
        />

        {/* Tarefas internas do time — separado do planejamento de conteúdo */}
        <NavItem
          icon={<CheckSquare className="h-4 w-4" strokeWidth={1.5} />}
          label="Tarefas"
          active={activeTab === "tasks"}
          onClick={() => onTabChange("tasks")}
          collapsed={collapsed}
        />


        {/* Performance - Viewers podem ver */}
        <NavItem
          icon={<BarChart3 className="h-4 w-4" strokeWidth={1.5} />}
          label="Performance"
          active={activeTab === "performance"}
          onClick={() => onTabChange("performance")}
          collapsed={collapsed}
        />

        {/* Library - Viewers podem ver */}
        <NavItem
          icon={<Library className="h-4 w-4" strokeWidth={1.5} />}
          label="Biblioteca"
          active={activeTab === "library"}
          onClick={() => onTabChange("library")}
          collapsed={collapsed}
        />

        {/* Grupo "Viral" — quick wins Fase 1 do combo-viral-integration.
            Itens GLOBAIS (não dependem de cliente): biblioteca + atalhos pros
            apps standalone (Sequência Viral, Reels Viral, Radar Viral). */}
        {!collapsed && (
          <div className="px-3 mt-3 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
              Viral
            </span>
          </div>
        )}

        {/* Biblioteca Viral removida 2026-05-08 — unificada com biblioteca
            normal por cliente (client_reference_library). */}

        <NavItem
          icon={<Twitter className="h-4 w-4" strokeWidth={1.5} />}
          label="Carrossel"
          active={activeTab === "viral-carrossel"}
          onClick={() => onTabChange("viral-carrossel")}
          collapsed={collapsed}
        />

        <NavItem
          icon={<Film className="h-4 w-4" strokeWidth={1.5} />}
          label="Reels"
          active={activeTab === "viral-reels-page"}
          onClick={() => onTabChange("viral-reels-page")}
          collapsed={collapsed}
        />

        <NavItem
          icon={<Radar className="h-4 w-4" strokeWidth={1.5} />}
          label="Radar"
          active={activeTab === "viral-radar-page"}
          onClick={() => onTabChange("viral-radar-page")}
          collapsed={collapsed}
        />

        {/* 2026-05-08 (replace-viral): grupo "Cliente" duplicado removido.
            As 3 ferramentas viral (Sequência/Reels/Radar) agora vivem só no
            grupo "Viral" acima, apontando pros mesmos componentes que eram
            duplicados aqui. O item "Viral Hunter" (KAI-1.0 legacy) foi
            descontinuado — seu conteúdo de descoberta (posts próprios,
            concorrentes, YT, IG, news, trends, ideas) foi absorvido pelo
            Radar Viral + Library. Backup em _legacy/viral-replaced-2026-05-08/. */}

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


        {/* Profiles - Bloqueado para Viewers */}
        {canViewClients && (
          <NavItem
            icon={<Building2 className="h-4 w-4" strokeWidth={1.5} />}
            label="Perfis"
            active={activeTab === "clients"}
            onClick={() => isViewer ? showPermissionMessage() : onTabChange("clients")}
            collapsed={collapsed}
            disabled={isViewer}
            showLock={isViewer}
          />
        )}

        {/* Workspace — settings (owner) + members (admin/owner) */}
        {(isOwner || canManageTeam) && (
          <>
            {!collapsed && (
              <div className="px-3 mt-3 mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                  Workspace
                </span>
              </div>
            )}
            {isOwner && (
              <NavItem
                icon={<Settings className="h-4 w-4" strokeWidth={1.5} />}
                label="Configurações"
                active={activeTab === "workspace-settings"}
                onClick={() => onTabChange("workspace-settings")}
                collapsed={collapsed}
              />
            )}
            {canManageTeam && (
              <NavItem
                icon={<Users className="h-4 w-4" strokeWidth={1.5} />}
                label="Membros"
                active={activeTab === "workspace-members"}
                onClick={() => onTabChange("workspace-members")}
                collapsed={collapsed}
              />
            )}
            {/* Inbox unificado Metricool — DMs/Comments/Reviews todas plataformas */}
            <NavItem
              icon={<MessagesSquare className="h-4 w-4" strokeWidth={1.5} />}
              label="Inbox"
              active={activeTab === "inbox"}
              onClick={() => onTabChange("inbox")}
              collapsed={collapsed}
              badge={inboxUnread}
            />
            {/* Hashtags Tracker Metricool */}
            <NavItem
              icon={<Hash className="h-4 w-4" strokeWidth={1.5} />}
              label="Hashtags"
              active={activeTab === "hashtags"}
              onClick={() => onTabChange("hashtags")}
              collapsed={collapsed}
            />
            {/* Competitors Metricool */}
            <NavItem
              icon={<Target className="h-4 w-4" strokeWidth={1.5} />}
              label="Concorrentes"
              active={activeTab === "competitors"}
              onClick={() => onTabChange("competitors")}
              collapsed={collapsed}
            />
            {/* Reports Metricool — Performance Dashboards + PDFs */}
            <NavItem
              icon={<FileText className="h-4 w-4" strokeWidth={1.5} />}
              label="Relatórios"
              active={activeTab === "reports"}
              onClick={() => onTabChange("reports")}
              collapsed={collapsed}
            />
            {/* REMOVIDOS DO MENU (decisão usuário 2026-05-09):
                - Smart Links: código em MetricoolSmartLinksManager.tsx, sem rota
                - Calendário Editorial: virou sub-tab dentro de Planejamento
                - Linkin Bio: código em MetricoolLinkinBioEditor.tsx, sem rota
                - Plano/cobrança: KAI 2.0 é uso interno Kaleidos */}
          </>
        )}

        {/* Admin — só super_admin enxerga */}
        {isSuperAdmin && (
          <>
            {!collapsed && (
              <div className="px-3 mt-3 mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                  Admin
                </span>
              </div>
            )}
            <NavItem
              icon={<Radar className="h-4 w-4" strokeWidth={1.5} />}
              label="Fontes Radar"
              active={activeTab === "radar-sources-admin"}
              onClick={() => onTabChange("radar-sources-admin")}
              collapsed={collapsed}
            />
          </>
        )}
      </nav>

      {/* Footer */}
      <div className={cn("p-2 space-y-0.5 border-t border-sidebar-border", collapsed && "p-1.5")}>
        {/* MCP Docs */}
        <NavItem
          icon={<Terminal className="h-4 w-4" strokeWidth={1.5} />}
          label="MCP kAI"
          active={activeTab === "mcp"}
          onClick={() => onTabChange("mcp")}
          collapsed={collapsed}
        />

        {/* Settings */}
        {canViewSettings && (
          <NavItem
            icon={<Settings className="h-4 w-4" strokeWidth={1.5} />}
            label="Configurações"
            active={activeTab === "settings"}
            onClick={() => onTabChange("settings")}
            collapsed={collapsed}
          />
        )}

        {/* Notifications */}
        <NotificationBell variant="sidebar" collapsed={collapsed} />

        {/* Theme toggle */}
        <div
          className={cn(
            "flex items-center gap-3 px-3 h-9 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors",
            collapsed && "justify-center px-2",
          )}
        >
          <ThemeToggle className="h-7 w-7 -ml-1.5" />
          {!collapsed && <span className="text-sm">Tema</span>}
        </div>

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
