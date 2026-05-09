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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  onNavigate: (tab: string) => void;
  onCreateClient?: () => void;
}

interface QuickAction {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  accent: string; // tailwind classes for icon bg
}

export function QuickActions({ onNavigate, onCreateClient }: QuickActionsProps) {
  const actions: QuickAction[] = [
    {
      key: "carousel",
      label: "Criar carrossel",
      description: "Gerar carrossel viral",
      icon: Sparkles,
      onClick: () => onNavigate("viral-carrossel"),
      accent: "bg-primary/10 text-primary",
    },
    {
      key: "reel",
      label: "Roteiro de reel",
      description: "Análise + script",
      icon: Film,
      onClick: () => onNavigate("viral-reels-page"),
      accent: "bg-purple-500/10 text-purple-400",
    },
    {
      key: "radar",
      label: "Abrir radar",
      description: "Ideias virais por cliente",
      icon: Radar,
      onClick: () => onNavigate("viral-radar-page"),
      accent: "bg-orange-500/10 text-orange-400",
    },
    {
      key: "library",
      // viral-library foi unificada com KaiLibraryTab (per cliente) em 2026-05-08.
      // Mantemos o atalho mas aponta pra biblioteca do cliente selecionado.
      label: "Biblioteca",
      description: "Refs e posts salvos",
      icon: ImageIcon,
      onClick: () => onNavigate("library"),
      accent: "bg-cyan-500/10 text-cyan-400",
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
      key: "client",
      label: "Novo cliente",
      description: "Cadastrar perfil",
      icon: UserPlus,
      onClick: () => {
        if (onCreateClient) onCreateClient();
        else onNavigate("clients");
      },
      accent: "bg-emerald-500/10 text-emerald-500",
    },
    {
      key: "automations",
      label: "Automações",
      description: "Fluxos n8n",
      icon: Bot,
      onClick: () => onNavigate("automations"),
      accent: "bg-fuchsia-500/10 text-fuchsia-400",
    },
    {
      key: "members",
      label: "Convidar membro",
      description: "Adicionar ao workspace",
      icon: Zap,
      onClick: () => onNavigate("workspace-members"),
      accent: "bg-amber-500/10 text-amber-400",
    },
  ];

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
                  "flex flex-col items-start gap-2 p-3 rounded-lg border border-border/40",
                  "hover:border-border/80 hover:bg-accent/40 transition-all duration-200",
                  "text-left group"
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
