/**
 * Tool `analyzeViralReel` — engenharia reversa de Reel viral.
 * Chama o handler `adapt-viral-reel` que baixa o vídeo via Apify, manda pro
 * Gemini Flash com inlineData e produz analysis + script novo adaptado ao
 * briefing do cliente.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';

interface AnalyzeViralReelArgs {
  referenceUrl: string;
  tema: string;
  objetivo: string;
  cta: string;
  persona?: string;
  nicho?: string;
  addToPlanning?: boolean;
}

interface AnalyzeViralReelData {
  reelId: string | null;
  planningItemId: string | null;
  hookText: string | null;
  scenesCount: number;
}

export const analyzeViralReelTool: RegisteredTool<
  AnalyzeViralReelArgs,
  AnalyzeViralReelData
> = {
  definition: {
    name: 'analyzeViralReel',
    description:
      'Analisa um Reel viral existente do Instagram e gera um Reel NOVO replicando a estrutura narrativa do original mas com o conteúdo adaptado ao briefing do cliente. Use quando o usuário pedir: "analisa esse reel", "engenharia reversa desse vídeo", "adapta esse reel pra meu cliente", e fornecer uma URL do Instagram. Resultado: análise estrutural + roteiro cena-a-cena + b-roll graváveis. Salva em viral_reels e opcionalmente cria card no Planejamento.',
    parameters: {
      type: 'object',
      properties: {
        referenceUrl: {
          type: 'string',
          description:
            'URL do Reel do Instagram a analisar (ex: https://www.instagram.com/reel/ABC123/). OBRIGATÓRIO.',
        },
        tema: {
          type: 'string',
          description:
            'Tema/assunto do reel novo adaptado (ex: "como organizar finanças pessoais com Bitcoin").',
        },
        objetivo: {
          type: 'string',
          description:
            'Objetivo de negócio (ex: "atrair leads pra newsletter", "engajamento", "vender curso").',
        },
        cta: {
          type: 'string',
          description:
            'CTA explícito do reel novo (ex: "comenta NEWS pra receber", "link na bio").',
        },
        persona: {
          type: 'string',
          description: 'Persona alvo opcional (ex: "investidor iniciante PJ").',
        },
        nicho: {
          type: 'string',
          description: 'Nicho/categoria opcional (ex: "cripto", "finanças pessoais").',
        },
        addToPlanning: {
          type: 'boolean',
          description:
            'Se true (default), cria card no Planejamento. Use false só se o usuário pedir explicitamente "só salva, não joga no planejamento".',
        },
      },
      required: ['referenceUrl', 'tema', 'objetivo', 'cta'],
    },
  },

  handler: async (args, ctx) => {
    const referenceUrl = String(args.referenceUrl ?? '').trim();
    const tema = String(args.tema ?? '').trim();
    const objetivo = String(args.objetivo ?? '').trim();
    const cta = String(args.cta ?? '').trim();

    if (!referenceUrl || !tema || !objetivo || !cta) {
      return {
        ok: false,
        error: 'referenceUrl, tema, objetivo e cta são obrigatórios',
      };
    }

    if (!/instagram\.com\/(reel|p)\//i.test(referenceUrl)) {
      return {
        ok: false,
        error: 'referenceUrl precisa ser uma URL de Reel/Post do Instagram',
      };
    }

    const persona = args.persona ? String(args.persona) : undefined;
    const nicho = args.nicho ? String(args.nicho) : undefined;
    const addToPlanning = args.addToPlanning !== false;

    console.log(
      `[analyzeViralReel] clientId=${ctx.clientId} referenceUrl="${referenceUrl}" tema="${tema.slice(0, 60)}"`,
    );

    try {
      const res = await fetch(`${ctx.internalBaseUrl}/api/adapt-viral-reel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.accessToken}`,
        },
        body: JSON.stringify({
          clientId: ctx.clientId,
          referenceUrl,
          tema,
          objetivo,
          cta,
          persona,
          nicho,
          persistAs: addToPlanning ? 'both' : 'reel',
          source: 'chat',
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          ok: false,
          error: `adapt-viral-reel ${res.status}: ${errText.slice(0, 200)}`,
        };
      }

      const json: any = await res.json();
      if (!json?.ok && !json?.id && !json?.reelId) {
        return { ok: false, error: json?.error ?? 'Falha desconhecida na análise' };
      }

      const reelId: string | null = json.reelId ?? json.id ?? null;
      const planningItemId: string | null = json.planningItemId ?? null;
      const script = json.script ?? null;
      const analysis = json.analysis ?? null;
      const hookText: string | null = script?.hook ?? analysis?.estrutura?.hook?.texto ?? null;
      const scenes = (script?.scenes ?? []) as Array<unknown>;

      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: planningItemId,
        type: 'draft',
        status: 'done',
        data: {
          kind: 'draft',
          clientId: ctx.clientId,
          platform: 'instagram',
          format: 'viral_reel',
          title: script?.titulo ?? tema.slice(0, 60),
          body: script?.roteiroCompleto ?? hookText ?? '',
          briefing: tema,
          viralReelId: reelId,
        },
        requires_approval: false,
        available_actions: [
          {
            id: 'open_in_reels',
            label: 'Abrir no Reels Viral',
            variant: 'primary',
            client_action: 'edit',
          },
          ...(planningItemId
            ? [
                {
                  id: 'view_in_planning',
                  label: 'Ver no Planejamento',
                  variant: 'secondary' as const,
                  client_action: 'edit' as const,
                },
              ]
            : []),
        ],
      };

      return {
        ok: true,
        data: {
          reelId,
          planningItemId,
          hookText,
          scenesCount: Array.isArray(scenes) ? scenes.length : 0,
        },
        card,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[analyzeViralReel] error:', err);
      return { ok: false, error: msg };
    }
  },
};
