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

interface CreateContentSingleTask {
  platform: string;
  format: string;
  briefing: string;
  tone?: string;
}

interface CreateContentArgs extends CreateContentSingleTask {
  /**
   * Modo batch (opcional). Quando presente, ignora platform/format/briefing/tone
   * do nível superior e processa cada task em paralelo (cap 10, concurrency 3).
   * Cada task emite seu próprio card via stream; o result devolve sumário.
   */
  tasks?: Array<CreateContentSingleTask>;
  /** Máx jobs concorrentes em modo batch. Default 3. */
  concurrency?: number;
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

interface CreateContentBatchItemResult {
  ok: boolean;
  planningItemId?: string;
  platform: string;
  format: string;
  briefing: string;
  title?: string;
  error?: string;
}

interface CreateContentBatchData {
  batch: true;
  totalTasks: number;
  successCount: number;
  failedCount: number;
  totalDurationMs: number;
  results: CreateContentBatchItemResult[];
  /** IDs de todos os planning_items criados (apenas sucessos). */
  planningItemIds: string[];
}

const MAX_BATCH_TASKS = 10;
const DEFAULT_BATCH_CONCURRENCY = 3;

/**
 * Runner concorrente local (cópia leve da lógica do delegateBatch).
 * Mantido inline pra não criar dep cross-arquivo só por isso.
 */
async function runWithLimit<T>(
  jobs: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (true) {
      const i = index++;
      if (i >= jobs.length) return;
      results[i] = await jobs[i]();
    }
  });
  await Promise.all(workers);
  return results;
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

/**
 * Executa uma única task de criação de conteúdo. Extraído pra permitir reuse
 * tanto no path single quanto no batch. Retorna `{ data, card }` em sucesso
 * ou lança/retorna erro string.
 *
 * Importante: NÃO emite o card via ctx.emit — quem chama decide se faz emit
 * (batch) ou devolve via result.card (single, runner emite).
 */
async function runSingleCreateContent(
  args: CreateContentSingleTask,
  ctx: ToolExecutionContext,
  client: { id: string; workspace_id: string; name: string },
): Promise<
  | { ok: true; data: CreateContentData; card: KAIActionCard }
  | { ok: false; error: string }
> {
  const platform = String(args.platform ?? '').toLowerCase();
  const format = String(args.format ?? '').toLowerCase();
  const briefing = String(args.briefing ?? '').trim();
  const tone = args.tone ? String(args.tone) : undefined;

  if (!platform || !format || !briefing) {
    return { ok: false, error: 'Faltam campos obrigatórios: platform, format ou briefing.' };
  }

  const workspaceId = client.workspace_id;
  console.log(`[createContent:single] platform=${platform} format=${format}`);

  // ── 1. Carrega contexto completo do cliente (cached) ──
  const fullCtx = await getFullClientContext(ctx.clientId, briefing).catch((err) => {
    console.warn('[createContent] full ctx failed (non-fatal):', err);
    return null;
  });

  // ── 2. Monta additionalMaterial com platform-specific suffix ──
  let additionalMaterial: string | undefined;
  try {
    const builder = await resolvePlatformPromptBuilder(platform, format);
    if (builder) {
      const fewShotBlock = fullCtx ? buildFewShotExamples(fullCtx, platform) : '';
      const platformHint = fullCtx ? buildPlatformPreferenceHint(fullCtx, platform) : '';
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
  console.log(`[createContent:single] raw content — ${rawContent.length} chars`);

  // ── 4. Sanitização defensiva ──
  const sanitizeOpts = getSanitizeOptionsForPlatform(platform, format);
  let { text: content, warnings } = sanitizeLLMText(rawContent, {
    ...sanitizeOpts,
    warnMojibake: true,
  });
  if (warnings.length > 0) {
    console.warn(`[createContent:single] sanitize warnings:`, warnings);
  }

  // ── 5. Validação + retry 1x ──
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
        `[createContent:single] validation FAILED — ${validationResult.violations} error(s). Tentando repair.`,
      );
      const repairPrompt = buildRepairPrompt(validation.violations, content);
      if (repairPrompt) {
        const repaired = await invokeContentAgent({
          ctx,
          clientId: ctx.clientId,
          briefing: repairPrompt,
          format,
          platform,
          tone,
        }).catch((err) => {
          console.warn('[createContent:single] repair attempt failed:', err);
          return null;
        });
        if (repaired) {
          const repairResult = sanitizeLLMText(repaired, {
            ...sanitizeOpts,
            warnMojibake: true,
          });
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
              violations: repairedValidation.violations.filter((v) => v.severity === 'error').length,
              warnings: repairedValidation.violations.filter((v) => v.severity === 'warning').length,
              repaired: true,
            };
            console.log(
              `[createContent:single] repair OK — agora ${validationResult.violations} errors`,
            );
          }
        }
      }
    }
  } catch (validErr) {
    console.warn('[createContent:single] validation pipeline error (non-fatal):', validErr);
  }

  console.log(
    `[createContent:single] final content — ${content.length} chars, valid=${validationResult.valid}, warnings=${warnings.length}`,
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
    console.warn('[createContent:single] telegram notify failed:', error);
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
}

export const createContentTool: RegisteredTool<CreateContentArgs, CreateContentData | CreateContentBatchData> = {
  definition: {
    name: 'createContent',
    description:
      'Criar rascunho(s) de post/conteúdo. MODO SINGLE: passe platform+format+briefing pra gerar 1 rascunho. MODO BATCH: passe `tasks: [{platform, format, briefing, tone?}]` pra gerar até 10 em paralelo num único call (concurrency interna 3). Use batch quando o usuário pede múltiplos temas/posts de uma vez (ex: "cria 5 posts pra essa semana"). Cada item vira um card de aprovação separado.',
    parameters: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description: 'MODO SINGLE: Plataforma de destino do conteúdo. Ignorado se `tasks` presente.',
          enum: ['instagram', 'twitter', 'linkedin', 'youtube', 'newsletter', 'tiktok'],
        },
        format: {
          type: 'string',
          description: 'MODO SINGLE: Formato (post, carousel, reel, thread, short, long, story). Ignorado se `tasks` presente.',
        },
        briefing: {
          type: 'string',
          description:
            'MODO SINGLE: Pedido detalhado — tema, ângulo, CTA, referências. Ignorado se `tasks` presente.',
        },
        tone: {
          type: 'string',
          description:
            'MODO SINGLE: Tom desejado opcional (informal, analítico, etc). Ignorado se `tasks` presente.',
        },
        tasks: {
          type: 'array',
          description:
            'MODO BATCH (opcional): Lista de até 10 conteúdos a gerar em paralelo. Cada item: {platform, format, briefing, tone?}. Quando presente, ignora os campos single-mode acima.',
          items: {
            type: 'object',
            description:
              'Uma task de geração: {platform, format, briefing, tone?}. Mesma semântica do modo single.',
          },
        },
        concurrency: {
          type: 'integer',
          description:
            'MODO BATCH: jobs simultâneos. Default 3 (seguro pro rate-limit Gemini). Max 10.',
        },
      },
      // Nada required no nível superior — handler valida ou-ou (single vs batch).
    },
  },

  handler: async (args, ctx) => {
    // ── Decisão de modo: batch se `tasks` array com itens, senão single ──
    const isBatch = Array.isArray(args.tasks) && args.tasks.length > 0;

    console.log(
      `[createContent] mode=${isBatch ? 'batch' : 'single'} clientId=${ctx.clientId}` +
        (isBatch ? ` tasks=${args.tasks!.length}` : ''),
    );

    try {
      const clients = await query<{ id: string; workspace_id: string; name: string }>(
        `SELECT id, workspace_id, name FROM clients WHERE id = $1`,
        [ctx.clientId],
      );
      const client = clients[0];
      if (!client) {
        return { ok: false, error: 'Cliente não encontrado ou sem workspace associado.' };
      }
      if (!client.workspace_id) {
        return { ok: false, error: 'Cliente não está associado a nenhum workspace.' };
      }

      // ───────────────────────── MODO BATCH ─────────────────────────
      if (isBatch) {
        const tasks = args.tasks!;
        if (tasks.length > MAX_BATCH_TASKS) {
          return {
            ok: false,
            error: `Máx ${MAX_BATCH_TASKS} tasks por batch (foram ${tasks.length}). Divida em batches menores.`,
          };
        }
        const concurrency = Math.max(
          1,
          Math.min(args.concurrency ?? DEFAULT_BATCH_CONCURRENCY, MAX_BATCH_TASKS),
        );

        const t0 = Date.now();
        const jobs = tasks.map((task, idx) => async (): Promise<CreateContentBatchItemResult> => {
          const taskPlatform = String(task?.platform ?? '').toLowerCase();
          const taskFormat = String(task?.format ?? '').toLowerCase();
          const taskBriefing = String(task?.briefing ?? '').trim();
          try {
            const res = await runSingleCreateContent(task, ctx, client);
            if (!res.ok) {
              const errMsg = (res as { ok: false; error: string }).error;
              console.warn(`[createContent:batch][${idx}] failed: ${errMsg}`);
              return {
                ok: false,
                platform: taskPlatform,
                format: taskFormat,
                briefing: taskBriefing,
                error: errMsg,
              };
            }
            // Emite card individual via stream — runner não loopa em `cards`.
            try {
              ctx.emit.actionCard(res.card);
            } catch (emitErr) {
              console.warn(`[createContent:batch][${idx}] emit failed:`, emitErr);
            }
            return {
              ok: true,
              planningItemId: res.data.planningItemId,
              platform: taskPlatform,
              format: taskFormat,
              briefing: taskBriefing,
              title:
                typeof res.card.data === 'object' && res.card.data && 'title' in res.card.data
                  ? (res.card.data.title as string | undefined)
                  : undefined,
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[createContent:batch][${idx}] threw:`, err);
            return {
              ok: false,
              platform: taskPlatform,
              format: taskFormat,
              briefing: taskBriefing,
              error: msg,
            };
          }
        });

        const results = await runWithLimit(jobs, concurrency);
        const totalDurationMs = Date.now() - t0;
        const successCount = results.filter((r) => r.ok).length;
        const failedCount = results.length - successCount;
        const planningItemIds = results
          .filter((r): r is CreateContentBatchItemResult & { planningItemId: string } =>
            Boolean(r.ok && r.planningItemId),
          )
          .map((r) => r.planningItemId);

        console.log(
          `[createContent:batch] ${results.length} tasks (${successCount}✓ ${failedCount}✗) em ${totalDurationMs}ms (concurrency=${concurrency})`,
        );

        return {
          ok: true,
          data: {
            batch: true,
            totalTasks: results.length,
            successCount,
            failedCount,
            totalDurationMs,
            results,
            planningItemIds,
          },
          // Sem `card` aqui — os N cards já foram emitidos individualmente via
          // ctx.emit acima. Retornar um card extra duplicaria o último item.
        };
      }

      // ───────────────────────── MODO SINGLE ─────────────────────────
      const singleResult = await runSingleCreateContent(
        {
          platform: args.platform,
          format: args.format,
          briefing: args.briefing,
          tone: args.tone,
        },
        ctx,
        client,
      );
      if (!singleResult.ok) {
        return { ok: false, error: (singleResult as { ok: false; error: string }).error };
      }
      return {
        ok: true,
        data: singleResult.data,
        card: singleResult.card,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[createContent] error:', err);
      return { ok: false, error: message };
    }
  },
};
