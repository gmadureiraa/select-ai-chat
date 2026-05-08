/**
 * Tool `createRadarBrief` — gera briefing operacional do Radar Viral.
 * Chama o handler `generate-radar-brief` que combina sinais (notícias, IG,
 * TikTok, YouTube, Twitter, Threads, LinkedIn, posts top do cliente) e
 * produz narratives + hot_topics + carousel_ideas pro time de conteúdo.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';

interface CreateRadarBriefArgs {
  niche?: string;
  windowHours?: number;
  saveCarouselIdeas?: boolean;
}

interface CreateRadarBriefData {
  briefId: string | null;
  narrativesCount: number;
  hotTopicsCount: number;
  carouselIdeasCount: number;
}

export const createRadarBriefTool: RegisteredTool<
  CreateRadarBriefArgs,
  CreateRadarBriefData
> = {
  definition: {
    name: 'createRadarBrief',
    description:
      'Gera um briefing editorial do Radar Viral cruzando sinais reais das últimas 24h: notícias, posts virais (IG/TikTok/Twitter/Threads/LinkedIn) e conteúdo top do próprio cliente. Retorna narratives (2-5 narrativas dominantes), hot_topics (5-10 tópicos quentes) e carousel_ideas (3-5 com hook + ângulo). Use quando o usuário pedir: "rode o radar", "qual o briefing de hoje", "o que tá quente no nicho do cliente", "ideias pra postar agora". Salva em viral_radar_briefs.',
    parameters: {
      type: 'object',
      properties: {
        niche: {
          type: 'string',
          description:
            'Nicho/categoria opcional (ex: "cripto", "marketing", "fitness"). Se omitido, usa o nicho cadastrado do cliente.',
        },
        windowHours: {
          type: 'number',
          description:
            'Janela de tempo em horas pra olhar sinais. Default 24. Faixa válida: 6-72.',
        },
        saveCarouselIdeas: {
          type: 'boolean',
          description:
            'Se true (default), as carousel_ideas geradas viram entradas em library_ideas pra serem promovidas via Sequência Viral depois.',
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const niche = args.niche ? String(args.niche) : undefined;
    const windowHours =
      typeof args.windowHours === 'number' &&
      args.windowHours >= 6 &&
      args.windowHours <= 72
        ? Math.round(args.windowHours)
        : 24;
    const saveCarouselIdeas = args.saveCarouselIdeas !== false;

    console.log(
      `[createRadarBrief] clientId=${ctx.clientId} niche=${niche ?? '(client default)'} window=${windowHours}h`,
    );

    try {
      const res = await fetch(`${ctx.internalBaseUrl}/api/generate-radar-brief`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.accessToken}`,
        },
        body: JSON.stringify({
          clientId: ctx.clientId,
          niche,
          windowHours,
          saveCarouselIdeas,
          source: 'chat',
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          ok: false,
          error: `generate-radar-brief ${res.status}: ${errText.slice(0, 200)}`,
        };
      }

      const json: any = await res.json();
      if (!json?.ok && !json?.id && !json?.briefId) {
        return { ok: false, error: json?.error ?? 'Falha desconhecida na geração do briefing' };
      }

      const briefId: string | null = json.briefId ?? json.id ?? null;
      const narratives = (json.narratives ?? json.brief?.narratives ?? []) as Array<unknown>;
      const hotTopics = (json.hot_topics ?? json.brief?.hot_topics ?? []) as Array<unknown>;
      const carouselIdeas = (json.carousel_ideas ?? json.brief?.carousel_ideas ?? []) as Array<{
        title?: string;
        hook?: string;
      }>;

      const summary = narratives
        .slice(0, 3)
        .map((n: any, i: number) => `${i + 1}. ${n.title ?? ''}`)
        .filter(Boolean)
        .join('\n');

      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: null,
        type: 'draft',
        status: 'done',
        data: {
          kind: 'draft',
          clientId: ctx.clientId,
          platform: 'instagram',
          format: 'radar_brief',
          title: `Briefing Radar — ${new Date().toLocaleDateString('pt-BR')}`,
          body: summary || 'Briefing pronto. Abra no Radar pra ver narratives + hot topics + ideias.',
          briefing: niche ?? 'briefing diário',
          viralRadarBriefId: briefId,
        } as Record<string, unknown>,
        requires_approval: false,
        available_actions: [
          {
            id: 'open_in_radar',
            label: 'Abrir no Radar Viral',
            variant: 'primary',
            client_action: 'edit',
          },
        ],
      };

      return {
        ok: true,
        data: {
          briefId,
          narrativesCount: Array.isArray(narratives) ? narratives.length : 0,
          hotTopicsCount: Array.isArray(hotTopics) ? hotTopics.length : 0,
          carouselIdeasCount: Array.isArray(carouselIdeas) ? carouselIdeas.length : 0,
        },
        card,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[createRadarBrief] error:', err);
      return { ok: false, error: msg };
    }
  },
};
