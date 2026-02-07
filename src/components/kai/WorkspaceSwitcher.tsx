import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserWorkspaces, UserWorkspace } from "@/hooks/useUserWorkspaces";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * WorkspaceSwitcher - Sistema interno Kaleidos
 * 
 * Versão simplificada sem opção de criar novo workspace.
 * Permite apenas alternar entre workspaces existentes.
 */

interface WorkspaceSwitcherProps {
  collapsed?: boolean;
}

export function WorkspaceSwitcher({ collapsed }: WorkspaceSwitcherProps) {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { workspaces, hasMultipleWorkspaces, isLoading } = useUserWorkspaces();

  const currentWorkspace = workspaces.find(w => w.slug === slug);

  const handleSwitch = (workspace: UserWorkspace) => {
    if (workspace.slug !== slug) {
      navigate(`/${workspace.slug}`);
    }
  };

  const getRoleBadge = (role: UserWorkspace["role"]) => {
    const roleLabels: Record<string, string> = {
      owner: "Dono",
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

  if (!currentWorkspace) return null;

  // Se só tem um workspace, mostrar sem dropdown
  if (!hasMultipleWorkspaces) {
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

  // Múltiplos workspaces - mostrar dropdown para alternar
  const triggerContent = (
    <button className={cn(
      "w-full flex items-center gap-2.5 rounded-md transition-colors py-1",
      "hover:bg-sidebar-accent",
      collapsed && "justify-center px-0"
    )}>
      <Avatar className={cn("rounded", collapsed ? "w-7 h-7" : "w-7 h-7")}>
        {currentWorkspace.logo_url ? (
          <AvatarImage src={currentWorkspace.logo_url} alt={currentWorkspace.name} />
        ) : null}
        <AvatarFallback className="rounded bg-gradient-to-br from-primary to-secondary text-white font-semibold text-xs">
          {currentWorkspace.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {!collapsed && (
        <>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13px] font-semibold text-sidebar-foreground truncate leading-tight">
              {currentWorkspace.name}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 leading-tight">
              {getRoleBadge(currentWorkspace.role)}
            </p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/40 flex-shrink-0" />
        </>
      )}
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              {triggerContent}
            </TooltipTrigger>
            <TooltipContent side="right">
              Trocar Workspace
            </TooltipContent>
          </Tooltip>
        ) : (
          triggerContent
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-60"
        sideOffset={8}
      >
        <div className="px-3 py-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Trocar Workspace
          </p>
        </div>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => handleSwitch(workspace)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 cursor-pointer",
              workspace.slug === slug && "bg-primary/10"
            )}
          >
            <Avatar className="w-6 h-6 rounded">
              {workspace.logo_url ? (
                <AvatarImage src={workspace.logo_url} alt={workspace.name} />
              ) : null}
              <AvatarFallback className="rounded bg-gradient-to-br from-primary/80 to-secondary/80 text-white text-[9px] font-semibold">
                {workspace.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{workspace.name}</p>
              <p className="text-[10px] text-muted-foreground">{getRoleBadge(workspace.role)}</p>
            </div>
            {workspace.slug === slug && (
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
