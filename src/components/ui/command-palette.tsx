import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot, BarChart3, Library, Settings, Zap, Send, Hammer, FlaskConical,
  BookOpen, Activity, Search, User, ArrowRight
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useClients } from "@/hooks/useClients";
import { useDevAccess } from "@/hooks/useDevAccess";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectClient?: (clientId: string) => void;
  onSelectTab?: (tab: string) => void;
}

export function CommandPalette({ 
  open, 
  onOpenChange, 
  onSelectClient,
  onSelectTab 
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { clients } = useClients();
  const { canAccessAutomations, canAccessAgentBuilder, canAccessResearchLab } = useDevAccess();

  const pages = [
    { id: "assistant", label: "Assistente", icon: Bot, action: () => onSelectTab?.("assistant") },
    { id: "performance", label: "Performance", icon: BarChart3, action: () => onSelectTab?.("performance") },
    { id: "library", label: "Biblioteca", icon: Library, action: () => onSelectTab?.("library") },
    { id: "settings-client", label: "Configurações do Cliente", icon: Settings, action: () => onSelectTab?.("settings") },
  ];

  // Filter tools based on dev access
  const tools = [
    ...(canAccessAutomations ? [{ id: "automations", label: "Automações", icon: Zap, action: () => onSelectTab?.("automations") }] : []),
    { id: "social-publisher", label: "Publicador Social", icon: Send, action: () => navigate("/social-publisher") },
    ...(canAccessAgentBuilder ? [{ id: "agent-builder", label: "Agent Builder", icon: Hammer, action: () => navigate("/agent-builder") }] : []),
    ...(canAccessResearchLab ? [{ id: "research-lab", label: "Laboratório de Pesquisa", icon: FlaskConical, action: () => navigate("/research-lab") }] : []),
    { id: "knowledge-base", label: "Base de Conhecimento", icon: BookOpen, action: () => navigate("/knowledge-base") },
    { id: "activities", label: "Atividades", icon: Activity, action: () => navigate("/activities") },
    { id: "settings", label: "Configurações Gerais", icon: User, action: () => navigate("/settings") },
  ];

  const runCommand = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar páginas, clientes, ferramentas..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        
        {clients && clients.length > 0 && (
          <CommandGroup heading="Clientes">
            {clients.slice(0, 5).map((client) => (
              <CommandItem
                key={client.id}
                onSelect={() => runCommand(() => onSelectClient?.(client.id))}
                className="gap-3"
              >
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">
                    {client.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span>{client.name}</span>
                <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Páginas">
          {pages.map((page) => (
            <CommandItem
              key={page.id}
              onSelect={() => runCommand(page.action)}
              className="gap-3"
            >
              <page.icon className="h-4 w-4" />
              <span>{page.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ferramentas">
          {tools.map((tool) => (
            <CommandItem
              key={tool.id}
              onSelect={() => runCommand(tool.action)}
              className="gap-3"
            >
              <tool.icon className="h-4 w-4" />
              <span>{tool.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
