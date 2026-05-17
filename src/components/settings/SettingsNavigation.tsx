import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  User,
  Users,
  Palette,
  Bell,
  BookOpen,
  Activity,
  Webhook,
  Briefcase,
  Plug,
  ScrollText,
  Terminal,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export type SettingsSection =
  | "profile"
  | "workspace"
  | "members"
  | "team"
  | "notifications"
  | "appearance"
  | "integrations"
  | "audit-log"
  | "docs"
  | "ai-usage"
  | "webhooks"
  | "mcp";

interface SettingsNavigationProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  showTeam?: boolean;
  showWorkspace?: boolean;
  showMembers?: boolean;
  /** @deprecated Radar Viral removido do KAI em 2026-05-16. */
  showRadarSources?: boolean;
  showAuditLog?: boolean;
}

// Ordem alinhada com `validSections` em SettingsTab.tsx (mesma lista no
// switch + URL ?section=). Reorg 2026-05-09: workspace/members/radar-sources
// movidos pra cá vindos da sidebar principal (eram tabs separadas).
// 2026-05-09 (P1): adicionado integrations + audit-log + agrupamento via
// flag `group` (Conta/Workspace/Sistema) pra render visual com separators.
type Section = {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  requiresPermission?: "team" | "workspace" | "members" | "audit-log";
  group: "account" | "workspace" | "system";
};

const sections: Section[] = [
  // Conta — sempre visível
  { id: "profile", label: "Perfil", icon: User, group: "account" },
  { id: "notifications", label: "Notificações", icon: Bell, group: "account" },
  { id: "appearance", label: "Aparência", icon: Palette, group: "account" },
  // Workspace — gated por permissão
  { id: "workspace", label: "Workspace", icon: Briefcase, requiresPermission: "workspace", group: "workspace" },
  { id: "members", label: "Membros", icon: Users, requiresPermission: "members", group: "workspace" },
  { id: "team", label: "Time", icon: Users, requiresPermission: "team", group: "workspace" },
  { id: "audit-log", label: "Auditoria", icon: ScrollText, requiresPermission: "audit-log", group: "workspace" },
  // Sistema — integrações, observabilidade, dev
  { id: "integrations", label: "Integrações", icon: Plug, group: "system" },
  { id: "mcp", label: "MCP kAI", icon: Terminal, group: "system" },
  { id: "ai-usage", label: "Uso de IA", icon: Activity, group: "system" },
  { id: "webhooks", label: "Webhooks", icon: Webhook, group: "system" },
  { id: "docs", label: "Documentação", icon: BookOpen, group: "system" },
];

const groupLabels: Record<Section["group"], string> = {
  account: "Conta",
  workspace: "Workspace",
  system: "Sistema",
};

export function SettingsNavigation({
  activeSection,
  onSectionChange,
  showTeam = true,
  showWorkspace = false,
  showMembers = false,
  showRadarSources = false,
  showAuditLog = false,
}: SettingsNavigationProps) {
  const isMobile = useIsMobile();
  const visibleSections = sections.filter(section => {
    if (section.requiresPermission === "team" && !showTeam) return false;
    if (section.requiresPermission === "workspace" && !showWorkspace) return false;
    if (section.requiresPermission === "members" && !showMembers) return false;
    if (section.requiresPermission === "audit-log" && !showAuditLog) return false;
    return true;
  });

  // Mobile: horizontal scrollable tabs (sem agrupamento — flat)
  if (isMobile) {
    return (
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {visibleSections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;

            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
  }

  // Desktop: vertical sidebar nav agrupada por (Conta · Workspace · Sistema)
  const grouped: Record<Section["group"], Section[]> = {
    account: [],
    workspace: [],
    system: [],
  };
  visibleSections.forEach((s) => grouped[s.group].push(s));

  return (
    <nav className="w-56 flex-shrink-0 space-y-4">
      {(Object.keys(grouped) as Section["group"][]).map((group) => {
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
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {section.label}
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
