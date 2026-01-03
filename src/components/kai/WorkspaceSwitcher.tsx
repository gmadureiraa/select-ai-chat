import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronDown, Building2, Plus } from "lucide-react";
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
        "flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/50",
        collapsed && "justify-center px-2"
      )}>
        <div className="w-8 h-8 rounded-lg bg-sidebar-accent animate-pulse" />
        {!collapsed && (
          <div className="flex-1 space-y-1">
            <div className="h-4 w-24 bg-sidebar-accent rounded animate-pulse" />
            <div className="h-3 w-16 bg-sidebar-accent rounded animate-pulse" />
          </div>
        )}
      </div>
    );
  }

  if (!currentWorkspace) return null;

  // If only one workspace, show without dropdown
  if (!hasMultipleWorkspaces) {
    return (
      <div className={cn(
        "flex items-center gap-3 px-3 py-2",
        collapsed && "justify-center px-2"
      )}>
        <Avatar className={cn("rounded-lg", collapsed ? "w-8 h-8" : "w-9 h-9")}>
          {currentWorkspace.logo_url ? (
            <AvatarImage src={currentWorkspace.logo_url} alt={currentWorkspace.name} />
          ) : null}
          <AvatarFallback className="rounded-lg bg-gradient-to-br from-primary to-secondary text-white font-semibold text-sm">
            {currentWorkspace.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">
              {currentWorkspace.name}
            </p>
            <p className="text-[11px] text-sidebar-foreground/50">
              {getRoleBadge(currentWorkspace.role)}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
          "hover:bg-sidebar-accent/50",
          collapsed && "justify-center px-2"
        )}>
          <Avatar className={cn("rounded-lg", collapsed ? "w-8 h-8" : "w-9 h-9")}>
            {currentWorkspace.logo_url ? (
              <AvatarImage src={currentWorkspace.logo_url} alt={currentWorkspace.name} />
            ) : null}
            <AvatarFallback className="rounded-lg bg-gradient-to-br from-primary to-secondary text-white font-semibold text-sm">
              {currentWorkspace.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-sidebar-foreground truncate">
                  {currentWorkspace.name}
                </p>
                <p className="text-[11px] text-sidebar-foreground/50">
                  {getRoleBadge(currentWorkspace.role)}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-sidebar-foreground/50 flex-shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-64 bg-popover border-border shadow-lg"
        sideOffset={8}
      >
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Trocar Workspace
          </p>
        </div>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => handleSwitch(workspace)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 cursor-pointer",
              workspace.slug === slug && "bg-primary/10"
            )}
          >
            <Avatar className="w-8 h-8 rounded-lg">
              {workspace.logo_url ? (
                <AvatarImage src={workspace.logo_url} alt={workspace.name} />
              ) : null}
              <AvatarFallback className="rounded-lg bg-gradient-to-br from-primary/80 to-secondary/80 text-white text-xs font-semibold">
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
