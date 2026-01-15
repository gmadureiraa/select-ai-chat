import { cn } from "@/lib/utils";
import { User, CreditCard, Users, Palette } from "lucide-react";

export type SettingsSection = "profile" | "billing" | "team" | "appearance";

interface SettingsNavigationProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  showTeam?: boolean;
}

const sections = [
  { id: "profile" as const, label: "Perfil", icon: User },
  { id: "billing" as const, label: "Plano", icon: CreditCard },
  { id: "team" as const, label: "Time", icon: Users, requiresPermission: "team" },
  { id: "appearance" as const, label: "Aparência", icon: Palette },
];

export function SettingsNavigation({ 
  activeSection, 
  onSectionChange, 
  showTeam = true,
}: SettingsNavigationProps) {
  const visibleSections = sections.filter(section => {
    if (section.requiresPermission === "team" && !showTeam) return false;
    return true;
  });

  return (
    <nav className="w-56 flex-shrink-0">
      <ul className="space-y-1">
        {visibleSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          
          return (
            <li key={section.id}>
              <button
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
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
    </nav>
  );
}
