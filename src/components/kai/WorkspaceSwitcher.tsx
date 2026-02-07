import { cn } from "@/lib/utils";
import { useUserWorkspaces } from "@/hooks/useUserWorkspaces";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * TeamIndicator (ex-WorkspaceSwitcher) - Sistema interno Kaleidos
 * 
 * Exibe apenas informações do workspace Kaleidos.
 * Sem dropdown, sem opção de trocar - apenas indicador visual.
 */

interface WorkspaceSwitcherProps {
  collapsed?: boolean;
}

export function WorkspaceSwitcher({ collapsed }: WorkspaceSwitcherProps) {
  const { workspaces, isLoading } = useUserWorkspaces();

  // Get the first (and should be only) workspace
  const currentWorkspace = workspaces[0];

  const getRoleBadge = (role: string) => {
    const roleLabels: Record<string, string> = {
      owner: "Admin",
      admin: "Admin",
      member: "Membro",
      viewer: "Viewer",
    };
    return roleLabels[role] || role;
  };

  if (isLoading) {
    return (
      <div className={cn(
        "flex items-center gap-2.5",
        collapsed ? "justify-center" : "px-0"
      )}>
        <div className="w-7 h-7 rounded bg-sidebar-accent animate-pulse" />
        {!collapsed && (
          <div className="flex-1 space-y-1">
            <div className="h-3.5 w-20 bg-sidebar-accent rounded animate-pulse" />
            <div className="h-2.5 w-12 bg-sidebar-accent rounded animate-pulse" />
          </div>
        )}
      </div>
    );
  }

  if (!currentWorkspace) {
    // Fallback to Kaleidos branding if no workspace loaded yet
    const content = (
      <div className={cn(
        "flex items-center gap-2.5 py-1",
        collapsed && "justify-center"
      )}>
        <Avatar className="w-7 h-7 rounded">
          <AvatarFallback className="rounded bg-gradient-to-br from-primary to-secondary text-white font-semibold text-xs">
            K
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13px] font-semibold text-sidebar-foreground truncate leading-tight">
              Kaleidos
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 leading-tight">
              Equipe
            </p>
          </div>
        )}
      </div>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div className="flex justify-center w-full">
              <Avatar className="w-7 h-7 rounded">
                <AvatarFallback className="rounded bg-gradient-to-br from-primary to-secondary text-white font-semibold text-xs">
                  K
                </AvatarFallback>
              </Avatar>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            Kaleidos
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  }

  // Static display - no dropdown, no switching
  const content = (
    <div className={cn(
      "flex items-center gap-2.5 py-1",
      collapsed && "justify-center"
    )}>
      <Avatar className="w-7 h-7 rounded">
        {currentWorkspace.logo_url ? (
          <AvatarImage src={currentWorkspace.logo_url} alt={currentWorkspace.name} />
        ) : null}
        <AvatarFallback className="rounded bg-gradient-to-br from-primary to-secondary text-white font-semibold text-xs">
          {currentWorkspace.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {!collapsed && (
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[13px] font-semibold text-sidebar-foreground truncate leading-tight">
            {currentWorkspace.name}
          </p>
          <p className="text-[10px] text-sidebar-foreground/50 leading-tight">
            {getRoleBadge(currentWorkspace.role)}
          </p>
        </div>
      )}
    </div>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div className="flex justify-center w-full">
            <Avatar className="w-7 h-7 rounded">
              {currentWorkspace.logo_url ? (
                <AvatarImage src={currentWorkspace.logo_url} alt={currentWorkspace.name} />
              ) : null}
              <AvatarFallback className="rounded bg-gradient-to-br from-primary to-secondary text-white font-semibold text-xs">
                {currentWorkspace.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          {currentWorkspace.name}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
