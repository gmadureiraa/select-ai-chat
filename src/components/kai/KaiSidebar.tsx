import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  Home, 
  MessageSquare, 
  BarChart3, 
  Library,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Activity,
  Users,
  Search,
  LogOut,
  HelpCircle,
  Building2,
  CalendarDays,
  Zap,
  FileText,
  Command
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePendingUsers } from "@/hooks/usePendingUsers";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { TokensBadge } from "@/components/TokensBadge";
import { useQuery } from "@tanstack/react-query";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
  collapsed?: boolean;
}

function NavItem({ icon, label, active, onClick, badge, collapsed }: NavItemProps) {
  const content = (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group relative",
        active 
          ? "bg-sidebar-accent text-sidebar-accent-foreground" 
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <span className={cn(
        "flex-shrink-0 transition-colors",
        active ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
      )}>
        {icon}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="flex-shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium flex items-center justify-center">
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {label}
          {badge !== undefined && badge > 0 && (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium flex items-center justify-center">
              {badge}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

interface SectionLabelProps {
  children: React.ReactNode;
  collapsed?: boolean;
}

function SectionLabel({ children, collapsed }: SectionLabelProps) {
  if (collapsed) return null;
  
  return (
    <div className="px-3 pt-5 pb-1.5">
      <span className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
        {children}
      </span>
    </div>
  );
}


interface KaiSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  selectedClientId: string | null;
  onClientChange: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function KaiSidebar({ 
  activeTab, 
  onTabChange, 
  selectedClientId, 
  onClientChange,
  collapsed,
  onToggleCollapse
}: KaiSidebarProps) {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { clients } = useClients();
  const { canManageTeam, canViewTools, canViewPerformance, canViewLibrary, canViewActivities, canViewClients, workspace } = useWorkspace();
  const { pendingCount } = usePendingUsers();
  const { user, signOut } = useAuth();
  const selectedClient = clients?.find(c => c.id === selectedClientId);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Use slug from URL params or fallback to workspace slug
  const currentSlug = slug || (workspace as { slug?: string })?.slug || "";

  // Fetch user profile for avatar
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

  const filteredClients = clients?.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "K";
  const userName = userProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";

  return (
    <aside className={cn(
      "h-screen bg-sidebar flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Workspace Switcher */}
      <div className="pt-3 pb-2 border-b border-sidebar-border">
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      {/* Search - only when expanded */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/40" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-10 h-9 bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40 text-sm focus:bg-sidebar-accent focus:border-sidebar-border"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <kbd className="h-5 px-1.5 rounded bg-sidebar-muted text-[10px] font-medium text-sidebar-foreground/50 flex items-center">
                <Command className="h-3 w-3" />
              </kbd>
              <kbd className="h-5 px-1.5 rounded bg-sidebar-muted text-[10px] font-medium text-sidebar-foreground/50">
                K
              </kbd>
            </div>
          </div>
        </div>
      )}

      {/* Client Selector */}
      <div className={cn("pt-3", collapsed ? "px-2" : "px-3")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-2.5 rounded-lg bg-primary/90 hover:bg-primary transition-colors text-primary-foreground",
              collapsed ? "p-2 justify-center" : "px-3 py-2.5"
            )}>
              {selectedClient?.avatar_url ? (
                <Avatar className={cn("rounded-md border-2 border-primary-foreground/20", collapsed ? "w-6 h-6" : "w-7 h-7")}>
                  <AvatarImage src={selectedClient.avatar_url} alt={selectedClient.name} />
                  <AvatarFallback className="rounded-md bg-primary-foreground/20 text-xs font-bold text-primary-foreground">
                    {selectedClient.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className={cn(
                  "rounded-md bg-primary-foreground/20 flex items-center justify-center text-xs font-bold text-primary-foreground",
                  collapsed ? "w-6 h-6" : "w-7 h-7"
                )}>
                  {selectedClient?.name?.charAt(0) || "K"}
                </div>
              )}
              {!collapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">
                      {selectedClient?.name || "Selecionar Cliente"}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-70 flex-shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-popover border-border shadow-lg">
            {filteredClients?.map((client) => (
              <DropdownMenuItem
                key={client.id}
                onClick={() => {
                  onClientChange(client.id);
                  setSearchQuery("");
                }}
                className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  selectedClientId === client.id && "bg-primary/10 text-primary"
                )}
              >
                {client.avatar_url ? (
                  <Avatar className="w-6 h-6 rounded">
                    <AvatarImage src={client.avatar_url} alt={client.name} />
                    <AvatarFallback className="rounded bg-gradient-to-br from-primary/80 to-secondary/80 text-[10px] font-bold text-white">
                      {client.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-primary/80 to-secondary/80 flex items-center justify-center text-[10px] font-bold text-white">
                    {client.name.charAt(0)}
                  </div>
                )}
                {client.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto pt-1 scrollbar-thin scrollbar-thumb-sidebar-muted scrollbar-track-transparent">
        <SectionLabel collapsed={collapsed}>Cliente</SectionLabel>
        
        <div className="space-y-0.5">
          <NavItem
            icon={<Home className="h-4 w-4" />}
            label="Início"
            active={activeTab === "home"}
            onClick={() => onTabChange("home")}
            collapsed={collapsed}
          />
          
          <NavItem
            icon={<MessageSquare className="h-4 w-4" />}
            label="Assistente"
            active={activeTab === "assistant"}
            onClick={() => onTabChange("assistant")}
            collapsed={collapsed}
          />

          {canViewPerformance && (
            <NavItem
              icon={<BarChart3 className="h-4 w-4" />}
              label="Performance"
              active={activeTab === "performance"}
              onClick={() => onTabChange("performance")}
              collapsed={collapsed}
            />
          )}

          {canViewLibrary && (
            <NavItem
              icon={<Library className="h-4 w-4" />}
              label="Biblioteca"
              active={activeTab === "library"}
              onClick={() => onTabChange("library")}
              collapsed={collapsed}
            />
          )}
        </div>

        {/* PLANEJAMENTO Section */}
        <SectionLabel collapsed={collapsed}>Planejamento</SectionLabel>

        <div className="space-y-0.5">
          <NavItem
            icon={<CalendarDays className="h-4 w-4" />}
            label="Planejamento"
            active={activeTab === "planning"}
            onClick={() => onTabChange("planning")}
            collapsed={collapsed}
          />
          
          <NavItem
            icon={<Zap className="h-4 w-4" />}
            label="Automações"
            active={activeTab === "automations"}
            onClick={() => onTabChange("automations")}
            collapsed={collapsed}
          />
        </div>

        {/* CONHECIMENTO Section - includes knowledge base and format rules */}
        {canViewTools && (
          <>
            <SectionLabel collapsed={collapsed}>Conhecimento</SectionLabel>

            <div className="space-y-0.5">
              <NavItem
                icon={<BookOpen className="h-4 w-4" />}
                label="Base de Conhecimento"
                active={activeTab === "knowledge-base"}
                onClick={() => onTabChange("knowledge-base")}
                collapsed={collapsed}
              />
              <NavItem
                icon={<FileText className="h-4 w-4" />}
                label="Regras de Formato"
                active={activeTab === "format-rules"}
                onClick={() => onTabChange("format-rules")}
                collapsed={collapsed}
              />
            </div>
          </>
        )}

        <SectionLabel collapsed={collapsed}>Conta</SectionLabel>

        <div className="space-y-0.5">
          {/* Clientes - only for admin/owner */}
          {canViewClients && (
            <NavItem
              icon={<Building2 className="h-4 w-4" />}
              label="Clientes"
              active={activeTab === "clients"}
              onClick={() => onTabChange("clients")}
              collapsed={collapsed}
            />
          )}

          {/* Equipe - only for team managers */}
          {canManageTeam && (
            <NavItem
              icon={<Users className="h-4 w-4" />}
              label="Equipe"
              active={activeTab === "team"}
              onClick={() => onTabChange("team")}
              badge={pendingCount}
              collapsed={collapsed}
            />
          )}

          {/* Atividades - only for admin/owner */}
          {canViewActivities && (
            <NavItem
              icon={<Activity className="h-4 w-4" />}
              label="Atividades"
              active={activeTab === "activities"}
              onClick={() => onTabChange("activities")}
              collapsed={collapsed}
            />
          )}

          <NavItem
            icon={<Settings className="h-4 w-4" />}
            label="Configurações"
            active={false}
            onClick={() => navigate(`/${currentSlug}/settings`)}
            collapsed={collapsed}
          />

          <NavItem
            icon={<HelpCircle className="h-4 w-4" />}
            label="Ajuda"
            active={activeTab === "docs"}
            onClick={() => navigate(`/${currentSlug}/docs`)}
            collapsed={collapsed}
          />
        </div>
      </nav>

      {/* Tokens Badge */}
      {!collapsed && (
        <div className="px-3 py-2 border-t border-sidebar-border">
          <TokensBadge showLabel={true} variant="sidebar" />
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="px-3 py-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className={cn(
            "w-full flex items-center gap-2 justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
            !collapsed && "justify-start"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs">Recolher</span>
            </>
          )}
        </Button>
      </div>

      {/* User Footer */}
      <div className={cn("p-3 border-t border-sidebar-border", collapsed && "p-2")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-3 rounded-lg hover:bg-sidebar-accent/50 transition-colors",
              collapsed ? "p-1 justify-center" : "px-2 py-2"
            )}>
              <Avatar className={cn("border border-sidebar-border", collapsed ? "h-8 w-8" : "h-9 w-9")}>
                <AvatarImage src={userProfile?.avatar_url || undefined} alt={userName} />
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs font-medium">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
                    <p className="text-[11px] text-sidebar-foreground/50 truncate">{user?.email}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-sidebar-foreground/40 flex-shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-popover border-border shadow-lg">
            <DropdownMenuItem onClick={() => navigate(`/${currentSlug}/settings`)} className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2 opacity-70" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2 opacity-70" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
