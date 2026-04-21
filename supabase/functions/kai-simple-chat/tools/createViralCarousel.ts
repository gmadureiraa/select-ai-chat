/**
 * Tool `createViralCarousel` — gera um carrossel estilo Twitter (8 slides)
 * pro cliente usando o motor centralizado `generate-viral-carousel`.
 *
 * Fluxo:
 *   1. LLM chama createViralCarousel({ briefing, tone?, addToPlanning? })
 *   2. Invocamos a edge function generate-viral-carousel
 *   3. Recebemos { carouselId, planningItemId, slides }
 *   4. Emitimos action_card type "draft" com kind "viral_carousel" pro chat
 *      renderizar uma bubble com mini-thumbs e atalhos.
 */

import {
  newActionCardId,
  type KAIActionCard,
} from "../../_shared/kai-stream.ts";
import type { RegisteredTool } from "./types.ts";

interface CreateViralCarouselArgs {
  briefing: string;
  tone?: string;
  addToPlanning?: boolean;
  title?: string;
}

interface CreateViralCarouselData {
  carouselId: string | null;
  planningItemId: string | null;
  slidesCount: number;
}

export const createViralCarouselTool: RegisteredTool<
  CreateViralCarouselArgs,
  CreateViralCarouselData
> = {
  definition: {
    name: "createViralCarousel",
    description:
      "Criar um carrossel estilo Twitter de 8 slides (formato 'Sequência Viral') sobre o tema dado. Use quando o usuário pede explicitamente: 'cria um carrossel viral', 'sequência viral', 'carrossel estilo tweet', 'thread visual'. NÃO use pra carrossel comum de Instagram — pra isso use createContent. Os slides já vêm com **negrito** estratégico e podem ser editados depois na aba Sequência Viral.",
    parameters: {
      type: "object",
      properties: {
        briefing: {
          type: "string",
          description:
            "Tema/ângulo do carrossel — quanto mais específico, melhor. Ex: 'os 5 erros que todo iniciante em Bitcoin comete + 1 hack sobre self-custody'.",
        },
        tone: {
          type: "string",
          description:
            "Tom desejado opcional (ex: direto, provocativo, técnico, didático). Se omitido, usa o tom da marca.",
        },
        addToPlanning: {
          type: "boolean",
          description:
            "Se true, também cria card no Planejamento (status draft). Default true. Use false só se o usuário pedir explicitamente 'só salva, não joga no planejamento'.",
        },
        title: {
          type: "string",
          description:
            "Título curto opcional pro carrossel/card. Se omitido, gera a partir do briefing.",
        },
      },
      required: ["briefing"],
    },
  },

  handler: async (args, ctx) => {
    const briefing = String(args.briefing ?? "").trim();
    if (!briefing) {
      return { ok: false, error: "briefing é obrigatório" };
    }
    const tone = args.tone ? String(args.tone) : undefined;
    const addToPlanning = args.addToPlanning !== false; // default true
    const title = args.title ? String(args.title) : undefined;

    console.log(
      `[createViralCarousel] clientId=${ctx.clientId} briefing="${briefing.slice(0, 60)}..." addToPlanning=${addToPlanning}`,
    );

    try {
      const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const res = await fetch(
        `${ctx.supabaseUrl}/functions/v1/generate-viral-carousel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ctx.accessToken}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            clientId: ctx.clientId,
            briefing,
            tone,
            title,
            persistAs: addToPlanning ? "both" : "carousel",
            source: "chat",
          }),
        },
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return {
          ok: false,
          error: `generate-viral-carousel ${res.status}: ${errText.slice(0, 200)}`,
        };
      }
      const json = await res.json();
      if (!json?.ok) {
        return { ok: false, error: json?.error ?? "Falha desconhecida na geração" };
      }

      const carouselId: string | null = json.carouselId ?? null;
      const planningItemId: string | null = json.planningItemId ?? null;
      const slides = (json.slides ?? []) as Array<{ body: string }>;

      // Card pra UI: usamos type "draft" (já suportado) com extras dentro de data
      // pra UI saber renderizar como carrossel.
      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: planningItemId,
        type: "draft",
        status: "done",
        data: {
          kind: "draft",
          clientId: ctx.clientId,
          platform: "instagram",
          format: "viral_carousel",
          title: title ?? briefing.slice(0, 60),
          body: slides.map((s, i) => `Slide ${i + 1}: ${s.body}`).join("\n\n"),
          briefing,
          // @ts-expect-error — campos extras pra renderizador especial reconhecer
          viralCarouselId: carouselId,
          // @ts-expect-error
          viralSlides: slides,
        },
        requires_approval: false,
        available_actions: [
          {
            id: "open_in_sequence",
            label: "Abrir no Sequência Viral",
            variant: "primary",
            client_action: "edit",
          },
          ...(planningItemId
            ? [{
                id: "view_in_planning",
                label: "Ver no Planejamento",
                variant: "secondary" as const,
                client_action: "edit" as const,
              }]
            : []),
        ],
      };

      return {
        ok: true,
        data: {
          carouselId,
          planningItemId,
          slidesCount: slides.length,
        },
        card,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[createViralCarousel] error:", err);
      return { ok: false, error: msg };
    }
  },
};
