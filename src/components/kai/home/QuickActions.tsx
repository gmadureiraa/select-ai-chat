import { motion } from "framer-motion";
import {
  Sparkles,
  UserPlus,
  Radar,
  Film,
  Image as ImageIcon,
  Bot,
  Calendar,
  Zap,
  MessageSquare,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

interface QuickActionsProps {
  onNavigate: (tab: string) => void;
  onCreateClient?: () => void;
  hasClients?: boolean;
}

interface QuickAction {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  accent: string; // tailwind classes for icon bg
  primary?: boolean; // marca a ação principal
  hidden?: boolean;
}

export function QuickActions({
  onNavigate,
  onCreateClient,
  hasClients = true,
}: QuickActionsProps) {
  // Permissões — esconde "Convidar membro" pra quem não pode gerenciar.
  // Owner/admin veem; viewers/editors não.
  const { canManageTeam } = useWorkspace();

  // Quando não tem cliente cadastrado, "Cadastrar cliente" vira a ação principal
  // e algumas ações específicas-de-cliente (carrossel/reel/radar) ficam ocultas.
  const allActions: QuickAction[] = [
    {
      key: "client",
      label: hasClients ? "Novo cliente" : "Cadastrar cliente",
      description: hasClients ? "Cadastrar perfil novo" : "Comece por aqui",
      icon: UserPlus,
      onClick: () => {
        if (onCreateClient) onCreateClient();
        else onNavigate("clients");
      },
      accent: hasClients
        ? "bg-emerald-500/10 text-emerald-500"
        : "bg-primary/15 text-primary",
      primary: !hasClients,
    },
    {
      key: "carousel",
      label: "Criar carrossel",
      description: "Sequência viral",
      icon: Sparkles,
      onClick: () => onNavigate("viral-carrossel"),
      accent: "bg-primary/10 text-primary",
      hidden: !hasClients,
    },
    {
      key: "reel",
      label: "Roteiro de reel",
      description: "Engenharia reversa",
      icon: Film,
      onClick: () => onNavigate("viral-reels-page"),
      accent: "bg-purple-500/10 text-purple-400",
      hidden: !hasClients,
    },
    {
      key: "radar",
      label: "Abrir radar",
      description: "Tendências por cliente",
      icon: Radar,
      onClick: () => onNavigate("viral-radar-page"),
      accent: "bg-orange-500/10 text-orange-400",
      hidden: !hasClients,
    },
    {
      key: "planning",
      label: "Planejamento",
      description: "Calendário + kanban",
      icon: Calendar,
      onClick: () => onNavigate("planning"),
      accent: "bg-blue-500/10 text-blue-400",
    },
    {
      key: "library",
      label: "Biblioteca",
      description: "Refs e posts salvos",
      icon: ImageIcon,
      onClick: () => onNavigate("library"),
      accent: "bg-cyan-500/10 text-cyan-400",
      hidden: !hasClients,
    },
    {
      key: "assistant",
      label: "Chat KAI",
      description: "Pergunta & gera (⌘K)",
      icon: MessageSquare,
      onClick: () => onNavigate("assistant"),
      accent: "bg-fuchsia-500/10 text-fuchsia-400",
      hidden: !hasClients,
    },
    {
      key: "automations",
      label: "Automações",
      description: "Fluxos n8n",
      icon: Bot,
      onClick: () => onNavigate("automations"),
      accent: "bg-amber-500/10 text-amber-400",
    },
    {
      key: "members",
      label: "Convidar membro",
      description: "Adicionar ao workspace",
      icon: Zap,
      onClick: () => {
        // Members hoje vivem em Settings → Members (decisão UX 2026-05-09)
        const url = new URL(window.location.href);
        url.searchParams.set("tab", "settings");
        url.searchParams.set("section", "members");
        window.history.pushState({}, "", url.toString());
        onNavigate("settings");
      },
      accent: "bg-teal-500/10 text-teal-400",
      hidden: !canManageTeam,
    },
    {
      key: "settings",
      label: "Configurações",
      description: "Workspace + perfis",
      icon: Settings,
      onClick: () => onNavigate("settings"),
      accent: "bg-muted/50 text-muted-foreground",
      hidden: !canManageTeam, // só owners/admins veem atalho aqui
    },
  ];

  const actions = allActions.filter((a) => !a.hidden);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Ações rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {actions.map((a) => (
              <button
                key={a.key}
                onClick={a.onClick}
                className={cn(
                  "flex flex-col items-start gap-2 p-3 rounded-lg border transition-all duration-200 text-left group",
                  a.primary
                    ? "border-primary/40 bg-primary/[0.04] hover:border-primary/70 hover:bg-primary/[0.07] ring-1 ring-primary/15"
                    : "border-border/40 hover:border-border/80 hover:bg-accent/40"
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-md flex items-center justify-center transition-transform group-hover:scale-105",
                    a.accent
                  )}
                >
                  <a.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 w-full">
                  <p className="text-sm font-medium truncate">{a.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {a.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
