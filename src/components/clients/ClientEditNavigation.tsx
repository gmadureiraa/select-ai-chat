import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  User,
  Globe,
  Brain,
  FileText,
  Plug,
  Radar,
  BarChart3,
  Terminal,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Check, AlertCircle } from "lucide-react";

/**
 * 9 sections do Perfil do Cliente — agrupadas em 3 grupos UX-first:
 *   Identidade            → quem é o cliente (perfil + redes + voz IA)
 *   Conteúdo              → o que alimenta os geradores (docs/refs/visuals/integrações)
 *   Performance & Configs → métricas, viral, automações de notificação, MCP
 *
 * Modelo igual a `SettingsNavigation` — desktop = sidebar vertical agrupada,
 * mobile = chips horizontais flat.
 */

export type ClientEditSection =
  | "profile"
  | "digital"
  | "ai-context"
  | "references"
  | "integrations"
  | "viral"
  | "analytics"
  | "mcp"
  | "notifications";

type Group = "identity" | "content" | "perf";

interface ClientEditNavigationProps {
  activeSection: ClientEditSection;
  onSectionChange: (section: ClientEditSection) => void;
  /** done/total por section — mostra dot de completude no item da nav. */
  completion?: Partial<
    Record<ClientEditSection, { done: number; total: number }>
  >;
}

interface SectionDef {
  id: ClientEditSection;
  label: string;
  icon: LucideIcon;
  group: Group;
}

const sections: SectionDef[] = [
  // Identidade — "quem é o cliente"
  { id: "profile", label: "Sobre", icon: User, group: "identity" },
  { id: "digital", label: "Redes", icon: Globe, group: "identity" },
  { id: "ai-context", label: "Contexto IA", icon: Brain, group: "identity" },
  // Conteúdo — "o que alimenta os geradores"
  { id: "references", label: "Referências", icon: FileText, group: "content" },
  { id: "integrations", label: "Integrações", icon: Plug, group: "content" },
  // Performance & Configs
  { id: "viral", label: "Viral", icon: Radar, group: "perf" },
  { id: "analytics", label: "Analytics", icon: BarChart3, group: "perf" },
  { id: "notifications", label: "Notificações", icon: Bell, group: "perf" },
  { id: "mcp", label: "MCP", icon: Terminal, group: "perf" },
];

const groupLabels: Record<Group, string> = {
  identity: "Identidade",
  content: "Conteúdo",
  perf: "Performance & Configs",
};

function CompletionDot({
  completion,
}: {
  completion: { done: number; total: number } | undefined;
}) {
  if (!completion || completion.total === 0) return null;
  const { done, total } = completion;
  const pct = (done / total) * 100;
  if (pct >= 100) {
    return (
      <span
        className="ml-auto inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
        aria-label={`${done} de ${total} preenchidos`}
      >
        <Check className="h-2.5 w-2.5" aria-hidden="true" />
      </span>
    );
  }
  if (pct === 0) {
    return (
      <span
        className="ml-auto inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive/15 text-destructive/80"
        aria-label="Vazio — preencher recomendado"
      >
        <AlertCircle className="h-2.5 w-2.5" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span
      className="ml-auto inline-flex h-3.5 px-1 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-medium tabular-nums"
      aria-label={`${done} de ${total} preenchidos`}
    >
      {done}/{total}
    </span>
  );
}

export function ClientEditNavigation({
  activeSection,
  onSectionChange,
  completion,
}: ClientEditNavigationProps) {
  const isMobile = useIsMobile();

  // Mobile: chips horizontais (sem agrupamento — flat)
  if (isMobile) {
    return (
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {section.label}
                <CompletionDot completion={completion?.[section.id]} />
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
  }

  // Desktop: sidebar vertical agrupada por (Identidade · Conteúdo · Performance)
  const grouped: Record<Group, SectionDef[]> = {
    identity: [],
    content: [],
    perf: [],
  };
  sections.forEach((s) => grouped[s.group].push(s));

  return (
    <nav
      className="w-48 flex-shrink-0 space-y-4"
      aria-label="Seções do perfil do cliente"
    >
      {(Object.keys(grouped) as Group[]).map((group) => {
        const items = grouped[group];
        if (items.length === 0) return null;
        return (
          <div key={group} className="space-y-1">
            <span className="block px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {groupLabels[group]}
            </span>
            <ul className="space-y-0.5">
              {items.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <li key={section.id}>
                    <button
                      onClick={() => onSectionChange(section.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span className="flex-1 text-left">{section.label}</span>
                      <CompletionDot completion={completion?.[section.id]} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
