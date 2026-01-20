import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  Palette, 
  BarChart3, 
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building2,
  Plus,
  Moon,
  Sun,
  Library,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  collapsed?: boolean;
  disabled?: boolean;
}

function NavItem({ icon, label, active, onClick, collapsed, disabled }: NavItemProps) {
  const content = (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
        active 
          ? "bg-accent text-foreground font-medium" 
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        collapsed && "justify-center px-2",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      <span className="flex-shrink-0">
        {icon}
      </span>
      {!collapsed && (
        <span className="flex-1 text-left truncate">{label}</span>
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
  const { canAddClient } = usePlanLimits();
  const { 
    canViewPerformance, 
    canViewClients, 
    canViewSettings, 
    canViewRepurpose,
    workspace 
  } = useWorkspace();
  const { hasPlanning, isPro, isCanvas, canAccessProfiles, canAccessPerformance, canAccessLibrary } = usePlanFeatures();
  const { showUpgradePrompt } = useUpgradePrompt();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
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

  return (
    <aside className={cn(
      "h-screen bg-sidebar flex flex-col transition-all duration-200",
      !isMobile && "border-r border-sidebar-border",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Workspace */}
      <div className="p-3">
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      {/* Profile Selector */}
      <div className={cn("px-3 pb-4", collapsed && "px-2")}>
        {!hasClients ? (
          <button
            onClick={() => {
              if (isCanvas) {
                showUpgradePrompt("profiles_locked");
              } else if (canAddClient) {
                setShowClientDialog(true);
              } else {
                showUpgradePrompt("max_clients");
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
              
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  if (isCanvas) {
                    showUpgradePrompt("profiles_locked");
                  } else if (canAddClient) {
                    setShowClientDialog(true);
                  } else {
                    showUpgradePrompt("max_clients");
                  }
                }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">Adicionar perfil</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <ClientDialog open={showClientDialog} onOpenChange={setShowClientDialog} />

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-1 overflow-y-auto scrollbar-hide">
        {/* Canvas */}
        <NavItem
          icon={<Palette className="h-4 w-4" strokeWidth={1.5} />}
          label="Canvas"
          active={activeTab === "canvas"}
          onClick={() => onTabChange("canvas")}
          collapsed={collapsed}
          disabled={!canViewRepurpose}
        />

        {/* Planning */}
        <NavItem
          icon={<CalendarDays className="h-4 w-4" strokeWidth={1.5} />}
          label="Planejamento"
          active={activeTab === "planning"}
          onClick={() => hasPlanning ? onTabChange("planning") : showUpgradePrompt("planning_locked")}
          collapsed={collapsed}
          disabled={!hasPlanning}
        />

        {/* Performance - requires Pro plan */}
        {canViewPerformance && canAccessPerformance && (
          <NavItem
            icon={<BarChart3 className="h-4 w-4" strokeWidth={1.5} />}
            label="Performance"
            active={activeTab === "performance"}
            onClick={() => onTabChange("performance")}
            collapsed={collapsed}
          />
        )}
        
        {/* Performance locked for Canvas */}
        {canViewPerformance && !canAccessPerformance && (
          <NavItem
            icon={<BarChart3 className="h-4 w-4" strokeWidth={1.5} />}
            label="Performance"
            active={false}
            onClick={() => showUpgradePrompt("performance_locked")}
            collapsed={collapsed}
            disabled={true}
          />
        )}

        {/* Library - requires Pro plan */}
        {canAccessLibrary && (
          <NavItem
            icon={<Library className="h-4 w-4" strokeWidth={1.5} />}
            label="Biblioteca"
            active={activeTab === "library"}
            onClick={() => onTabChange("library")}
            collapsed={collapsed}
          />
        )}
        
        {/* Library locked for Canvas */}
        {!canAccessLibrary && (
          <NavItem
            icon={<Library className="h-4 w-4" strokeWidth={1.5} />}
            label="Biblioteca"
            active={false}
            onClick={() => showUpgradePrompt("library_locked")}
            collapsed={collapsed}
            disabled={true}
          />
        )}


        {/* Profiles - requires Pro plan */}
        {canViewClients && canAccessProfiles && (
          <NavItem
            icon={<Building2 className="h-4 w-4" strokeWidth={1.5} />}
            label="Perfis"
            active={activeTab === "clients"}
            onClick={() => onTabChange("clients")}
            collapsed={collapsed}
          />
        )}
        
        {/* Profiles locked for Canvas */}
        {canViewClients && !canAccessProfiles && (
          <NavItem
            icon={<Building2 className="h-4 w-4" strokeWidth={1.5} />}
            label="Perfis"
            active={false}
            onClick={() => showUpgradePrompt("profiles_locked")}
            collapsed={collapsed}
            disabled={true}
          />
        )}
      </nav>

      {/* Footer */}
      <div className={cn("p-2 space-y-1", collapsed && "p-1.5")}>
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "w-full flex items-center gap-3 justify-start text-muted-foreground hover:text-foreground",
            collapsed && "justify-center px-2"
          )}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Moon className="h-4 w-4" strokeWidth={1.5} />
          )}
          {!collapsed && <span className="text-sm">Tema</span>}
        </Button>

        {/* Settings */}
        {canViewSettings && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/${currentSlug}/settings`)}
            className={cn(
              "w-full flex items-center gap-3 justify-start text-muted-foreground hover:text-foreground",
              collapsed && "justify-center px-2"
            )}
          >
            <Settings className="h-4 w-4" strokeWidth={1.5} />
            {!collapsed && <span className="text-sm">Configurações</span>}
          </Button>
        )}

        {/* Collapse Toggle */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={cn(
              "w-full flex items-center gap-3 justify-center text-muted-foreground hover:text-foreground",
              !collapsed && "justify-start"
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                <span className="text-sm">Recolher</span>
              </>
            )}
          </Button>
        )}
      </div>

      {/* User */}
      <div className={cn("p-2 border-t border-sidebar-border", collapsed && "p-1.5")}>
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
            <DropdownMenuItem onClick={() => navigate(`/${currentSlug}/settings`)} className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2" strokeWidth={1.5} />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" strokeWidth={1.5} />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
