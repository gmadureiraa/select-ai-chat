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
  Send,
  Blocks,
  FlaskConical,
  BookOpen,
  Activity,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients } from "@/hooks/useClients";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
        "hover:bg-white/5",
        active && "bg-white/10 text-white",
        !active && "text-white/60"
      )}
    >
      <span className={cn(
        "flex-shrink-0",
        active && "text-primary"
      )}>
        {icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
    </button>
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
  const selectedClient = clients?.find(c => c.id === selectedClientId);

  return (
    <aside className="w-60 h-screen bg-[hsl(0,0%,6%)] border-r border-white/5 flex flex-col">
      {/* Logo */}
      <div className="p-4 flex items-center gap-2">
        <img src={kaleidosLogo} alt="Kaleidos" className="h-6 w-6" />
        <span className="font-semibold text-white">Kaleidos</span>
      </div>

      {/* Client Selector */}
      <div className="px-3 mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white">
                {selectedClient?.name?.charAt(0) || "K"}
              </div>
              <span className="flex-1 text-left text-sm text-white truncate">
                {selectedClient?.name || "Selecionar Cliente"}
              </span>
              <ChevronDown className="h-4 w-4 text-white/40" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {clients?.map((client) => (
              <DropdownMenuItem
                key={client.id}
                onClick={() => onClientChange(client.id)}
                className={cn(
                  selectedClientId === client.id && "bg-primary/10"
                )}
              >
                {client.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
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

        <NavItem
          icon={<Settings className="h-4 w-4" />}
          label="Configurações"
          active={activeTab === "settings"}
          onClick={() => onTabChange("settings")}
        />

        {/* Tools Section */}
        <div className="pt-6 pb-2">
          <span className="px-3 text-xs font-medium text-white/30 uppercase tracking-wider">
            Ferramentas
          </span>
        </div>

        <NavItem
          icon={<Activity className="h-4 w-4" />}
          label="Atividades"
          active={activeTab === "activities"}
          onClick={() => onTabChange("activities")}
        />

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
          icon={<Send className="h-4 w-4" />}
          label="Publicador Social"
          active={activeTab === "social-publisher"}
          onClick={() => onTabChange("social-publisher")}
        />

        <NavItem
          icon={<FlaskConical className="h-4 w-4" />}
          label="Lab de Pesquisa"
          active={activeTab === "research-lab"}
          onClick={() => onTabChange("research-lab")}
        />
      </nav>

      {/* Bottom - Account Settings */}
      <div className="p-3 border-t border-white/5">
        <NavItem
          icon={<User className="h-4 w-4" />}
          label="Conta"
          onClick={() => navigate("/settings")}
        />
      </div>
    </aside>
  );
}
