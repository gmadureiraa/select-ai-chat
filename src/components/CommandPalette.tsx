// Global Cmd+K Command Palette
// Listens for Cmd+K (or Ctrl+K) anywhere in the app and opens a search dialog
// with quick navigation + common actions + cliente switching + busca de conteúdo
// real em planning_items, client_reference_library e client_content_library.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CheckSquare,
  ChevronRight,
  Clipboard,
  FileText,
  Home,
  Library,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  Twitter,
  Zap,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useClients } from "@/hooks/useClients";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspace } = useWorkspaceContext();

  // useClients depende de WorkspaceProvider (montado em App.tsx). Quando o
  // user não está autenticado, retorna lista vazia em vez de quebrar.
  const { clients = [] } = useClients();
  const clientsList = useMemo(
    () =>
      (clients ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        avatar_url: c.avatar_url,
      })),
    [clients],
  );

  // Debounce 250ms — evita query a cada keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Busca conteúdo real em 3 tabelas — só dispara quando dialog aberto +
  // query >= 2 chars (evita custo desnecessário).
  const searchEnabled = open && debouncedQuery.length >= 2 && !!workspace?.id;
  const { data: contentResults = { planning: [], references: [], content: [] } } = useQuery({
    queryKey: ["cmdk-search", workspace?.id, debouncedQuery],
    queryFn: async () => {
      if (!workspace?.id || debouncedQuery.length < 2) {
        return { planning: [], references: [], content: [] };
      }
      const term = `%${debouncedQuery}%`;
      const [planning, references, content] = await Promise.all([
        supabase
          .from("planning_items")
          .select("id, title, client_id, status")
          .eq("workspace_id", workspace.id)
          .ilike("title", term)
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("client_reference_library")
          .select("id, title, client_id, reference_type")
          .ilike("title", term)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("client_content_library")
          .select("id, title, client_id, content_type")
          .ilike("title", term)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      return {
        planning: planning.data ?? [],
        references: references.data ?? [],
        content: content.data ?? [],
      };
    },
    enabled: searchEnabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K abre palette
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // Esc fecha (Dialog já trata via Radix, mas garantia extra)
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const goTab = (tab: string) => {
    setOpen(false);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    // Quando troca de tab por palette, sempre vai pro /kaleidos
    navigate(`/kaleidos?${params.toString()}`);
  };

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const switchClient = (clientId: string) => {
    setOpen(false);
    const params = new URLSearchParams(searchParams);
    params.set("client", clientId);
    setSearchParams(params, { replace: false });
  };

  const visibleClients = useMemo(() => clientsList.slice(0, 12), [clientsList]);

  const openPlanningItem = (itemId: string) => {
    setOpen(false);
    const params = new URLSearchParams(searchParams);
    params.set("tab", "planning");
    params.set("openItem", itemId);
    navigate(`/kaleidos?${params.toString()}`);
  };

  const openClientLibrary = (clientId: string, _ref: string) => {
    setOpen(false);
    const params = new URLSearchParams(searchParams);
    params.set("tab", "library");
    params.set("client", clientId);
    navigate(`/kaleidos?${params.toString()}`);
  };

  const hasContentResults =
    searchEnabled &&
    (contentResults.planning.length +
      contentResults.references.length +
      contentResults.content.length >
      0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-xl overflow-hidden">
        {/* Title oculto para acessibilidade — Radix exige DialogTitle */}
        <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
        <Command shouldFilter={!searchEnabled}>
          <CommandInput
            placeholder="Busque conteúdo, clientes, ações ou navegação..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {searchEnabled ? "Nenhum resultado." : "Digite pra buscar conteúdo…"}
            </CommandEmpty>

            {hasContentResults && (
              <>
                {contentResults.planning.length > 0 && (
                  <CommandGroup heading={`Planejamento (${contentResults.planning.length})`}>
                    {contentResults.planning.map((p: any) => (
                      <CommandItem
                        key={`pl-${p.id}`}
                        value={`planning ${p.title} ${p.id}`}
                        onSelect={() => openPlanningItem(p.id)}
                      >
                        <Clipboard className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="truncate">{p.title}</span>
                        {p.status && (
                          <span className="ml-auto text-[10px] text-muted-foreground">{p.status}</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {contentResults.references.length > 0 && (
                  <CommandGroup heading={`Referências (${contentResults.references.length})`}>
                    {contentResults.references.map((r: any) => (
                      <CommandItem
                        key={`ref-${r.id}`}
                        value={`reference ${r.title} ${r.id}`}
                        onSelect={() => openClientLibrary(r.client_id, "references")}
                      >
                        <BookOpen className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="truncate">{r.title}</span>
                        {r.reference_type && (
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {r.reference_type}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {contentResults.content.length > 0 && (
                  <CommandGroup heading={`Conteúdos (${contentResults.content.length})`}>
                    {contentResults.content.map((c: any) => (
                      <CommandItem
                        key={`cn-${c.id}`}
                        value={`content ${c.title} ${c.id}`}
                        onSelect={() => openClientLibrary(c.client_id, "content")}
                      >
                        <FileText className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="truncate">{c.title}</span>
                        {c.content_type && (
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {c.content_type}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                <CommandSeparator />
              </>
            )}

            {visibleClients.length > 0 && (
              <>
                <CommandGroup heading="Clientes">
                  {visibleClients.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`cliente ${c.name}`}
                      onSelect={() => switchClient(c.id)}
                    >
                      {c.avatar_url ? (
                        <img
                          src={c.avatar_url}
                          alt=""
                          aria-hidden="true"
                          className="mr-2 h-5 w-5 rounded-md object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden="true"
                          className="mr-2 h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary"
                        >
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="truncate">{c.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup heading="Navegação">
              <CommandItem onSelect={() => goTab("home")}>
                <Home className="mr-2 h-4 w-4" aria-hidden="true" />
                Início
              </CommandItem>
              <CommandItem onSelect={() => goTab("assistant")}>
                <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
                kAI Chat
              </CommandItem>
              <CommandItem onSelect={() => goTab("planning")}>
                <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
                Planejamento
              </CommandItem>
              <CommandItem onSelect={() => goTab("tasks")}>
                <CheckSquare className="mr-2 h-4 w-4" aria-hidden="true" />
                Tarefas
              </CommandItem>
              <CommandItem onSelect={() => goTab("performance")}>
                <BarChart3 className="mr-2 h-4 w-4" aria-hidden="true" />
                Performance
              </CommandItem>
              <CommandItem onSelect={() => goTab("library")}>
                <Library className="mr-2 h-4 w-4" aria-hidden="true" />
                Biblioteca
              </CommandItem>
              <CommandItem onSelect={() => go("/kaleidos/clients")}>
                <Building2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Perfis (Clientes)
              </CommandItem>
              <CommandItem onSelect={() => goTab("automations")}>
                <Zap className="mr-2 h-4 w-4" aria-hidden="true" />
                Automações
              </CommandItem>
              <CommandItem onSelect={() => goTab("settings")}>
                <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                Configurações
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Viral">
              <CommandItem onSelect={() => goTab("viral-carrossel")}>
                <Twitter className="mr-2 h-4 w-4" aria-hidden="true" />
                Carrossel — Sequência Viral
              </CommandItem>
              <CommandItem onSelect={() => goTab("library")}>
                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                Biblioteca Viral
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Ações rápidas">
              <CommandItem onSelect={() => go("/kaleidos/clients?action=new")}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Novo cliente
              </CommandItem>
              <CommandItem onSelect={() => goTab("viral-carrossel")}>
                <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                Novo carrossel
              </CommandItem>
              <CommandItem onSelect={() => goTab("planning")}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Novo item de planejamento
                <CommandShortcut>N</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => goTab("tasks")}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Nova tarefa do time
              </CommandItem>
              <CommandItem onSelect={() => goTab("assistant")}>
                <ChevronRight className="mr-2 h-4 w-4" aria-hidden="true" />
                Abrir KAI Chat
              </CommandItem>
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/60 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted/50 font-mono">
                ↑↓
              </kbd>
              navegar
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted/50 font-mono ml-2">
                ↵
              </kbd>
              selecionar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted/50 font-mono">
                {modKey} K
              </kbd>
              alternar
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
