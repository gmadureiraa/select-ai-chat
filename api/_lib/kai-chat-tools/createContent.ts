/**
 * Tool `createContent` — gera rascunho via kai-content-agent + persiste em planning_items.
 *
 * Refatorado 2026-05-16 (Gabriel reportou "post LinkedIn saiu todo bugado"):
 *   - Carrega contexto completo do cliente (cached 5min) ANTES de chamar LLM.
 *   - Roteia pelo `content-prompts/<platform>.ts` pra prompt suffix specific
 *     (LinkedIn ≠ Twitter ≠ Instagram ≠ Carousel ≠ Blog).
 *   - Injeta few-shot examples (top performers do próprio cliente) no prompt.
 *   - Sanitiza output via `sanitizeLLMText` (strip markdown fences, mojibake
 *     warning, strip meta-prefixos "Aqui está o post:").
 *   - Valida via `content-validator` e faz retry 1x se há violação crítica.
 *   - Preserva contract antigo: retorna `{ planningItemId, content }` + card.
 */
import { newActionCardId, type KAIActionCard } from './kai-stream.js';
import type { RegisteredTool, ToolExecutionContext } from './types.js';
import { query, insertRow } from '../db.js';
import { notifyPlanningItemTelegram } from '../telegram-planning.js';
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
import {
  parseOutput,
  validateContent,
  buildRepairPrompt,
} from '../shared/content-validator.js';

interface CreateContentArgs {
  platform: string;
  format: string;
  briefing: string;
  tone?: string;
}

interface CreateContentData {
  planningItemId: string;
  content: string;
  /** Warnings não-fatais do sanitizer (ex: stripped_outer_code_fence). */
  warnings?: string[];
  /** Validation summary do content-validator (debug). */
  validation?: {
    valid: boolean;
    violations: number;
    warnings: number;
    repaired: boolean;
  };
}

function inferContentType(format: string, platform: string): string {
  const f = format.toLowerCase();
  if (f.includes('thread') || f.includes('fio')) return 'thread';
  if (f.includes('carousel') || f.includes('carrossel') || f.includes('carrosel')) return 'carousel';
  if (f.includes('reel') || f.includes('short')) return 'short_video';
  if (platform === 'linkedin') return 'linkedin_post';
  if (platform === 'twitter' || platform === 'x') return 'tweet';
  if (platform === 'instagram') return 'instagram_post';
  return 'social_post';
}

function parseThreadItems(text: string): Array<{ text: string; media_urls: string[] }> | undefined {
  const cleaned = text.trim();
  if (!cleaned) return undefined;
  const bySeparators = cleaned
    .split(/\n\s*(?:---+|—{3,})\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);
  const byNumbers = cleaned
    .split(/\n(?=\s*(?:tweet\s*)?\d+\s*(?:[\/.)-]|:)\s+)/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const parts = bySeparators.length >= 2 ? bySeparators : byNumbers;
  if (parts.length < 2) return undefined;
  const tweets = parts
    .map((part) =>
      part
        .replace(/^\s*(?:tweet\s*)?\d+\s*(?:[\/.)-]|:)\s*/i, '')
        .replace(/\n\s*(?:---+|—{3,})\s*$/g, '')
        .trim()
        .slice(0, 280),
    )
    .filter(Boolean)
    .map((part) => ({ text: part, media_urls: [] }));
  return tweets.length >= 2 ? tweets : undefined;
}

interface InvokeContentAgentArgs {
  ctx: ToolExecutionContext;
  clientId: string;
  briefing: string;
  format: string;
  platform: string;
  /** Concatenado ao system prompt do agent via additionalMaterial. */
  additionalMaterial?: string;
  tone?: string;
}

async function invokeContentAgent(args: InvokeContentAgentArgs): Promise<string> {
  const { ctx, clientId, briefing, format, platform, additionalMaterial, tone } = args;
  const effectiveRequest = tone ? `${briefing}\n\n[Tom desejado: ${tone}]` : briefing;
  const res = await fetch(`${ctx.internalBaseUrl}/api/kai-content-agent`, {
    method: 'POST',
    headers: buildToolFetchHeaders(ctx),
    body: JSON.stringify({
      clientId,
      request: effectiveRequest,
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

  const json = await res.json().catch(() => ({} as any));
  const content = typeof json?.content === 'string' ? json.content : '';
  if (!content) throw new Error('kai-content-agent retornou conteúdo vazio');
  return content;
}

async function resolveDraftColumnId(workspaceId: string): Promise<string | null> {
  const preferred = await query<{ id: string }>(
    `SELECT id FROM kanban_columns
       WHERE workspace_id = $1
         AND column_type = ANY($2::text[])
       ORDER BY position ASC LIMIT 1`,
    [workspaceId, ['idea', 'draft']],
  );
  if (preferred.length > 0) return preferred[0].id;

  const first = await query<{ id: string }>(
    `SELECT id FROM kanban_columns WHERE workspace_id = $1 ORDER BY position ASC LIMIT 1`,
    [workspaceId],
  );
  return first[0]?.id ?? null;
}

/**
 * Decide se LinkedIn/Twitter/Instagram exigem stripAllHashtags ou não.
 * Em LinkedIn, regra padrão é zero. Twitter, zero (algoritmo penaliza).
 * Instagram, depende do cliente — fica a 3 max.
 */
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

export const createContentTool: RegisteredTool<CreateContentArgs, CreateContentData> = {
  definition: {
    name: 'createContent',
    description:
      'Criar rascunho de post/conteúdo pra uma plataforma específica. Use quando o usuário pede pra criar, gerar, escrever, fazer um post, reel, carrossel, thread, newsletter ou vídeo. Gera o conteúdo via agente especializado e salva como rascunho no planejamento, devolvendo um card de aprovação pro usuário.',
    parameters: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description: 'Plataforma de destino do conteúdo.',
          enum: ['instagram', 'twitter', 'linkedin', 'youtube', 'newsletter', 'tiktok'],
        },
        format: {
          type: 'string',
          description: 'Formato do conteúdo (ex: post, carousel, reel, thread, short, long, story).',
        },
        briefing: {
          type: 'string',
          description:
            'Pedido original do usuário detalhado — tema, ângulo, CTA, referências, qualquer contexto relevante pra produção.',
        },
        tone: {
          type: 'string',
          description:
            'Tom desejado opcional (ex: informal, analítico, provocativo, educativo). Se omitido, usa o tom padrão da marca.',
        },
      },
      required: ['platform', 'format', 'briefing'],
    },
  },

  handler: async (args, ctx) => {
    const platform = String(args.platform ?? '').toLowerCase();
    const format = String(args.format ?? '').toLowerCase();
    const briefing = String(args.briefing ?? '').trim();
    const tone = args.tone ? String(args.tone) : undefined;

    if (!platform || !format || !briefing) {
      return { ok: false, error: 'Faltam campos obrigatórios: platform, format ou briefing.' };
    }

    console.log(`[createContent] clientId=${ctx.clientId} platform=${platform} format=${format}`);

    try {
      const clients = await query<{ id: string; workspace_id: string; name: string }>(
        `SELECT id, workspace_id, name FROM clients WHERE id = $1`,
        [ctx.clientId],
      );
      const client = clients[0];
      if (!client) {
        return { ok: false, error: 'Cliente não encontrado ou sem workspace associado.' };
      }
      const workspaceId = client.workspace_id;
      if (!workspaceId) {
        return { ok: false, error: 'Cliente não está associado a nenhum workspace.' };
      }

      // ── 1. Carrega contexto completo do cliente (cached) ──
      // Failsoft: se DB devolve null/erro, segue sem few-shots — kai-content-agent
      // ainda tem seu próprio loader interno.
      const fullCtx = await getFullClientContext(ctx.clientId, briefing).catch((err) => {
        console.warn('[createContent] full ctx failed (non-fatal):', err);
        return null;
      });

      // ── 2. Monta additionalMaterial com platform-specific suffix ──
      // O kai-content-agent já injeta voice/library/refs. Esse bloco adiciona
      // regras HARD por plataforma + few-shot examples do próprio cliente.
      let additionalMaterial: string | undefined;
      try {
        const builder = await resolvePlatformPromptBuilder(platform, format);
        if (builder) {
          const fewShotBlock = fullCtx
            ? buildFewShotExamples(fullCtx, platform)
            : '';
          const platformHint = fullCtx
            ? buildPlatformPreferenceHint(fullCtx, platform)
            : '';
          additionalMaterial = builder({
            briefing,
            tone,
            clientName: client.name ?? 'cliente',
            fewShotBlock: fewShotBlock || undefined,
            platformHint: platformHint || undefined,
          });
        }
      } catch (promptErr) {
        console.warn('[createContent] prompt builder failed (non-fatal):', promptErr);
      }

      // ── 3. Chama o agente ──
      let rawContent = await invokeContentAgent({
        ctx,
        clientId: ctx.clientId,
        briefing,
        format,
        platform,
        additionalMaterial,
        tone,
      });
      console.log(`[createContent] raw content — ${rawContent.length} chars`);

      // ── 4. Sanitização defensiva (strip fence, meta-prefixos, hashtags...) ──
      const sanitizeOpts = getSanitizeOptionsForPlatform(platform, format);
      let { text: content, warnings } = sanitizeLLMText(rawContent, {
        ...sanitizeOpts,
        warnMojibake: true,
      });
      if (warnings.length > 0) {
        console.warn(`[createContent] sanitize warnings:`, warnings);
      }

      // ── 5. Validação com content-validator + retry 1x se inválido ──
      let validationResult = {
        valid: true,
        violations: 0,
        warnings: 0,
        repaired: false,
      };
      try {
        const parsed = parseOutput(content, format);
        const validation = validateContent(parsed, format);
        validationResult = {
          valid: validation.valid,
          violations: validation.violations.filter((v) => v.severity === 'error').length,
          warnings: validation.violations.filter((v) => v.severity === 'warning').length,
          repaired: false,
        };

        if (!validation.valid) {
          console.log(
            `[createContent] validation FAILED — ${validationResult.violations} error(s). Tentando repair.`,
          );
          const repairPrompt = buildRepairPrompt(validation.violations, content);
          if (repairPrompt) {
            // Repair = re-prompt apenas com instrução de fix (briefing original
            // já foi processado). Mantém o mesmo platform/format pra o agent
            // não trocar de prompt builder.
            const repaired = await invokeContentAgent({
              ctx,
              clientId: ctx.clientId,
              briefing: repairPrompt,
              format,
              platform,
              tone,
            }).catch((err) => {
              console.warn('[createContent] repair attempt failed:', err);
              return null;
            });
            if (repaired) {
              const repairResult = sanitizeLLMText(repaired, {
                ...sanitizeOpts,
                warnMojibake: true,
              });
              // Só usa o repaired se ele de fato resolve (ou pelo menos não piora).
              const repairedParsed = parseOutput(repairResult.text, format);
              const repairedValidation = validateContent(repairedParsed, format);
              if (
                repairedValidation.violations.filter((v) => v.severity === 'error').length <
                validationResult.violations
              ) {
                content = repairResult.text;
                warnings = [...warnings, ...repairResult.warnings, 'auto_repaired'];
                validationResult = {
                  valid: repairedValidation.valid,
                  violations: repairedValidation.violations.filter((v) => v.severity === 'error')
                    .length,
                  warnings: repairedValidation.violations.filter((v) => v.severity === 'warning')
                    .length,
                  repaired: true,
                };
                console.log(`[createContent] repair OK — agora ${validationResult.violations} errors`);
              }
            }
          }
        }
      } catch (validErr) {
        // Validation não é blocker — segue com o content sanitizado mesmo se a
        // parsing/validation explodir (schema pode não existir pro format raro).
        console.warn('[createContent] validation pipeline error (non-fatal):', validErr);
      }

      console.log(
        `[createContent] final content — ${content.length} chars, valid=${validationResult.valid}, warnings=${warnings.length}`,
      );

      // ── 6. Persiste em planning_items ──
      const columnId = await resolveDraftColumnId(workspaceId);
      const title = extractTitleFromContent(content, 60);
      const contentType = inferContentType(format, platform);
      const threadTweets =
        contentType === 'thread' || format.includes('thread') || format.includes('fio')
          ? parseThreadItems(content)
          : undefined;
      const item = await insertRow<{ id: string }>('planning_items', {
        title,
        content,
        platform,
        content_type: contentType,
        status: 'draft',
        client_id: ctx.clientId,
        workspace_id: workspaceId,
        created_by: ctx.userId,
        column_id: columnId,
        metadata: JSON.stringify({
          source: 'kai-tool:createContent',
          format,
          briefing,
          tone: tone ?? null,
          content_type: contentType,
          target_platforms: [platform],
          sanitize_warnings: warnings,
          validation: validationResult,
          ...(threadTweets ? { thread_tweets: threadTweets } : {}),
        }),
      });
      const planningItemId = item.id;
      notifyPlanningItemTelegram(planningItemId, {
        mode: 'review',
        reason: 'Criado pelo KAI Chat',
      }).catch((error) => {
        console.warn('[createContent] telegram notify failed:', error);
      });

      const card: KAIActionCard = {
        id: newActionCardId(),
        planning_item_id: planningItemId,
        type: 'draft',
        status: 'pending_approval',
        data: {
          kind: 'draft',
          clientId: ctx.clientId,
          platform,
          format,
          title,
          body: content,
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
          {
            id: 'schedule',
            label: 'Agendar',
            variant: 'secondary',
            client_action: 'edit',
          },
          {
            id: 'regenerate',
            label: 'Refazer',
            variant: 'ghost',
            tool_call: { name: 'createContent', args: { platform, format, briefing } },
          },
        ],
      };

      return {
        ok: true,
        data: {
          planningItemId,
          content,
          warnings: warnings.length > 0 ? warnings : undefined,
          validation: validationResult,
        },
        card,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[createContent] error:', err);
      return { ok: false, error: message };
    }
  },
};
