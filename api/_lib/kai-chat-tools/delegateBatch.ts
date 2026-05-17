/**
 * Tool `delegateBatch` — paralelismo real de sub-agentes.
 *
 * Diferença vs `delegateToSubAgent`: aceita array de {role, task} e roda
 * todos em PARALELO via Promise.all. Latência total = max(latência individual),
 * não soma. Útil pra fan-out (ex: pesquisar 3 ângulos diferentes ao mesmo tempo).
 *
 * Trade-offs:
 *   - Custo igual (mesmas chamadas Gemini, só simultâneas)
 *   - Cap de concorrência embutido (default 3) pra não explodir rate-limit
 *   - Sub-agentes não veem resultado uns dos outros (são isolados)
 *   - Sem coordenação — se 2 tentarem deletar o mesmo item, ambos vão tentar
 *     (approval flow segura no banco mas é desperdício de tokens)
 *
 * Versão MVP — reusa toda lógica do `delegateToSubAgentTool.handler` em loop
 * controlado em vez de duplicar código.
 */
import type { RegisteredTool, ToolExecutionContext } from './types.js';
import { delegateToSubAgentTool } from './delegateToSubAgent.js';

interface DelegateBatchArgs {
  tasks: Array<{
    role: 'planner' | 'reviewer' | 'researcher';
    task: string;
    clientId?: string;
  }>;
  /** Máx jobs concorrentes. Default 3 (cap do free tier Gemini). */
  concurrency?: number;
}

interface DelegateBatchData {
  totalTasks: number;
  successCount: number;
  failedCount: number;
  totalDurationMs: number;
  results: Array<{
    role: string;
    task: string;
    ok: boolean;
    finalText?: string;
    toolCallsCount?: number;
    toolNames?: string[];
    durationMs?: number;
    error?: string;
  }>;
}

const MAX_BATCH_SIZE = 8;
const DEFAULT_CONCURRENCY = 3;

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

export const delegateBatchTool: RegisteredTool<DelegateBatchArgs, DelegateBatchData> = {
  definition: {
    name: 'delegateBatch',
    description:
      'Roda múltiplos sub-agentes em PARALELO. Use quando precisa de N tarefas independentes ao mesmo tempo (ex: pesquisar 3 ângulos de um tópico, planejar 2 clientes diferentes). Cada task tem {role: planner|reviewer|researcher, task: string}. Máx 8 tasks por batch, concorrência default 3. Pra UMA tarefa apenas, use delegateToSubAgent (mais leve).',
    parameters: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          description: 'Lista de tarefas pra rodar em paralelo. Cada item: {role, task, clientId?}.',
          items: {
            type: 'object',
            description: 'Sub-tarefa: role (planner/reviewer/researcher) + task (descrição).',
          },
        },
        concurrency: {
          type: 'integer',
          description: 'Máx jobs concorrentes simultaneamente. Default 3 (seguro pro free tier).',
        },
      },
      required: ['tasks'],
    },
  },
  handler: async (args, ctx: ToolExecutionContext) => {
    const tasks = args.tasks;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { ok: false, error: 'tasks vazio. Forneça array de {role, task}.' };
    }
    if (tasks.length > MAX_BATCH_SIZE) {
      return {
        ok: false,
        error: `Máx ${MAX_BATCH_SIZE} tasks por batch (foram ${tasks.length}). Divida em batches.`,
      };
    }
    const concurrency = Math.max(1, Math.min(args.concurrency ?? DEFAULT_CONCURRENCY, MAX_BATCH_SIZE));

    const t0 = Date.now();
    const jobs = tasks.map((t) => async () => {
      const result = await delegateToSubAgentTool.handler(
        { role: t.role, task: t.task, clientId: t.clientId },
        ctx,
      );
      if (!result.ok) {
        return {
          role: t.role,
          task: t.task,
          ok: false as const,
          error: result.error,
        };
      }
      const data = result.data!;
      return {
        role: data.role,
        task: data.task,
        ok: true as const,
        finalText: data.finalText,
        toolCallsCount: data.toolCallsCount,
        toolNames: data.toolNames,
        durationMs: data.durationMs,
      };
    });

    const results = await runWithLimit(jobs, concurrency);
    const totalDurationMs = Date.now() - t0;
    const successCount = results.filter((r) => r.ok).length;
    const failedCount = results.length - successCount;
    console.log(
      `[delegateBatch] ${results.length} tasks (${successCount}✓ ${failedCount}✗) em ${totalDurationMs}ms (concurrency=${concurrency})`,
    );
    return {
      ok: true,
      data: {
        totalTasks: results.length,
        successCount,
        failedCount,
        totalDurationMs,
        results,
      },
    };
  },
};
