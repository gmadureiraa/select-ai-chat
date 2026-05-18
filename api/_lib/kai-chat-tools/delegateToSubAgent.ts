/**
 * Tool `delegateToSubAgent` — spawn de sub-loop com subset de tools.
 *
 * Quando o agente principal recebe uma tarefa grande/complexa, pode delegar
 * pra uma "instância filha" rodando em paralelo (na mesma invocação Vercel,
 * sequencialmente — não é process spawn) com:
 *   1. System prompt FOCADO no escopo (mais curto, menos confuso)
 *   2. Subset de tools relevantes (planner não precisa de delete*)
 *   3. Histórico zerado (sem ruído da conversa principal)
 *
 * Útil pra:
 *   - "planejar uma campanha completa" (planner sub-agent: getMetrics +
 *     searchLibrary + addToPlanning)
 *   - "revisar todos os 5 rascunhos pendentes" (reviewer sub-agent: getPlanning
 *     + editContent)
 *   - "pesquisar 3 ângulos diferentes pra um tópico" (researcher sub-agent:
 *     webSearch + searchLibrary)
 *
 * Versão MVP: parâmetro `role` escolhe preset (planner/reviewer/researcher).
 * Sub-loop usa Gemini Flash com max 4 iterações (limit dentro de limit).
 * Retorna síntese de texto + tool calls executadas pro agente pai usar.
 */
import type { RegisteredTool, ToolExecutionContext } from './types.js';
import { ToolRegistry } from './registry.js';
import { runToolLoop, type GeminiContent } from './runner.js';
import type { KAIStreamEmitter } from './kai-stream.js';

// Presets — define quais tools cada role tem acesso. Mantém lista curta pra
// foco; tools fora do preset não aparecem pro sub-agente.
type SubAgentRole = 'planner' | 'reviewer' | 'researcher';

interface DelegateArgs {
  /** Papel do sub-agente — define preset de tools + system prompt. */
  role: SubAgentRole;
  /** Tarefa específica pro sub-agente resolver. Seja claro e escopado. */
  task: string;
  /** clientId opcional — herda do contexto principal se não fornecido. */
  clientId?: string;
}

interface DelegateData {
  role: SubAgentRole;
  task: string;
  finalText: string;
  toolCallsCount: number;
  toolNames: string[];
  durationMs: number;
}

const ROLE_CONFIG: Record<
  SubAgentRole,
  { systemPrompt: string; toolNames: string[] }
> = {
  planner: {
    systemPrompt:
      'Você é um sub-agente PLANEJADOR do KAI. Foco: criar/organizar plano editorial pro cliente. Use getRecentPerformance + searchLibrary pra entender o que funciona. Use addToPlanning pra agendar. Seja decisivo, não pergunte de volta — execute o melhor caminho. Reporte em 3-5 frases ao final.',
    toolNames: [
      'getRecentPerformance',
      'getMetrics',
      'searchLibrary',
      'getReferences',
      'getPlanningItem',
      'addToPlanning',
      'getClientContext',
    ],
  },
  reviewer: {
    systemPrompt:
      'Você é um sub-agente REVISOR do KAI. Foco: revisar rascunhos pendentes do cliente. Use listPendingApprovals + editContent. Seja crítico mas construtivo — só edite se tiver melhoria clara. Reporte em 3-5 frases ao final.',
    toolNames: [
      'listPendingApprovals',
      'getPlanningItem',
      'editContent',
      'getReferences',
      'getClientContext',
    ],
  },
  researcher: {
    systemPrompt:
      'Você é um sub-agente PESQUISADOR do KAI. Foco: investigar tópicos profundamente. Use webSearch + searchLibrary + getReferences. Cruze múltiplas fontes. Reporte achados em 5-8 bullets ao final.',
    toolNames: [
      'webSearch',
      'searchLibrary',
      'getReferences',
      'getRecentPerformance',
      'getClientContext',
    ],
  },
};

// Reset emitter pra sub-agent — silenciamos cards/approvals pra não poluir
// o stream do agente pai. Texto do sub-agent fica em finalText (não vai pro
// SSE do usuário); só a SÍNTESE retornada é falada pelo pai.
function makeSilentEmitter(): KAIStreamEmitter {
  return {
    content: () => {},
    image: () => {},
    toolRunning: () => {},
    actionCard: () => {},
    approvalRequest: () => {},
    error: () => {},
    done: () => {},
    heartbeat: () => {},
    startHeartbeat: () => () => {},
  };
}

export const delegateToSubAgentTool: RegisteredTool<DelegateArgs, DelegateData> = {
  definition: {
    name: 'delegateToSubAgent',
    description:
      'Delega uma tarefa complexa pra um sub-agente especializado com subset de tools. Use SOMENTE quando a tarefa exige >5 tool calls coordenadas (planejar campanha completa, revisar todos os rascunhos pendentes, pesquisar tópico em profundidade). Para tarefas simples, chame as tools diretamente. roles: "planner" (planejamento editorial), "reviewer" (revisar rascunhos), "researcher" (pesquisa profunda).',
    parameters: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          description: 'Papel do sub-agente (planner | reviewer | researcher).',
          enum: ['planner', 'reviewer', 'researcher'],
        },
        task: {
          type: 'string',
          description: 'Tarefa específica e escopada pro sub-agente. Seja claro sobre o resultado esperado.',
        },
        clientId: {
          type: 'string',
          description: 'UUID do cliente. Se omitido, usa o cliente ativo do contexto principal.',
        },
      },
      required: ['role', 'task'],
    },
  },
  handler: async (args, ctx: ToolExecutionContext) => {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: 'GOOGLE_API_KEY ausente — delegate desabilitado.' };
    }
    const role = args.role;
    if (!role || !ROLE_CONFIG[role]) {
      return { ok: false, error: `role inválido. Use: planner | reviewer | researcher.` };
    }
    const task = args.task?.trim();
    if (!task) return { ok: false, error: 'task vazia.' };
    const subClientId = args.clientId || ctx.clientId;

    const config = ROLE_CONFIG[role];

    // Resolve as tool definitions dinamicamente — import lazy pra evitar
    // circular dep com index.js
    const allTools: Record<string, RegisteredTool> = await (async () => {
      const idx = await import('./index.js');
      const map: Record<string, RegisteredTool> = {};
      for (const v of Object.values(idx)) {
        if (
          v &&
          typeof v === 'object' &&
          'definition' in v &&
          typeof (v as RegisteredTool).definition?.name === 'string'
        ) {
          map[(v as RegisteredTool).definition.name] = v as RegisteredTool;
        }
      }
      return map;
    })();

    const subRegistry = new ToolRegistry();
    let missing = 0;
    for (const name of config.toolNames) {
      const tool = allTools[name];
      if (tool) subRegistry.register(tool);
      else missing++;
    }
    if (missing > 0) {
      console.warn(`[delegateToSubAgent] ${missing} tools do preset ${role} não encontradas no registry`);
    }

    const subContents: GeminiContent[] = [
      { role: 'user', parts: [{ text: task }] },
    ];

    const t0 = Date.now();
    try {
      const result = await runToolLoop({
        apiKey,
        model: 'gemini-2.5-flash',
        systemInstruction: config.systemPrompt,
        contents: subContents,
        registry: subRegistry,
        emit: makeSilentEmitter(),
        ctx: { ...ctx, clientId: subClientId },
        maxIterations: 4,
      });
      const durationMs = Date.now() - t0;
      const toolNames = result.toolCalls.map((c) => c.name);
      console.log(
        `[delegateToSubAgent] role=${role} ok — ${result.toolCalls.length} tools (${toolNames.join(', ')}) em ${durationMs}ms`,
      );
      return {
        ok: true,
        data: {
          role,
          task,
          finalText: result.finalText,
          toolCallsCount: result.toolCalls.length,
          toolNames,
          durationMs,
        },
      };
    } catch (err) {
      const durationMs = Date.now() - t0;
      console.error(`[delegateToSubAgent] role=${role} falhou após ${durationMs}ms:`, err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Erro no sub-agente.',
      };
    }
  },
};
