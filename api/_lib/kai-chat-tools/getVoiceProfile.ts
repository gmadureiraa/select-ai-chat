/**
 * Tool `getVoiceProfile` — retorna voice profile estruturado do cliente.
 *
 * Lê `clients.voice_profile` JSONB (shape canônico:
 *   {"tone": "...", "use": ["..."], "avoid": ["..."], "persona": "...", "pillars": [...]})
 * + `clients.identity_guide` (texto longo) + `clients.content_guidelines` (texto curto).
 *
 * Use quando o user perguntar "qual o tom de voz?", "como falar pelo cliente?",
 * "evitar o quê?", "pilares de conteúdo?", "persona do cliente?".
 *
 * Diferente de `getClientContext` (que retorna tudo resumido), esse foca apenas
 * em voice/tom/guidelines com formato estruturado e sem trunc.
 */
import type { RegisteredTool } from './types.js';
import { queryOne } from '../db.js';
import { assertToolClientAccess } from './tool-access.js';

interface GetVoiceProfileArgs {
  client_id?: string;
}

interface VoiceProfileStructured {
  tone: string | null;
  persona: string | null;
  use: string[];
  avoid: string[];
  pillars: unknown[];
  raw: Record<string, unknown>;
}

interface GetVoiceProfileData {
  clientId: string;
  clientName: string | null;
  voiceProfile: VoiceProfileStructured;
  identityGuide: string | null;
  contentGuidelines: string | null;
  hasVoiceProfile: boolean;
}

const MAX_IDENTITY_GUIDE = 6000;

function asStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function asStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function clip(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  if (t.length <= max) return t;
  return `${t.slice(0, max)}... [truncado, ${t.length} chars no total]`;
}

export const getVoiceProfileTool: RegisteredTool<GetVoiceProfileArgs, GetVoiceProfileData> = {
  definition: {
    name: 'getVoiceProfile',
    description:
      "Retorna voice profile estruturado do cliente: tone, persona, listas use/avoid, pilares de conteúdo, identity_guide e content_guidelines. Use quando o user perguntar sobre tom de voz, persona, o que usar/evitar, pilares, guidelines editoriais.",
    parameters: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'UUID do cliente. Default: cliente atual.',
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const clientId = String(args.client_id ?? ctx.clientId ?? '').trim();
    if (!clientId) {
      return { ok: false, error: 'client_id obrigatório (nenhum cliente selecionado).' };
    }

    // SECURITY: voice_profile contém estratégia editorial proprietária
    // (palavras-chave, persona, do/dont). Validar acesso antes.
    const guard = await assertToolClientAccess(ctx, clientId);
    if (!guard.ok) return { ok: false, error: guard.error };

    try {
      const c = await queryOne<{
        name: string | null;
        voice_profile: unknown;
        identity_guide: string | null;
        content_guidelines: string | null;
      }>(
        `SELECT name, voice_profile, identity_guide, content_guidelines
           FROM clients WHERE id = $1 LIMIT 1`,
        [clientId],
      );
      if (!c) return { ok: false, error: 'Cliente não encontrado.' };

      const raw =
        c.voice_profile && typeof c.voice_profile === 'object' && !Array.isArray(c.voice_profile)
          ? (c.voice_profile as Record<string, unknown>)
          : {};

      const voiceProfile: VoiceProfileStructured = {
        tone: asStr(raw.tone),
        persona: asStr(raw.persona),
        use: asStrArr(raw.use),
        avoid: asStrArr(raw.avoid),
        pillars: Array.isArray(raw.pillars) ? raw.pillars : [],
        raw,
      };

      const hasVoiceProfile =
        !!voiceProfile.tone ||
        !!voiceProfile.persona ||
        voiceProfile.use.length > 0 ||
        voiceProfile.avoid.length > 0 ||
        voiceProfile.pillars.length > 0;

      console.log(
        `[getVoiceProfile] client=${clientId} hasProfile=${hasVoiceProfile} tone=${!!voiceProfile.tone} use=${voiceProfile.use.length} avoid=${voiceProfile.avoid.length}`,
      );

      return {
        ok: true,
        data: {
          clientId,
          clientName: c.name ?? null,
          voiceProfile,
          identityGuide: clip(c.identity_guide, MAX_IDENTITY_GUIDE),
          contentGuidelines: c.content_guidelines ?? null,
          hasVoiceProfile,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getVoiceProfile] error:', err);
      return { ok: false, error: message };
    }
  },
};
