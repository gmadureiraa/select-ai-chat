#!/usr/bin/env bun
/**
 * Eval runner standalone — roda cases de `kai-chat-prompts.ts` contra Gemini
 * usando o registry real de tools, mas com handlers STUB (não toca o banco).
 *
 * Saída: relatório legível no terminal + JSON em `evals/last-run.json`.
 *
 * Uso:
 *   bun run eval                    # roda todos
 *   bun run eval --tag content      # filtra por tag
 *   bun run eval --case create-tweet --case metrics-recent
 *   bun run eval --model gemini-2.5-flash-lite
 *
 * Env obrigatório: GOOGLE_API_KEY (ou GEMINI_API_KEY).
 */
import { ToolRegistry } from '../api/_lib/kai-chat-tools/registry.js';
import { runToolLoop } from '../api/_lib/kai-chat-tools/runner.js';
import type {
  RegisteredTool,
  ToolExecutionContext,
} from '../api/_lib/kai-chat-tools/types.js';
import type { KAIStreamEmitter } from '../api/_lib/kai-chat-tools/kai-stream.js';
import { EVAL_CASES, type ChatEvalCase } from './kai-chat-prompts.js';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ───────────────────────────────────────────────────────────────────
// CLI args
// ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const argTags: string[] = [];
const argCases: string[] = [];
let argModel = 'gemini-2.5-flash';
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--tag' && argv[i + 1]) argTags.push(argv[++i]);
  if (a === '--case' && argv[i + 1]) argCases.push(argv[++i]);
  if (a === '--model' && argv[i + 1]) argModel = argv[++i];
}

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ GOOGLE_API_KEY (ou GEMINI_API_KEY) ausente no env.');
  process.exit(1);
}

// ───────────────────────────────────────────────────────────────────
// Tool definitions importadas das reais — handlers viram stubs
// ───────────────────────────────────────────────────────────────────
import * as Tools from '../api/_lib/kai-chat-tools/index.js';

function buildStubRegistry(): { registry: ToolRegistry; called: string[] } {
  const called: string[] = [];
  const registry = new ToolRegistry();

  const wrap = <T extends RegisteredTool>(real: T): RegisteredTool => ({
    definition: real.definition,
    handler: async (args: Record<string, unknown>) => {
      called.push(real.definition.name);
      // Stub default: pra delete tools, retorna pending_approval — garante que
      // o eval `delete-needs-approval` valide o flow.
      if (real.definition.name.startsWith('delete')) {
        return {
          ok: true,
          data: {
            type: 'approval_request',
            action: real.definition.name,
            message: 'Aguardando confirmação humana.',
            toolName: real.definition.name,
            toolArgs: args,
          },
        };
      }
      // Stub default pra read: devolve payload vazio mas válido
      return { ok: true, data: { stub: true, args } };
    },
  });

  // Registra todas as tools usadas pelo handler real, em wrapper-stub
  const toolList = [
    Tools.echoTool,
    Tools.createContentTool,
    Tools.createViralCarouselTool,
    Tools.editContentTool,
    Tools.listPendingApprovalsTool,
    Tools.getClientContextTool,
    Tools.searchLibraryTool,
    Tools.publishNowTool,
    Tools.scheduleForTool,
    Tools.connectAccountTool,
    Tools.getMetricsTool,
    Tools.createTeamTaskTool,
    Tools.saveToLibraryTool,
    Tools.createAutomationTool,
    Tools.listAutomationsTool,
    Tools.toggleAutomationTool,
    Tools.updateClientTool,
    Tools.searchRefsTool,
    Tools.listClientsTool,
    Tools.createClientTool,
    Tools.addToPlanningTool,
    Tools.getPostTranscriptionTool,
    Tools.getPlanningItemTool,
    Tools.getRecentPerformanceTool,
    Tools.getWorkspaceMembersTool,
    Tools.getBrandAssetsTool,
    Tools.getVoiceProfileTool,
    Tools.getIntegrationsStatusTool,
    Tools.getAuditLogTool,
    Tools.getReferencesTool,
    Tools.getWorkflowsTool,
    Tools.getNotificationsTool,
    Tools.getRecentActivityTool,
    Tools.getUIStateTool,
    Tools.editTaskTool,
    Tools.updateWorkflowTool,
    Tools.addWorkspaceMemberTool,
    Tools.removeWorkspaceMemberTool,
    Tools.updateMemberRoleTool,
    Tools.updateBrandAssetsTool,
    Tools.updateVoiceProfileTool,
    Tools.addReferenceTool,
    Tools.editReferenceTool,
    Tools.updateClientSettingsTool,
    Tools.deleteContentTool,
    Tools.deleteTaskTool,
    Tools.deletePlanningItemTool,
    Tools.deleteReferenceTool,
    Tools.deleteAutomationTool,
  ];
  for (const t of toolList) {
    if (!t) continue;
    registry.register(wrap(t));
  }
  return { registry, called };
}

// Emitter stub — captura output sem mexer em stream
function makeStubEmitter(): KAIStreamEmitter {
  const buffer = { text: '', cards: [] as unknown[] };
  const emit: KAIStreamEmitter = {
    content: (t: string) => {
      buffer.text += t;
    },
    toolRunning: () => {},
    toolResult: () => {},
    actionCard: (c) => buffer.cards.push(c),
    approvalRequest: () => {},
    error: () => {},
    done: () => {},
    startHeartbeat: () => () => {},
  };
  return emit;
}

const systemInstruction = [
  'Você é o KAI, um agente de marketing da Kaleidos.',
  'Use as tools disponíveis pra responder. Quando o pedido é simples (saudação, meta-pergunta), responda em texto sem chamar tools.',
  'NUNCA publique automaticamente sem o user pedir explicitamente (palavras como "publica", "posta").',
  'Pra deletar qualquer coisa, sempre peça confirmação (a tool já gerencia o flow de approval).',
  'Quando o user pede no "tom de um cliente", carregue o contexto antes de gerar.',
].join('\n');

// ───────────────────────────────────────────────────────────────────
// Runner
// ───────────────────────────────────────────────────────────────────
interface CaseResult {
  case: ChatEvalCase;
  pass: boolean;
  reasons: string[];
  toolsCalled: string[];
  finalText: string;
  durationMs: number;
}

async function runCase(c: ChatEvalCase): Promise<CaseResult> {
  const t0 = Date.now();
  const { registry, called } = buildStubRegistry();
  const emit = makeStubEmitter();
  const ctx: ToolExecutionContext = {
    clientId: 'eval-stub-client',
    userId: 'eval-stub-user',
  };

  const contents = [];
  if (c.history) {
    for (const h of c.history) {
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }],
      } as const);
    }
  }
  contents.push({
    role: 'user' as const,
    parts: [{ text: c.prompt }],
  });

  let finalText = '';
  const reasons: string[] = [];

  try {
    const result = await runToolLoop({
      apiKey: apiKey!,
      model: argModel,
      systemInstruction,
      contents: contents as any,
      registry,
      emit,
      ctx,
      maxIterations: 5,
    });
    finalText = result.finalText;
  } catch (err) {
    reasons.push(`runtime error: ${err instanceof Error ? err.message : String(err)}`);
    return {
      case: c,
      pass: false,
      reasons,
      toolsCalled: called,
      finalText,
      durationMs: Date.now() - t0,
    };
  }

  // Assertions
  if (c.expectedTools) {
    for (const t of c.expectedTools) {
      if (!called.includes(t)) reasons.push(`expected tool "${t}" não foi chamada`);
    }
  }
  if (c.forbiddenTools) {
    for (const t of c.forbiddenTools) {
      if (called.includes(t)) reasons.push(`forbidden tool "${t}" foi chamada`);
    }
  }
  if (typeof c.maxToolCalls === 'number' && called.length > c.maxToolCalls) {
    reasons.push(`maxToolCalls=${c.maxToolCalls} ultrapassado (foram ${called.length})`);
  }
  const lower = finalText.toLowerCase();
  if (c.expectedText) {
    for (const s of c.expectedText) {
      if (!lower.includes(s.toLowerCase())) reasons.push(`expectedText "${s}" não apareceu`);
    }
  }
  if (c.forbiddenText) {
    for (const s of c.forbiddenText) {
      if (lower.includes(s.toLowerCase())) reasons.push(`forbiddenText "${s}" apareceu`);
    }
  }

  return {
    case: c,
    pass: reasons.length === 0,
    reasons,
    toolsCalled: called,
    finalText,
    durationMs: Date.now() - t0,
  };
}

// ───────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────
async function main() {
  let cases = EVAL_CASES;
  if (argTags.length) {
    cases = cases.filter((c) => c.tags.some((t) => argTags.includes(t)));
  }
  if (argCases.length) {
    cases = cases.filter((c) => argCases.includes(c.id));
  }
  if (!cases.length) {
    console.error('❌ Nenhum case bate com os filtros.');
    process.exit(1);
  }

  console.log(`\n🧪 Rodando ${cases.length} eval(s) — model=${argModel}\n`);
  const results: CaseResult[] = [];
  for (const c of cases) {
    process.stdout.write(`  ${c.id.padEnd(34)} `);
    const r = await runCase(c);
    results.push(r);
    if (r.pass) {
      console.log(`✓  (${r.durationMs}ms, ${r.toolsCalled.length} tools)`);
    } else {
      console.log(`✗  (${r.durationMs}ms)`);
      for (const reason of r.reasons) {
        console.log(`     · ${reason}`);
      }
      if (r.toolsCalled.length > 0) {
        console.log(`     tools chamadas: [${r.toolsCalled.join(', ')}]`);
      }
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const totalMs = results.reduce((a, r) => a + r.durationMs, 0);

  console.log(
    `\n📊 ${passed}/${results.length} passed (${failed} failed) — ${(totalMs / 1000).toFixed(1)}s total\n`,
  );

  // Persiste JSON pra histórico/CI
  const reportPath = join(__dirname, 'last-run.json');
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        model: argModel,
        totalMs,
        results: results.map((r) => ({
          id: r.case.id,
          pass: r.pass,
          reasons: r.reasons,
          toolsCalled: r.toolsCalled,
          durationMs: r.durationMs,
          finalTextSnippet: r.finalText.slice(0, 200),
        })),
      },
      null,
      2,
    ),
  );
  console.log(`📝 relatório salvo em ${reportPath}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('💥 Eval runner crashed:', err);
  process.exit(1);
});
