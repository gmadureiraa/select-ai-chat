import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { User, CreditCard, Users, Palette, Bell } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export type SettingsSection = "profile" | "team" | "notifications" | "appearance";

interface SettingsNavigationProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  showTeam?: boolean;
}

const sections = [
  { id: "profile" as const, label: "Perfil", icon: User },
  { id: "team" as const, label: "Time", icon: Users, requiresPermission: "team" },
  { id: "notifications" as const, label: "Notificações", icon: Bell },
  { id: "appearance" as const, label: "Aparência", icon: Palette },
];

export function SettingsNavigation({ 
  activeSection, 
  onSectionChange, 
  showTeam = true,
}: SettingsNavigationProps) {
  const isMobile = useIsMobile();
  const visibleSections = sections.filter(section => {
    if (section.requiresPermission === "team" && !showTeam) return false;
    return true;
  });

  // Mobile: horizontal scrollable tabs
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

  // Desktop: vertical sidebar nav
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
