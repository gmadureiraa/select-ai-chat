import { useState, useMemo } from "react";
import { Sparkles, Search, X } from "lucide-react";
import {
  FileText,
  Layers,
  Film,
  CalendarPlus,
  Clock,
  CheckSquare,
  PenLine,
  UserPlus,
  UserCog,
  Users,
  Library,
  Save,
  BookOpen,
  Workflow,
  ListTodo,
  ToggleRight,
  ListChecks,
  Radar,
  BarChart3,
  Send,
  Plug,
  Compass,
  Activity,
  FileSearch,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * KaiToolsTray
 *
 * Tray (Sheet lateral / gaveta inferior em mobile) que mostra todas as 26 tools
 * registradas no kai-simple-chat agrupadas por categoria. Cada tool tem:
 *   - ícone + nome amigável
 *   - descrição curta
 *   - exemplo de prompt clickable (popula o input do chat via onPickPrompt)
 *
 * Usado por KaiAssistantTab e GlobalKAIAssistant. O componente NÃO chama tool
 * direto — apenas sugere um prompt. O LLM no edge decide qual tool acionar
 * via ToolRegistry (ver `api/_lib/kai-chat-tools/registry.ts`).
 */

type ToolCategory =
  | "Conteúdo"
  | "Planejamento"
  | "Cliente"
  | "Biblioteca"
  | "Automações"
  | "Tarefas"
  | "Radar"
  | "Publicação";

interface ToolEntry {
  id: string;
  name: string;
  description: string;
  example: string;
  icon: React.ElementType;
  category: ToolCategory;
}

const TOOLS: ToolEntry[] = [
  // ── Conteúdo ────────────────────────────────────────────────────────────
  {
    id: "createContent",
    name: "Criar conteúdo",
    description: "Gera post, thread, carrossel, newsletter ou roteiro.",
    example: "Cria um post de Instagram sobre como cresci minha agência em 6 meses.",
    icon: FileText,
    category: "Conteúdo",
  },
  {
    id: "createViralCarousel",
    name: "Carrossel viral (Sequência)",
    description: "Carrossel completo com voz + imagens (template Futurista ou Twitter).",
    example: "Cria carrossel viral sobre 5 erros que matam um lançamento de SaaS.",
    icon: Layers,
    category: "Conteúdo",
  },
  {
    id: "analyzeViralReel",
    name: "Engenharia reversa de Reel",
    description: "Cola um link do Instagram e o KAI extrai estrutura, hooks e roteiro.",
    example: "Analisa esse reel: https://instagram.com/reel/...",
    icon: Film,
    category: "Conteúdo",
  },
  {
    id: "addToPlanning",
    name: "Adicionar ao planejamento",
    description: "Salva um conteúdo gerado direto no board de planning.",
    example: "Salva esse post no planejamento como rascunho pra sexta.",
    icon: CalendarPlus,
    category: "Conteúdo",
  },
  {
    id: "getPlanningItem",
    name: "Pegar rascunho/post",
    description: "Busca um post específico do planejamento (ID, último, ou último de status).",
    example: "Pega o último rascunho que criei agora.",
    icon: FileSearch,
    category: "Conteúdo",
  },

  // ── Planejamento ────────────────────────────────────────────────────────
  {
    id: "scheduleFor",
    name: "Agendar publicação",
    description: "Coloca data e hora num conteúdo já criado.",
    example: "Agenda esse carrossel pra quinta às 18h.",
    icon: Clock,
    category: "Planejamento",
  },
  {
    id: "listPendingApprovals",
    name: "Listar aprovações pendentes",
    description: "Mostra tudo aguardando review/aprovação.",
    example: "O que tá esperando aprovação?",
    icon: CheckSquare,
    category: "Planejamento",
  },
  {
    id: "editContent",
    name: "Editar conteúdo",
    description: "Reescreve, ajusta tom ou muda estrutura de um conteúdo existente.",
    example: "Reescreve o último post deixando mais casual.",
    icon: PenLine,
    category: "Planejamento",
  },

  // ── Cliente ─────────────────────────────────────────────────────────────
  {
    id: "createClient",
    name: "Criar cliente",
    description: "Adiciona novo cliente ao workspace.",
    example: "Cria um cliente novo: Acme Corp, nicho B2B SaaS.",
    icon: UserPlus,
    category: "Cliente",
  },
  {
    id: "updateClient",
    name: "Atualizar cliente",
    description: "Edita briefing, posicionamento, redes ou dados do cliente.",
    example: "Atualiza o handle do Instagram do cliente atual pra @novohandle.",
    icon: UserCog,
    category: "Cliente",
  },
  {
    id: "listClients",
    name: "Listar clientes",
    description: "Mostra todos os clientes do workspace.",
    example: "Lista todos os clientes ativos.",
    icon: Users,
    category: "Cliente",
  },
  {
    id: "getClientContext",
    name: "Contexto do cliente",
    description: "Carrega briefing, voice, exemplos e referências do cliente.",
    example: "Me dá o contexto completo do cliente atual.",
    icon: Compass,
    category: "Cliente",
  },

  // ── Biblioteca ──────────────────────────────────────────────────────────
  {
    id: "saveToLibrary",
    name: "Salvar na biblioteca",
    description: "Arquiva uma referência, post inspiração ou ideia pra usar depois.",
    example: "Salva esse link como referência visual: https://...",
    icon: Save,
    category: "Biblioteca",
  },
  {
    id: "searchLibrary",
    name: "Buscar na biblioteca",
    description: "Procura conteúdos passados, drafts e exemplos.",
    example: "Acha aquele post sobre lançamento que escrevi mês passado.",
    icon: Library,
    category: "Biblioteca",
  },
  {
    id: "searchRefs",
    name: "Buscar referências",
    description: "Busca referências (links, swipes, exemplos) salvas pro cliente.",
    example: "Quais referências de copywriting eu tenho salvas?",
    icon: BookOpen,
    category: "Biblioteca",
  },

  // ── Automações ──────────────────────────────────────────────────────────
  {
    id: "createAutomation",
    name: "Criar automação",
    description: "Cria fluxo recorrente (ex: gerar newsletter toda sexta).",
    example: "Cria uma automação pra gerar 3 ideias de post toda segunda 9h.",
    icon: Workflow,
    category: "Automações",
  },
  {
    id: "listAutomations",
    name: "Listar automações",
    description: "Mostra todas as automações ativas e pausadas.",
    example: "Quais automações tô rodando?",
    icon: ListTodo,
    category: "Automações",
  },
  {
    id: "toggleAutomation",
    name: "Ativar/pausar automação",
    description: "Liga ou desliga uma automação existente.",
    example: "Pausa a automação de newsletter semanal.",
    icon: ToggleRight,
    category: "Automações",
  },

  // ── Tarefas ─────────────────────────────────────────────────────────────
  {
    id: "createTeamTask",
    name: "Criar tarefa pro time",
    description: "Adiciona task interna no board do time.",
    example: "Cria tarefa pro Caio: revisar carrossel da Defiverso até sexta.",
    icon: ListChecks,
    category: "Tarefas",
  },

  // ── Radar ───────────────────────────────────────────────────────────────
  {
    id: "createRadarBrief",
    name: "Briefing de Radar",
    description: "Cria briefing diário com hooks virais do Radar Viral.",
    example: "Monta briefing do Radar pra hoje, foco em IA + marketing.",
    icon: Radar,
    category: "Radar",
  },
  {
    id: "getMetrics",
    name: "Métricas do cliente",
    description: "Performance dos posts publicados nos últimos 30 dias.",
    example: "Como tá a performance do cliente atual no último mês?",
    icon: BarChart3,
    category: "Radar",
  },
  {
    id: "getRecentPerformance",
    name: "Performance recente",
    description: "Atalho rápido pra performance da semana (sem chart, mais rápido).",
    example: "Como tá a performance dessa semana?",
    icon: Activity,
    category: "Radar",
  },

  // ── Publicação ──────────────────────────────────────────────────────────
  {
    id: "publishNow",
    name: "Publicar agora",
    description: "Publica direto na plataforma conectada (IG, X, LinkedIn).",
    example: "Publica esse post no LinkedIn agora.",
    icon: Send,
    category: "Publicação",
  },
  {
    id: "connectAccount",
    name: "Conectar conta",
    description: "Conecta Instagram, X ou LinkedIn ao workspace.",
    example: "Conecta minha conta do Instagram.",
    icon: Plug,
    category: "Publicação",
  },
];

const CATEGORY_ORDER: ToolCategory[] = [
  "Conteúdo",
  "Planejamento",
  "Cliente",
  "Biblioteca",
  "Automações",
  "Tarefas",
  "Radar",
  "Publicação",
];

interface KaiToolsTrayProps {
  /** Callback quando o user clica num exemplo de prompt — popula o input do chat. */
  onPickPrompt: (prompt: string) => void;
  /** Variante visual do botão trigger. `floating` posiciona absoluto no canto. */
  variant?: "inline" | "floating";
  /** Classes adicionais pro trigger. */
  className?: string;
}

export function KaiToolsTray({ onPickPrompt, variant = "inline", className }: KaiToolsTrayProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const isMobile = useIsMobile();

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? TOOLS.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.example.toLowerCase().includes(q),
        )
      : TOOLS;

    const map = new Map<ToolCategory, ToolEntry[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const t of filtered) {
      map.get(t.category)?.push(t);
    }
    return Array.from(map.entries()).filter(([, arr]) => arr.length > 0);
  }, [search]);

  const handlePick = (prompt: string) => {
    onPickPrompt(prompt);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "gap-1.5 h-8 px-2.5 text-xs font-medium border-border/60 bg-background/80 backdrop-blur",
            "hover:bg-accent hover:text-accent-foreground hover:border-primary/40",
            "transition-colors",
            variant === "floating" && "shadow-sm",
            className,
          )}
          aria-label="O que o KAI pode fazer"
          title="O que o KAI pode fazer"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>O que posso fazer?</span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "p-0 flex flex-col gap-0",
          isMobile ? "h-[85vh] max-h-[85vh] rounded-t-2xl" : "w-full sm:max-w-md",
        )}
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 space-y-1.5 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            O que o KAI pode fazer
          </SheetTitle>
          <SheetDescription className="text-xs">
            26 capacidades organizadas. Clique num exemplo pra colar no chat.
          </SheetDescription>
          <div className="relative pt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/4 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por capacidade ou exemplo..."
              className="pl-8 h-9 text-sm"
              autoFocus={!isMobile}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 translate-y-[-15%] p-1 rounded hover:bg-muted text-muted-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-5">
            {grouped.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhuma capacidade combina com "{search}".
              </div>
            ) : (
              grouped.map(([category, tools]) => (
                <section key={category} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {category}
                    </h3>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {tools.length}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {tools.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => handlePick(tool.example)}
                          className={cn(
                            "w-full text-left rounded-lg border border-border/60 bg-background",
                            "px-3 py-2.5 transition-colors",
                            "hover:bg-accent/40 hover:border-primary/40",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 h-7 w-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                              <Icon className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium leading-tight text-foreground">
                                {tool.name}
                              </div>
                              <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5">
                                {tool.description}
                              </p>
                              <p className="text-[11px] mt-1.5 italic text-foreground/70 leading-snug line-clamp-2">
                                "{tool.example}"
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border/60 px-5 py-3 text-[10.5px] text-muted-foreground bg-muted/30">
          Dica: o KAI escolhe a ferramenta certa automaticamente quando você fala em linguagem natural.
        </div>
      </SheetContent>
    </Sheet>
  );
}
