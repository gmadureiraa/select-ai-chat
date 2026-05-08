import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Home,
  CalendarDays,
  MessageCircle,
  Radar,
  MoreHorizontal,
  CheckSquare,
  BarChart3,
  Library,
  Twitter,
  Film,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * MobileBottomNav — barra de navegação inferior fixa, mobile only.
 *
 * 5 items: Home, Planning, KAI Chat (centro destacado), Radar, Mais (dropdown).
 * Active state derivado do search param `tab` da URL.
 *
 * Importante:
 *   - Só aparece em mobile (`md:hidden`)
 *   - Respeita safe-area-inset-bottom (iPhones com home indicator)
 *   - "Mais" abre dropdown com tabs secundárias (Tarefas, Performance, Biblioteca,
 *     Carrossel, Reels, Configurações). Viral Hunter (KAI-1.0 legacy)
 *     removido em 2026-05-08 — substituído pelo Radar Viral.
 *   - Usa rotas `/kaleidos?tab=...` (rota fixa do app, ver App.tsx)
 */

type NavItem = {
  id: string;
  icon: React.ComponentType<any>;
  label: string;
  tab: string | null;
  center?: boolean;
};

const PRIMARY_ITEMS: NavItem[] = [
  { id: "home", icon: Home, label: "Início", tab: "home" },
  { id: "planning", icon: CalendarDays, label: "Planejamento", tab: "planning" },
  { id: "chat", icon: MessageCircle, label: "kAI", tab: "assistant", center: true },
  { id: "carrossel", icon: Twitter, label: "Carrossel", tab: "viral-carrossel" },
];

const MORE_ITEMS = [
  { tab: "tasks", icon: CheckSquare, label: "Tarefas" },
  { tab: "performance", icon: BarChart3, label: "Performance" },
  { tab: "library", icon: Library, label: "Biblioteca" },
  { tab: "viral-reels-page", icon: Film, label: "Reels" },
  { tab: "viral-radar-page", icon: Radar, label: "Radar" },
  { tab: "settings", icon: Settings, label: "Configurações" },
] as const;

export function MobileBottomNav() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const currentTab = params.get("tab") || "home";
  const [moreOpen, setMoreOpen] = useState(false);

  const handleNavigate = (tab: string | null) => {
    const next = new URLSearchParams(params);
    if (tab) {
      next.set("tab", tab);
    } else {
      next.delete("tab");
    }
    // Preserva o `client` selecionado, troca só a tab.
    navigate(`/kaleidos?${next.toString()}`);
  };

  const moreActive = MORE_ITEMS.some((item) => item.tab === currentTab);

  return (
    <nav
      role="navigation"
      aria-label="Navegação inferior"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex justify-around items-center h-14">
        {PRIMARY_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.tab === currentTab;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.tab)}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full text-[10px] gap-0.5 transition-colors min-h-[44px] relative",
                active ? "text-foreground font-medium" : "text-muted-foreground",
                item.center && "-top-2",
              )}
            >
              <div
                className={cn(
                  "rounded-full p-1.5 transition-colors",
                  item.center && "bg-primary text-primary-foreground p-2 shadow-lg ring-4 ring-background",
                  !item.center && active && "bg-accent text-foreground",
                )}
              >
                <Icon
                  className={cn("h-5 w-5", item.center && "h-6 w-6")}
                  strokeWidth={1.5}
                />
              </div>
              {!item.center && <span className="leading-none">{item.label}</span>}
            </button>
          );
        })}

        {/* Mais — dropdown com tabs secundárias */}
        <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Mais opções"
              aria-current={moreActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full text-[10px] gap-0.5 transition-colors min-h-[44px]",
                moreActive || moreOpen ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              <div
                className={cn(
                  "rounded-full p-1.5 transition-colors",
                  (moreActive || moreOpen) && "bg-accent text-foreground",
                )}
              >
                <MoreHorizontal className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <span className="leading-none">Mais</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56 mb-2">
            {MORE_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const active = item.tab === currentTab;
              return (
                <div key={item.tab}>
                  <DropdownMenuItem
                    onClick={() => handleNavigate(item.tab)}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer",
                      active && "bg-accent text-foreground font-medium",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                  {/* Separador antes de "Configurações" */}
                  {idx === MORE_ITEMS.length - 2 && <DropdownMenuSeparator />}
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
