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
import { FileText, Lightbulb, Library } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { apiInvoke } from "@/lib/apiInvoke";
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
  /** @deprecated Reels Viral removido do KAI em 2026-05-16. Mantido pra compat. */
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
  showReel = false,
  showIdea = true,
  showLibrary = true,
  size = "sm",
  direction = "row",
}: CrossAppActionsProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setPending = useViralContext((s) => s.setPendingBriefing);

  async function handleAction(
    target: "carrossel" | "idea" | "library",
  ) {
    if (target === "idea") {
      // Persiste como planning_item type='idea' via handler. Sem cliente,
      // a "Biblioteca global" antiga (library_ideas) não existe como tabela
      // no schema atual — caímos no toast informativo.
      if (clientId) {
        const workspaceId = await resolveWorkspaceId(clientId);
        if (!workspaceId) {
          toast.error("Cliente sem workspace — não foi possível salvar");
          return;
        }
        // P0 fix audit 2026-05-17: troca supabase.from('planning_items').insert
        // por /api/planning-items-create (handler resolve column id 'idea',
        // valida assertClientAccess + assertWorkspaceAccess, força created_by).
        const ideaColumnId = await resolveIdeaColumnId(workspaceId);
        const { error } = await apiInvoke("planning-items-create", {
          body: {
            client_id: clientId,
            workspace_id: workspaceId,
            column_id: ideaColumnId,
            title: (topic ?? "Ideia").slice(0, 200),
            content: briefing ?? "",
            status: "idea",
            content_type: "social_post",
            metadata: { source, source_url: url, ...(metadata ?? {}) },
          },
        });
        if (error) {
          toast.error("Erro ao salvar ideia", { description: error.message });
        } else {
          toast.success("💡 Ideia adicionada ao Planejamento", {
            description: topic?.slice(0, 80),
          });
        }
      } else {
        // Sem cliente — tabela library_ideas global não existe no schema.
        // Informar o user pra selecionar um cliente.
        toast.info("Selecione um cliente pra salvar a ideia no planejamento.");
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

      // Idempotência por source_url (best-effort SELECT — RLS ja filtra por
      // cliente acessível, ok deixar via PostgREST).
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

      // P0 fix audit 2026-05-17: troca supabase.from('client_reference_library')
      // por /api/save-to-library (destination=references). Handler valida
      // workspace member + sanitiza metadata.
      const allowedFormats = new Set(["carousel", "reel", "static", "tweet", "thread", "newsletter", "article", "email"]);
      const formatHint = allowedFormats.has(fmt) ? fmt : "static";
      const { error } = await apiInvoke("save-to-library", {
        body: {
          client_id: clientId,
          title: (topic ?? "Referência").slice(0, 200),
          content: briefing ?? "",
          source_url: url,
          thumbnail_url: (meta.thumbnail_url as string | undefined) ?? null,
          destination: "references",
          format: formatHint,
          metadata: {
            source,
            platform,
            ...meta,
          },
        },
      });
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
    // 2026-05-16: branch "reels" removido (Reels Viral saiu do KAI).
    // Resta só "carrossel" — sempre vai pra viral-carrossel.
    if (target === "carrossel" && source === "sv") {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "viral-carrossel");
      navigate({ search: next.toString(), hash: "#/create/new" });
      return;
    }

    setPending({ source, topic, briefing, url, metadata });
    const next = new URLSearchParams(searchParams);
    next.set("tab", "viral-carrossel");
    navigate({ search: next.toString(), hash: "#/create/new" });
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
          className="kai-cross-action"
          onClick={() => handleAction("carrossel")}
        >
          <FileText className="h-3.5 w-3.5 mr-1" />
          Carrossel
        </Button>
      )}
      {/* 2026-05-16: botão "Reel" desabilitado (showReel default agora false). */}
      {showIdea && (
        <Button
          size={size}
          variant="ghost"
          className="kai-cross-action"
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
          className="kai-cross-action"
          onClick={() => handleAction("library")}
        >
          <Library className="h-3.5 w-3.5 mr-1" />
          Biblioteca
        </Button>
      )}
    </div>
  );
}
