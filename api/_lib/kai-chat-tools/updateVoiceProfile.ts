/**
 * Tool `updateVoiceProfile` — wrapper sobre updateClient pra mexer só no
 * voice_profile (tom, persona, pillars, do/don't). Faz merge raso por
 * padrão.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool } from './types.js';
import { buildToolFetchHeaders } from './internal-headers.js';
import { query } from '../db.js';
import { assertToolClientAccess } from './tool-access.js';

function sanitizePollutionKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sanitizePollutionKeys) as unknown as T;
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = sanitizePollutionKeys(v);
  }
  return out as unknown as T;
}

interface UpdateVoiceProfileArgs {
  client_id?: string;
  tone?: string;
  persona?: string;
  pillars?: string[];
  use?: string[];
  avoid?: string[];
  examples?: string[];
  signature_phrases?: string[];
  voice_profile?: Record<string, unknown>;
  merge?: boolean;
}

interface UpdateVoiceProfileData {
  clientId: string;
  fieldsUpdated: string[];
}

export const updateVoiceProfileTool: RegisteredTool<
  UpdateVoiceProfileArgs,
  UpdateVoiceProfileData
> = {
  definition: {
    name: 'updateVoiceProfile',
    description:
      'Atualiza voice profile do cliente (tom, persona, pilares, do/dont). Use quando o usuário pedir "muda o tom pra mais informal", "adiciona pilar X", "salva isso como persona", "acrescenta na lista de palavras proibidas". Faz merge raso por padrão.',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'UUID do cliente. Default: cliente atual.' },
        tone: {
          type: 'string',
          description: 'Tom geral em uma frase (ex: "informal, direto, analítico, PT-BR").',
        },
        persona: {
          type: 'string',
          description: 'Descrição da persona/voz (1-3 parágrafos).',
        },
        pillars: {
          type: 'array',
          items: { type: 'string' },
          description: 'Pilares de conteúdo (ex: ["marketing", "IA", "automação"]).',
        },
        use: {
          type: 'array',
          items: { type: 'string' },
          description: 'Palavras/expressões a USAR.',
        },
        avoid: {
          type: 'array',
          items: { type: 'string' },
          description: 'Palavras/expressões a EVITAR.',
        },
        examples: {
          type: 'array',
          items: { type: 'string' },
          description: 'Exemplos de frases representativas da voz.',
        },
        signature_phrases: {
          type: 'array',
          items: { type: 'string' },
          description: 'Bordões/expressões características.',
        },
        voice_profile: {
          type: 'object',
          description: 'Object com qualquer outro campo extra do voice_profile.',
        },
        merge: {
          type: 'boolean',
          description: 'true (default) = merge raso. false = substitui completo.',
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const clientId = String(args.client_id ?? ctx.clientId ?? '').trim();
    if (!clientId) {
      return { ok: false, error: 'client_id obrigatório (nenhum cliente selecionado)' };
    }

    // SECURITY: validar acesso ANTES de mutate.
    const guard = await assertToolClientAccess(ctx, clientId);
    if (!guard.ok) return { ok: false, error: guard.error };

    const merge = args.merge ?? true;

    // Sanitiza args (evita prototype pollution via __proto__/constructor).
    const sanitizedArgs = sanitizePollutionKeys(args);

    // Monta voice_profile a partir dos args
    const incoming: Record<string, unknown> = { ...(sanitizedArgs.voice_profile ?? {}) };
    if (sanitizedArgs.tone !== undefined) incoming.tone = sanitizedArgs.tone;
    if (sanitizedArgs.persona !== undefined) incoming.persona = sanitizedArgs.persona;
    if (sanitizedArgs.pillars !== undefined) incoming.pillars = sanitizedArgs.pillars;
    if (sanitizedArgs.use !== undefined) incoming.use = sanitizedArgs.use;
    if (sanitizedArgs.avoid !== undefined) incoming.avoid = sanitizedArgs.avoid;
    if (sanitizedArgs.examples !== undefined) incoming.examples = sanitizedArgs.examples;
    if (sanitizedArgs.signature_phrases !== undefined) {
      incoming.signature_phrases = sanitizedArgs.signature_phrases;
    }

    if (Object.keys(incoming).length === 0) {
      return { ok: false, error: 'Passe ao menos um campo do voice_profile.' };
    }

    let newVoiceProfile: Record<string, unknown> = incoming;
    if (merge) {
      try {
        const rows = await query<{ voice_profile: Record<string, unknown> | null }>(
          `SELECT voice_profile FROM clients WHERE id = $1 LIMIT 1`,
          [clientId],
        );
        // Sanitiza current também (defesa contra dados antigos poluídos).
        const current = sanitizePollutionKeys(rows[0]?.voice_profile ?? {});
        newVoiceProfile = { ...current, ...incoming };
      } catch (err) {
        console.warn('[updateVoiceProfile] merge fetch failed, using replace:', err);
        newVoiceProfile = incoming;
      }
    }

    const res = await fetch(`${ctx.internalBaseUrl}/api/router?slug=client-update`, {
      method: 'POST',
      headers: buildToolFetchHeaders(ctx),
      body: JSON.stringify({
        client_id: clientId,
        voice_profile: newVoiceProfile,
      }),
    }).catch((err) => {
      console.error('[updateVoiceProfile] fetch failed:', err);
      return null;
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text().catch(() => '') : 'network';
      return { ok: false, error: `client-update: ${errText.slice(0, 200)}` };
    }

    const fieldsUpdated = Object.keys(incoming);
    const card: KAIActionCard = {
      id: newActionCardId(),
      planning_item_id: null,
      type: 'draft',
      status: 'done',
      data: {
        kind: 'draft',
        clientId,
        platform: 'client',
        format: 'client',
        title: 'Voice profile atualizado',
        body: `Campos atualizados: ${fieldsUpdated.join(', ')}${
          merge ? '\nModo: merge' : '\nModo: replace'
        }`,
        briefing: clientId,
      },
      requires_approval: false,
      available_actions: [
        {
          id: 'view_client',
          label: 'Ver cliente',
          variant: 'primary',
          client_action: 'edit',
        },
      ],
    };

    return { ok: true, data: { clientId, fieldsUpdated }, card };
  },
};
