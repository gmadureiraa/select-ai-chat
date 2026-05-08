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
import { FileText, Lightbulb, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  showCarrossel?: boolean;
  showReel?: boolean;
  showIdea?: boolean;
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
  showCarrossel = true,
  showReel = true,
  showIdea = true,
  size = "sm",
  direction = "row",
}: CrossAppActionsProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setPending = useViralContext((s) => s.setPendingBriefing);

  function handleAction(target: "carrossel" | "reels" | "idea") {
    if (target === "idea") {
      // TODO Fase C — criar planning_item type='idea' no backend.
      // Por enquanto só feedback visual pra Gabriel saber que o botão tá ali.
      toast.success("Ideia salva (fase C cria planning_item).", {
        description: topic ? topic.slice(0, 80) : undefined,
      });
      return;
    }

    setPending({ source, topic, briefing, url, metadata });

    const tab =
      target === "carrossel" ? "viral-carrossel" : "viral-reels-page";
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    // Mantém o cliente atual selecionado — Kai.tsx lê `?tab=` mas client_id
    // vem do ClientSelector global, então só trocar tab é suficiente.
    navigate({ search: next.toString() });
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
    </div>
  );
}
