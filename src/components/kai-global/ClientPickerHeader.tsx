import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface ClientItem {
  id: string;
  name: string;
  avatar_url?: string;
}

interface ClientPickerHeaderProps {
  clients: ClientItem[];
  selectedClientId: string | null;
  onClientChange: (clientId: string) => void;
  /**
   * Quando excede esse limite, mostra busca dentro do popover.
   * Default 6 — abaixo disso a busca é overkill.
   */
  searchThreshold?: number;
}

/**
 * Picker de cliente embutido no header do chat global do KAI.
 *
 * UX:
 * - Botão compacto: avatar + nome + chevron (caps em 220px)
 * - Click abre popover com lista de clientes
 * - Com 7+ clientes mostra input de busca (cmdk fuzzy match)
 * - Lista com scroll (max-h-72) pra não estourar viewport mobile
 * - Selecionar fecha popover + dispara onClientChange
 *
 * Não confundir com `KaiSidebar` (sidebar full-screen com modos client/global).
 * Esse aqui é só um switcher leve dentro do painel do chat.
 */
export function ClientPickerHeader({
  clients,
  selectedClientId,
  onClientChange,
  searchThreshold = 6,
}: ClientPickerHeaderProps) {
  const [open, setOpen] = useState(false);
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const showSearch = clients.length > searchThreshold;

  const handleSelect = (clientId: string) => {
    onClientChange(clientId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto py-1.5 px-2 gap-2 max-w-[220px] hover:bg-muted/50"
          aria-label={
            selectedClient
              ? `Cliente ativo: ${selectedClient.name}. Trocar`
              : "Selecionar cliente"
          }
        >
          {selectedClient ? (
            <>
              <Avatar className="h-6 w-6 border border-border/50">
                <AvatarImage src={selectedClient.avatar_url} />
                <AvatarFallback className="text-[10px] bg-muted">
                  {selectedClient.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium truncate max-w-[140px]">
                  {selectedClient.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Criando conteúdo
                </span>
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              Selecionar perfil
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 ml-1"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-72 p-0"
      >
        <Command shouldFilter={showSearch}>
          {showSearch && (
            <div
              className="flex items-center border-b px-3"
              cmdk-input-wrapper=""
            >
              <Search
                aria-hidden="true"
                className="mr-2 h-4 w-4 shrink-0 opacity-50"
              />
              <CommandInput
                placeholder="Buscar perfil..."
                className="border-0 focus:ring-0 h-10"
              />
            </div>
          )}
          {!showSearch && (
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">
              Selecione um perfil
            </div>
          )}
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum perfil encontrado.</CommandEmpty>
            <CommandGroup>
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.name}
                  onSelect={() => handleSelect(client.id)}
                  className={cn(
                    "gap-3 py-2 cursor-pointer",
                    client.id === selectedClientId && "bg-accent"
                  )}
                >
                  <Avatar className="h-7 w-7 border border-border/50">
                    <AvatarImage src={client.avatar_url} />
                    <AvatarFallback className="text-[10px] bg-muted">
                      {client.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{client.name}</span>
                  {client.id === selectedClientId && (
                    <Check
                      aria-hidden="true"
                      className="h-4 w-4 text-primary flex-shrink-0"
                    />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
