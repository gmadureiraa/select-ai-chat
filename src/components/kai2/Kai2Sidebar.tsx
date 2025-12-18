import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Home, 
  MessageSquare, 
  BarChart3, 
  Library,
  Settings,
  ChevronDown,
  Zap,
  Blocks,
  FlaskConical,
  BookOpen,
  Activity,
  Users,
  Search,
  LogOut,
  HelpCircle,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePendingUsers } from "@/hooks/usePendingUsers";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
}

function NavItem({ icon, label, active, onClick, badge }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150",
        "hover:bg-muted",
        active && "bg-muted text-primary font-medium",
        !active && "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className={cn(
        "flex-shrink-0 opacity-70",
        active && "opacity-100 text-primary"
      )}>
        {icon}
      </span>
      <span className="flex-1 text-left truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="flex-shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

interface SectionLabelProps {
  children: React.ReactNode;
}

function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div className="px-3 pt-5 pb-2">
      <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
        {children}
      </span>
    </div>
  );
}

interface Kai2SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  selectedClientId: string | null;
  onClientChange: (id: string) => void;
}

export function Kai2Sidebar({ activeTab, onTabChange, selectedClientId, onClientChange }: Kai2SidebarProps) {
  const navigate = useNavigate();
  const { clients } = useClients();
  const { canManageTeam, isViewer } = useWorkspace();
  const { pendingCount } = usePendingUsers();
  const { user, signOut } = useAuth();
  const selectedClient = clients?.find(c => c.id === selectedClientId);
  const [searchQuery, setSearchQuery] = useState("");

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
    <aside className="w-64 h-screen bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="h-14 px-4 flex items-center gap-2.5 border-b border-border">
        <img src={kaleidosLogo} alt="Kaleidos" className="h-7 w-7" />
        <span className="font-semibold text-foreground tracking-tight">Kaleidos</span>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 bg-muted/50 border-transparent focus:border-border text-sm"
          />
        </div>
      </div>

      {/* Client Selector */}
      <div className="px-3 pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-muted/50 hover:bg-muted transition-colors border border-transparent hover:border-border">
              {selectedClient?.avatar_url ? (
                <Avatar className="w-8 h-8 rounded-md">
                  <AvatarImage src={selectedClient.avatar_url} alt={selectedClient.name} />
                  <AvatarFallback className="rounded-md bg-gradient-to-br from-primary to-secondary text-xs font-bold text-white">
                    {selectedClient.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  {selectedClient?.name?.charAt(0) || "K"}
                </div>
              )}
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {selectedClient?.name || "Selecionar Cliente"}
                </p>
                <p className="text-[11px] text-muted-foreground">Cliente ativo</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-popover border-border shadow-elevated">
            {filteredClients?.map((client) => (
              <DropdownMenuItem
                key={client.id}
                onClick={() => {
                  onClientChange(client.id);
                  setSearchQuery("");
                }}
                className={cn(
                  "flex items-center gap-2",
                  "cursor-pointer",
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
      <nav className="flex-1 px-3 overflow-y-auto">
        <SectionLabel>Cliente</SectionLabel>
        
        <div className="space-y-0.5">
          <NavItem
            icon={<Home className="h-4 w-4" />}
            label="Início"
            active={activeTab === "home"}
            onClick={() => onTabChange("home")}
          />
          
          <NavItem
            icon={<MessageSquare className="h-4 w-4" />}
            label="Assistente"
            active={activeTab === "assistant"}
            onClick={() => onTabChange("assistant")}
          />

          <NavItem
            icon={<BarChart3 className="h-4 w-4" />}
            label="Performance"
            active={activeTab === "performance"}
            onClick={() => onTabChange("performance")}
          />

          <NavItem
            icon={<Library className="h-4 w-4" />}
            label="Biblioteca"
            active={activeTab === "library"}
            onClick={() => onTabChange("library")}
          />
        </div>

        {/* Ferramentas - hidden for viewers */}
        {!isViewer && (
          <>
            <SectionLabel>Ferramentas</SectionLabel>

            <div className="space-y-0.5">
              <NavItem
                icon={<BookOpen className="h-4 w-4" />}
                label="Base de Conhecimento"
                active={activeTab === "knowledge-base"}
                onClick={() => onTabChange("knowledge-base")}
              />

              <NavItem
                icon={<Zap className="h-4 w-4" />}
                label="Automações"
                active={activeTab === "automations"}
                onClick={() => onTabChange("automations")}
              />

              <NavItem
                icon={<Blocks className="h-4 w-4" />}
                label="Agent Builder"
                active={activeTab === "agent-builder"}
                onClick={() => onTabChange("agent-builder")}
              />

              <NavItem
                icon={<FlaskConical className="h-4 w-4" />}
                label="Lab de Pesquisa"
                active={activeTab === "research-lab"}
                onClick={() => onTabChange("research-lab")}
              />
            </div>
          </>
        )}

        <SectionLabel>Conta</SectionLabel>

        <div className="space-y-0.5">
          {/* Clientes - only for non-viewers */}
          {!isViewer && (
            <NavItem
              icon={<Building2 className="h-4 w-4" />}
              label="Clientes"
              active={activeTab === "clients"}
              onClick={() => onTabChange("clients")}
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
            />
          )}

          {/* Atividades - for non-viewers */}
          {!isViewer && (
            <NavItem
              icon={<Activity className="h-4 w-4" />}
              label="Atividades"
              active={activeTab === "activities"}
              onClick={() => onTabChange("activities")}
            />
          )}

          <NavItem
            icon={<Settings className="h-4 w-4" />}
            label="Configurações"
            active={false}
            onClick={() => navigate("/settings")}
          />

          <NavItem
            icon={<HelpCircle className="h-4 w-4" />}
            label="Ajuda"
            active={activeTab === "docs"}
            onClick={() => navigate("/docs")}
          />
        </div>
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted transition-colors">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarImage src={userProfile?.avatar_url || undefined} alt={userName} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-popover border-border shadow-elevated">
            <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2 opacity-70" />
              Configurações
            </DropdownMenuItem>
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