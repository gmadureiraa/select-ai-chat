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
        const { error } = await supabase.from("planning_items").insert({
          client_id: clientId,
          title: (topic ?? "Ideia").slice(0, 200),
          content: briefing ?? "",
          status: "idea",
          content_type: "social_post" as never,
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
