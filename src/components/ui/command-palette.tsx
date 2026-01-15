import { useNavigate } from "react-router-dom";
import {
  Bot, BarChart3, Library, Settings, User, ArrowRight
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

  const pages = [
    { id: "performance", label: "Performance", icon: BarChart3, action: () => onSelectTab?.("performance") },
    { id: "planning", label: "Planejamento", icon: Bot, action: () => onSelectTab?.("planning") },
    { id: "canvas", label: "Canvas", icon: Library, action: () => onSelectTab?.("canvas") },
    { id: "settings-client", label: "Configurações do Cliente", icon: Settings, action: () => onSelectTab?.("settings") },
  ];

  const tools = [
    { id: "clients", label: "Clientes", icon: User, action: () => onSelectTab?.("clients") },
    { id: "settings", label: "Configurações Gerais", icon: Settings, action: () => navigate("/settings") },
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
