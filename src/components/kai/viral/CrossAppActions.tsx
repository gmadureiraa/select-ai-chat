/**
 * CrossAppActions — botões reutilizáveis pra mover conteúdo entre os 3 viral
 * tabs (Radar / Reels / SV).
 *
 * Comportamento:
 *  - Clica "→ Carrossel" → seta `pendingBriefing` no Zustand + navega
 *    `?tab=viral-carrossel`. SV consome no useEffect inicial.
 *  - Clica "→ Reel" → mesmo padrão, navega pro `?tab=viral-reels-page`.
 *  - Clica "Ideia" → toast por enquanto. Fase C cria planning_item type='idea'.
 *
 * Estilo: usa `<Button>` da shadcn pra ficar consistente com o KAI quando o
 * componente é embedded em um card que já tem look KAI. Os 3 viral apps que
 * têm CSS isolado (sv-* / rv-* / rdv-*) podem renderizar este componente
 * dentro do scope sem leakage porque shadcn Button usa Tailwind classes
 * (não conflita com tokens dos viral apps).
 */

import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FileText, Lightbulb, Video, Library } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  useViralContext,
  type ViralBridgeSource,
} from "@/store/viral-context";

/**
 * Resolve workspace_id de um client a partir do clientId. Lookup rápido (1 row,
 * cacheável). Necessário porque planning_items + client_reference_library
 * têm RLS que valida workspace membership do auth.uid() — sem workspace_id
 * o INSERT silenciosamente falha em alguns ambientes (era bug 2026-05-09 no SV
 * que precisou da migration 0028 trigger SECURITY DEFINER).
 */
async function resolveWorkspaceId(clientId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("clients")
      .select("workspace_id")
      .eq("id", clientId)
      .maybeSingle();
    return (data as { workspace_id: string | null } | null)?.workspace_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve o column_id da coluna "Ideia" do workspace. PlanningBoard agrupa por
 * column_id (não só status), então sem isso o card vai pra `planning_items`
 * mas não aparece no Kanban.
 */
async function resolveIdeaColumnId(workspaceId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("kanban_columns")
      .select("id, column_type, position")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: true });
    if (!data || data.length === 0) return null;
    const ideaCol = (data as Array<{ id: string; column_type: string | null }>).find(
      (c) => c.column_type === "idea",
    );
    return ideaCol?.id ?? data[0].id ?? null;
  } catch {
    return null;
  }
}

interface CrossAppActionsProps {
  source: ViralBridgeSource;
  topic?: string;
  briefing?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  /** Cliente atual — necessário pra "Salvar na biblioteca" funcionar. */
  clientId?: string | null;
  showCarrossel?: boolean;
  showReel?: boolean;
  showIdea?: boolean;
  showLibrary?: boolean;
  /** Permite encolher o conjunto pra caber em cards densos. */
  size?: "sm" | "default";
  /** Layout: row (default) ou column (mobile-friendly em sidebars). */
  direction?: "row" | "column";
}

export function CrossAppActions({
  source,
  topic,
  briefing,
  url,
  metadata,
  clientId,
  showCarrossel = true,
  showReel = true,
  showIdea = true,
  showLibrary = true,
  size = "sm",
  direction = "row",
}: CrossAppActionsProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setPending = useViralContext((s) => s.setPendingBriefing);

  async function handleAction(
    target: "carrossel" | "reels" | "idea" | "library",
  ) {
    if (target === "idea") {
      // Persiste como planning_item type='idea' no cliente atual (se houver)
      // OU como library_idea global (escopo workspace) se não tiver cliente.
      if (clientId) {
        const workspaceId = await resolveWorkspaceId(clientId);
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) {
          toast.error("Sem usuário autenticado");
          return;
        }
        // Resolve column "Ideia" pra o card aparecer no Kanban (PlanningBoard
        // agrupa por column_id). Sem isso, o item fica órfão no DB.
        const ideaColumnId = workspaceId
          ? await resolveIdeaColumnId(workspaceId)
          : null;
        const { error } = await supabase.from("planning_items").insert({
          client_id: clientId,
          workspace_id: workspaceId,
          column_id: ideaColumnId,
          title: (topic ?? "Ideia").slice(0, 200),
          content: briefing ?? "",
          status: "idea",
          content_type: "social_post" as never,
          created_by: u.user.id,
          metadata: { source, source_url: url, ...(metadata ?? {}) } as never,
        } as never);
        if (error) {
          toast.error("Erro ao salvar ideia", { description: error.message });
        } else {
          toast.success("💡 Ideia adicionada ao Planejamento", {
            description: topic?.slice(0, 80),
          });
        }
      } else {
        // Sem cliente — salva em library_ideas (global, fica sem cliente)
        const { error } = await supabase.from("library_ideas" as never).insert({
          title: (topic ?? "Ideia").slice(0, 200),
          description: briefing ?? "",
          source_url: url,
          source_handle: (metadata?.author as string | undefined) ?? null,
          tags: ["radar", source],
          is_global: true,
        } as never);
        if (error) {
          toast.error("Erro ao salvar ideia", { description: error.message });
        } else {
          toast.success("💡 Ideia adicionada à Biblioteca global");
        }
      }
      return;
    }

    if (target === "library") {
      if (!clientId) {
        toast.error("Selecione um cliente pra salvar na biblioteca dele");
        return;
      }
      // Bloqueia inserts sem conteúdo útil pra evitar lixo na biblioteca
      // (vinha acontecendo quando user clicava sem briefing/topic preenchidos
      // num card de Radar com `signals` vazios).
      if (!topic && !briefing && !url) {
        toast.error("Sem conteúdo pra salvar (topic/briefing/url vazios)");
        return;
      }
      const meta = (metadata ?? {}) as Record<string, unknown>;
      const fmt = (meta.format as string | undefined) ?? "static";
      const platform = (meta.platform as string | undefined) ?? null;
      const contentTypeMap: Record<string, string> = {
        carousel: "carousel",
        reel: "reel_script",
        static: "static_image",
        tweet: "tweet",
        thread: "thread",
        newsletter: "newsletter",
        article: "blog_post",
      };
      const ct = contentTypeMap[fmt] ?? "social_post";

      // Idempotência por source_url (best-effort): se já existe ref desse cliente
      // com a mesma URL, mostra toast info em vez de duplicar.
      if (url) {
        const { data: existing } = await supabase
          .from("client_reference_library")
          .select("id")
          .eq("client_id", clientId)
          .eq("source_url", url)
          .limit(1)
          .maybeSingle();
        if (existing?.id) {
          toast.info("Já tá na biblioteca de refs do cliente.");
          return;
        }
      }

      const { error } = await supabase.from("client_reference_library").insert({
        client_id: clientId,
        title: (topic ?? "Referência").slice(0, 200),
        reference_type: "inspiration",
        content: briefing ?? "",
        source_url: url,
        thumbnail_url: (meta.thumbnail_url as string | undefined) ?? null,
        metadata: {
          source,
          format: fmt,
          platform,
          content_type: ct,
          ...meta,
        } as never,
      } as never);
      if (error) {
        toast.error("Erro ao salvar na biblioteca", { description: error.message });
      } else {
        toast.success("📚 Adicionado à biblioteca de refs do cliente");
      }
      return;
    }

    // Carrossel ou Reels — bridge via Zustand + navega.
    // SV usa hash router interno (#/create/new). Sem o hash, default cai em
    // <CarouselsPage> e o user não vê o briefing pendente. Forçamos o hash
    // direto pra abrir o flow de criação. Reels não tem hash router interno —
    // só `?tab=` basta.
    //
    // Anti-loop: se source === target já (ex: clicou "→ Carrossel" dentro do
    // próprio SV), não bridgeia nem navega — só pula o briefing pra um novo
    // create silencioso. Evita o useEffect do create-new processar o mesmo
    // payload em loop.
    if (
      (target === "carrossel" && source === "sv") ||
      (target === "reels" && source === "reels")
    ) {
      // Mesma tab, navegamos só pro flow de criação dentro dela.
      const next = new URLSearchParams(searchParams);
      if (target === "carrossel") {
        next.set("tab", "viral-carrossel");
        navigate({ search: next.toString(), hash: "#/create/new" });
      } else {
        next.set("tab", "viral-reels-page");
        navigate({ search: next.toString() });
      }
      return;
    }

    setPending({ source, topic, briefing, url, metadata });
    const tab =
      target === "carrossel" ? "viral-carrossel" : "viral-reels-page";
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    if (target === "carrossel") {
      navigate({ search: next.toString(), hash: "#/create/new" });
    } else {
      navigate({ search: next.toString() });
    }
  }

  const wrapperClass =
    direction === "column"
      ? "flex flex-col gap-1.5"
      : "flex flex-wrap items-center gap-2";

  return (
    <div className={wrapperClass}>
      {showCarrossel && (
        <Button
          size={size}
          variant="outline"
          onClick={() => handleAction("carrossel")}
        >
          <FileText className="h-3.5 w-3.5 mr-1" />
          Carrossel
        </Button>
      )}
      {showReel && (
        <Button
          size={size}
          variant="outline"
          onClick={() => handleAction("reels")}
        >
          <Video className="h-3.5 w-3.5 mr-1" />
          Reel
        </Button>
      )}
      {showIdea && (
        <Button
          size={size}
          variant="ghost"
          onClick={() => handleAction("idea")}
        >
          <Lightbulb className="h-3.5 w-3.5 mr-1" />
          Ideia
        </Button>
      )}
      {showLibrary && (
        <Button
          size={size}
          variant="ghost"
          onClick={() => handleAction("library")}
        >
          <Library className="h-3.5 w-3.5 mr-1" />
          Biblioteca
        </Button>
      )}
    </div>
  );
}
