// Global Cmd+K Command Palette
// Listens for Cmd+K (or Ctrl+K) anywhere in the app and opens a search dialog
// with quick navigation + common actions.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronRight,
  FileText,
  Plus,
  Radar,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-xl overflow-hidden">
        <Command>
          <CommandInput placeholder="Busque ações ou navegação..." />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            <CommandGroup heading="Navegação">
              <CommandItem onSelect={() => go("/kaleidos")}>
                <ChevronRight className="mr-2 h-4 w-4" />
                Home Dashboard
              </CommandItem>
              <CommandItem onSelect={() => go("/kaleidos/clients")}>
                <Users className="mr-2 h-4 w-4" />
                Clientes
              </CommandItem>
              <CommandItem onSelect={() => go("/kaleidos?tab=planning")}>
                <Calendar className="mr-2 h-4 w-4" />
                Planning
              </CommandItem>
              <CommandItem onSelect={() => go("/kaleidos?tab=viral-radar-page")}>
                <Radar className="mr-2 h-4 w-4" />
                Radar
              </CommandItem>
              <CommandItem onSelect={() => go("/kaleidos?tab=viral-library")}>
                <Sparkles className="mr-2 h-4 w-4" />
                Biblioteca Viral
              </CommandItem>
              <CommandItem onSelect={() => go("/kaleidos?tab=performance")}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Performance
              </CommandItem>
              <CommandItem onSelect={() => go("/kaleidos?tab=settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Criar">
              <CommandItem onSelect={() => go("/kaleidos/clients?action=new")}>
                <Plus className="mr-2 h-4 w-4" />
                Novo cliente
              </CommandItem>
              <CommandItem onSelect={() => go("/kaleidos?tab=viral-carrossel")}>
                <FileText className="mr-2 h-4 w-4" />
                Novo carrossel
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
