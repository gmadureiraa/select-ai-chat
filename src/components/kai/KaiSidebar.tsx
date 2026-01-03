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
  Search,
  LogOut,
  HelpCircle,
  Building2,
  CalendarDays,
  Zap,
  Command
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
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
        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150 group relative",
        active 
          ? "bg-primary/10 text-primary" 
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <span className={cn(
        "flex-shrink-0 transition-colors",
        active ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
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
    <div className="px-3 pt-6 pb-2">
      <span className="text-[11px] font-medium text-sidebar-foreground/40 uppercase tracking-wider">
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
  const { canViewPerformance, canViewLibrary, canViewClients, workspace } = useWorkspace();
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
      "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Workspace Switcher */}
      <div className="px-3 pt-4 pb-3">
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      {/* Search - only when expanded */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/40" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-12 h-8 bg-transparent border-sidebar-border/50 text-sidebar-foreground placeholder:text-sidebar-foreground/40 text-sm rounded-md focus:bg-sidebar-accent/30 focus:border-sidebar-border"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <kbd className="h-4 px-1 rounded bg-sidebar-accent text-[9px] font-medium text-sidebar-foreground/50 flex items-center border border-sidebar-border/50">
                <Command className="h-2.5 w-2.5" />
              </kbd>
              <kbd className="h-4 px-1 rounded bg-sidebar-accent text-[9px] font-medium text-sidebar-foreground/50 border border-sidebar-border/50">
                K
              </kbd>
            </div>
          </div>
        </div>
      )}

      {/* Client Selector */}
      <div className={cn("px-3 pb-2", collapsed && "px-2")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-2.5 rounded-md transition-colors",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              collapsed ? "p-2 justify-center" : "px-3 py-2"
            )}>
              {selectedClient?.avatar_url ? (
                <Avatar className={cn("rounded", collapsed ? "w-5 h-5" : "w-6 h-6")}>
                  <AvatarImage src={selectedClient.avatar_url} alt={selectedClient.name} />
                  <AvatarFallback className="rounded bg-primary-foreground/20 text-[10px] font-bold">
                    {selectedClient.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className={cn(
                  "rounded bg-primary-foreground/20 flex items-center justify-center text-[10px] font-bold",
                  collapsed ? "w-5 h-5" : "w-6 h-6"
                )}>
                  {selectedClient?.name?.charAt(0) || "K"}
                </div>
              )}
              {!collapsed && (
                <>
                  <span className="flex-1 text-left text-sm font-medium truncate">
                    {selectedClient?.name || "Selecionar Cliente"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-60 flex-shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
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
                  <Avatar className="w-5 h-5 rounded">
                    <AvatarImage src={client.avatar_url} alt={client.name} />
                    <AvatarFallback className="rounded bg-primary/20 text-[9px] font-bold">
                      {client.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                    {client.name.charAt(0)}
                  </div>
                )}
                <span className="text-sm">{client.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-muted scrollbar-track-transparent">
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

        <SectionLabel collapsed={collapsed}>Conta</SectionLabel>

        <div className="space-y-0.5">
          {canViewClients && (
            <NavItem
              icon={<Building2 className="h-4 w-4" />}
              label="Clientes"
              active={activeTab === "clients"}
              onClick={() => onTabChange("clients")}
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
        <div className="px-3 py-3 border-t border-sidebar-border">
          <TokensBadge showLabel={true} variant="sidebar" />
        </div>
      )}

      {/* Collapse Toggle */}
      <div className={cn("px-2 py-2", !collapsed && "border-t border-sidebar-border")}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className={cn(
            "w-full flex items-center gap-2 justify-center h-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            !collapsed && "justify-start px-3"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Recolher menu</span>
            </>
          )}
        </Button>
      </div>

      {/* User Footer */}
      <div className={cn("p-2 border-t border-sidebar-border", collapsed && "p-1.5")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-2.5 rounded-md hover:bg-sidebar-accent transition-colors",
              collapsed ? "p-1.5 justify-center" : "px-2 py-2"
            )}>
              <Avatar className={cn("border border-sidebar-border/50", collapsed ? "h-7 w-7" : "h-8 w-8")}>
                <AvatarImage src={userProfile?.avatar_url || undefined} alt={userName} />
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-[10px] font-medium">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[13px] font-medium text-sidebar-foreground truncate">{userName}</p>
                    <p className="text-[11px] text-sidebar-foreground/50 truncate">{user?.email}</p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/40 flex-shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => navigate(`/${currentSlug}/settings`)} className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2 opacity-60" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2 opacity-60" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
