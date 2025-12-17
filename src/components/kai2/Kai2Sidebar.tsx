import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Home, 
  Search, 
  FileText, 
  Mail, 
  BarChart3, 
  Users, 
  Settings,
  ChevronDown,
  Layers,
  MessageSquare,
  Zap
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
  children?: React.ReactNode;
  hasSubmenu?: boolean;
}

function NavItem({ icon, label, active, onClick, children, hasSubmenu }: NavItemProps) {
  const [expanded, setExpanded] = useState(active);

  return (
    <div>
      <button
        onClick={() => {
          if (hasSubmenu) {
            setExpanded(!expanded);
          } else {
            onClick?.();
          }
        }}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
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
        {hasSubmenu && (
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform",
            expanded && "rotate-180"
          )} />
        )}
      </button>
      {expanded && children && (
        <div className="ml-6 mt-1 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

function SubNavItem({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all",
        "hover:bg-white/5",
        active ? "text-white bg-white/10" : "text-white/50"
      )}
    >
      {active && <div className="w-1 h-1 rounded-full bg-primary" />}
      <span>{label}</span>
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
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white">
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

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        <NavItem
          icon={<Home className="h-4 w-4" />}
          label="Início"
          active={activeTab === "home"}
          onClick={() => onTabChange("home")}
        />
        
        <NavItem
          icon={<Search className="h-4 w-4" />}
          label="Buscar"
          onClick={() => {}}
        />

        <NavItem
          icon={<MessageSquare className="h-4 w-4" />}
          label="Assistente"
          active={activeTab === "assistant"}
          onClick={() => onTabChange("assistant")}
        />

        <NavItem
          icon={<FileText className="h-4 w-4" />}
          label="Biblioteca"
          active={activeTab === "library"}
          onClick={() => onTabChange("library")}
        />

        <NavItem
          icon={<Mail className="h-4 w-4" />}
          label="E-mail"
          hasSubmenu
          active={activeTab.startsWith("email")}
        >
          <SubNavItem 
            label="Envios" 
            active={activeTab === "email-sends"}
            onClick={() => onTabChange("email-sends")}
          />
          <SubNavItem 
            label="Analytics" 
            active={activeTab === "email-analytics"}
            onClick={() => onTabChange("email-analytics")}
          />
          <SubNavItem 
            label="Contatos" 
            active={activeTab === "email-contacts"}
            onClick={() => onTabChange("email-contacts")}
          />
        </NavItem>

        <NavItem
          icon={<BarChart3 className="h-4 w-4" />}
          label="Performance"
          active={activeTab === "performance"}
          onClick={() => onTabChange("performance")}
        />

        <div className="pt-4 pb-2">
          <span className="px-3 text-xs font-medium text-white/30 uppercase tracking-wider">
            Recursos
          </span>
        </div>

        <NavItem
          icon={<Layers className="h-4 w-4" />}
          label="Templates"
          active={activeTab === "templates"}
          onClick={() => onTabChange("templates")}
        />

        <NavItem
          icon={<Zap className="h-4 w-4" />}
          label="Automações"
          active={activeTab === "automations"}
          onClick={() => onTabChange("automations")}
        />
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-white/5">
        <NavItem
          icon={<Settings className="h-4 w-4" />}
          label="Configurações"
          onClick={() => navigate("/settings")}
        />
      </div>
    </aside>
  );
}
