/**
 * Tool `editContent` — edita/reescreve um rascunho via kai-content-agent.
 *
 * Refatorado 2026-05-16:
 *   - Usa mesmo pipeline de sanitização do createContent (parse-llm-response).
 *   - Fix bug do title: antes pegava `newContent.replace(/\s+/g, ' ').slice(0, 60)`
 *     que metia o conteúdo inteiro inline como título. Agora usa
 *     `extractTitleFromContent` que strippa markdown/labels e pega só a primeira
 *     linha útil.
 *   - Aplica platform-specific suffix do content-prompts (mesmo padrão do create).
 *   - Validation pós-geração via content-validator (sem retry — edição é
 *     instrução direta do user, ele revisa e re-edita se quiser).
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool, ToolExecutionContext } from './types.js';
import { query } from '../db.js';
import { buildToolFetchHeaders } from './internal-headers.js';
import {
  sanitizeLLMText,
  extractTitleFromContent,
} from '../parse-llm-response.js';
import {
  getFullClientContext,
  buildFewShotExamples,
  buildPlatformPreferenceHint,
} from '../shared/full-client-context.js';
import { resolvePlatformPromptBuilder } from '../content-prompts/index.js';
import { parseOutput, validateContent } from '../shared/content-validator.js';

interface EditContentArgs {
  planningItemId: string;
  instruction: string;
}

interface EditContentData {
  planningItemId: string;
  content: string;
  warnings?: string[];
  validation?: {
    valid: boolean;
    violations: number;
    warnings: number;
  };
}

interface InvokeEditArgs {
  ctx: ToolExecutionContext;
  clientId: string;
  currentContent: string;
  instruction: string;
  format: string;
  platform: string;
  additionalMaterial?: string;
}

async function invokeContentAgentForEdit(args: InvokeEditArgs): Promise<string> {
  const { ctx, clientId, currentContent, instruction, format, platform, additionalMaterial } = args;
  const editRequest =
    `Reescreva/edite o conteúdo abaixo seguindo esta instrução do usuário:\n\n` +
    `INSTRUÇÃO: ${instruction}\n\n` +
    `CONTEÚDO ATUAL:\n${currentContent}\n\n` +
    `Devolva SOMENTE a versão reescrita, mantendo o mesmo formato e plataforma. ` +
    `Sem rótulos, sem markdown wrapper, sem "aqui está".`;

  const res = await fetch(`${ctx.internalBaseUrl}/api/kai-content-agent`, {
    method: 'POST',
    headers: buildToolFetchHeaders(ctx),
    body: JSON.stringify({
      clientId,
      request: editRequest,
      format,
      platform,
      stream: false,
      additionalMaterial,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`kai-content-agent ${res.status}: ${errText.slice(0, 300)}`);
  }
  const json: any = await res.json().catch(() => ({}));
  const content = typeof json?.content === 'string' ? json.content : '';
  if (!content) throw new Error('kai-content-agent retornou conteúdo vazio');
  return content;
}

function getSanitizeOptionsForPlatform(platform: string, format: string) {
  const p = platform.toLowerCase();
  if (p === 'linkedin' || p === 'twitter' || p === 'x') {
    return { stripAllHashtags: true };
  }
  if (p === 'instagram') {
    return { maxHashtags: 3 };
  }
  if (format.toLowerCase().includes('blog') || format.toLowerCase().includes('newsletter')) {
    return { stripAllHashtags: true };
  }
  return { maxHashtags: 5 };
}

export const editContentTool: RegisteredTool<EditContentArgs, EditContentData> = {
  definition: {
    name: 'editContent',
    description:
      'Edita/reescreve um rascunho existente com base em instruções do usuário. Use quando o usuário quer ajustar, encurtar, alongar, mudar o tom, regenerar parcialmente, ou aplicar feedback específico sobre um rascunho que já existe. Atualiza o planning_item e retorna um card com a nova versão.',
    parameters: {
      type: 'object',
      properties: {
        planningItemId: {
          type: 'string',
          description: 'ID do planning_item (UUID) que contém o rascunho a ser editado.',
        },
        instruction: {
          type: 'string',
          description:
            "O que exatamente mudar no rascunho — ex: 'deixa mais curto', 'tom mais informal', 'adicionar CTA no fim', 'remover emojis', 'trocar exemplo de empresa'.",
        },
      },
      required: ['planningItemId', 'instruction'],
    },
  },

  handler: async (args, ctx) => {
    const planningItemId = String(args.planningItemId ?? '').trim();
    const instruction = String(args.instruction ?? '').trim();

    if (!planningItemId || !instruction) {
      return { ok: false, error: 'Faltam campos obrigatórios: planningItemId ou instruction.' };
    }

    console.log(`[editContent] planningItemId=${planningItemId} client=${ctx.clientId}`);

    try {
      const items = await query<{
        id: string;
        title: string;
        content: string;
        platform: string;
        metadata: any;
        client_id: string;
      }>(
        `SELECT id, title, content, platform, metadata, client_id
           FROM planning_items
          WHERE id = $1 AND client_id = $2 LIMIT 1`,
        [planningItemId, ctx.clientId],
      );
      const item = items[0];
      if (!item) return { ok: false, error: 'Rascunho não encontrado' };

      const currentContent = item.content ?? '';
      const platform = (item.platform ?? 'instagram').toLowerCase();
      const meta = (item.metadata ?? {}) as Record<string, any>;
      const format = (meta.format ?? 'post').toLowerCase();

      const clients = await query<{ name: string }>(
        `SELECT name FROM clients WHERE id = $1`,
        [ctx.clientId],
      );
      const clientName = clients[0]?.name ?? 'cliente';

      // ── Contexto + prompt suffix (mesmo padrão do createContent) ──
      const fullCtx = await getFullClientContext(ctx.clientId, instruction).catch(() => null);
      let additionalMaterial: string | undefined;
      try {
        const builder = await resolvePlatformPromptBuilder(platform, format);
        if (builder) {
          const fewShotBlock = fullCtx ? buildFewShotExamples(fullCtx, platform) : '';
          const platformHint = fullCtx ? buildPlatformPreferenceHint(fullCtx, platform) : '';
          // Pra edição, briefing é a instrução. ClientName e tone são carregados
          // via getFullClientContext (que já tem tone) — mas o builder pede
          // explicit tone se quiser sobrescrever (passa undefined: usa default).
          additionalMaterial = builder({
            briefing: `Edição: ${instruction}`,
            clientName,
            fewShotBlock: fewShotBlock || undefined,
            platformHint: platformHint || undefined,
          });
        }
      } catch (err) {
        console.warn('[editContent] prompt builder failed (non-fatal):', err);
      }

      const rawContent = await invokeContentAgentForEdit({
        ctx,
        clientId: ctx.clientId,
        currentContent,
        instruction,
        format,
        platform,
        additionalMaterial,
      });
      console.log(`[editContent] raw content — ${rawContent.length} chars`);

      // ── Sanitize ──
      const sanitizeOpts = getSanitizeOptionsForPlatform(platform, format);
      const { text: newContent, warnings } = sanitizeLLMText(rawContent, {
        ...sanitizeOpts,
        warnMojibake: true,
      });
      if (warnings.length > 0) {
        console.warn('[editContent] sanitize warnings:', warnings);
      }

      // ── Validação (sem retry — edição é manual) ──
      let validationResult = { valid: true, violations: 0, warnings: 0 };
      try {
        const parsed = parseOutput(newContent, format);
        const validation = validateContent(parsed, format);
        validationResult = {
          valid: validation.valid,
          violations: validation.violations.filter((v) => v.severity === 'error').length,
          warnings: validation.violations.filter((v) => v.severity === 'warning').length,
        };
      } catch (validErr) {
        console.warn('[editContent] validation error (non-fatal):', validErr);
      }

      // ── Title corrigido — usa extractor que strippa markdown/labels ──
      const newTitle = extractTitleFromContent(newContent, 60);
      const nowIso = new Date().toISOString();
      const newMeta = {
        ...meta,
        last_edit_instruction: instruction,
        last_edited_at: nowIso,
        last_edit_sanitize_warnings: warnings,
        last_edit_validation: validationResult,
      };
      await query(
        `UPDATE planning_items
            SET content = $1,
                title = $2,
                updated_at = $3,
                metadata = $4::jsonb
          WHERE id = $5`,
        [newContent, newTitle, nowIso, JSON.stringify(newMeta), planningItemId],
      );

      const briefing = meta.briefing ?? instruction;
      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: planningItemId,
        type: 'draft',
        status: 'done',
        data: {
          kind: 'draft',
          clientId: ctx.clientId,
          platform,
          format,
          title: newTitle,
          body: newContent,
          briefing,
        },
        requires_approval: true,
        available_actions: [
          {
            id: 'approve_publish',
            label: 'Aprovar e publicar',
            variant: 'primary',
            tool_call: { name: 'publishNow', args: { planningItemId } },
          },
          { id: 'schedule', label: 'Agendar', variant: 'secondary', client_action: 'edit' },
          {
            id: 'regenerate',
            label: 'Refazer',
            variant: 'ghost',
            tool_call: { name: 'editContent', args: { planningItemId, instruction } },
          },
        ],
      };

      return {
        ok: true,
        data: {
          planningItemId,
          content: newContent,
          warnings: warnings.length > 0 ? warnings : undefined,
          validation: validationResult,
        },
        card,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[editContent] error:', err);
      return { ok: false, error: message };
    }
  },
};
