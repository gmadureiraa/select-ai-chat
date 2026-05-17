/**
 * Tool runner — orquestra o loop LLM ↔ tools do Gemini function calling (Node).
 */
import type { KAIStreamEmitter } from './kai-stream.js';
import type { ToolExecutionContext } from './types.js';
import { ToolRegistry } from './registry.js';
import { isApprovalRequest } from '../approval-flow.js';
import { getOrCreateGeminiCache } from './gemini-cache.js';

export interface GeminiContent {
  role: 'user' | 'model' | 'function';
  parts: GeminiPart[];
}

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiStreamResponse {
  candidates?: Array<{
    content?: GeminiContent;
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export interface RunToolLoopOptions {
  apiKey: string;
  model: string;
  orchestratorModel?: string;
  systemInstruction: string;
  contents: GeminiContent[];
  registry: ToolRegistry;
  emit: KAIStreamEmitter;
  ctx: ToolExecutionContext;
  maxIterations?: number;
  temperature?: number;
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function shouldUseOrchestrator(toolCallsSoFar: number, orchestratorModel?: string): boolean {
  if (!orchestratorModel) return false;
  return toolCallsSoFar >= 2;
}

export interface ToolTrace {
  /** Nome da tool conforme registrado (ex: createContent). */
  name: string;
  /** Latência em ms da chamada do handler. */
  durationMs: number;
  /** Resultado bruto: ok | error | approval (pending_approval cai em ok=true). */
  status: 'ok' | 'error' | 'approval';
  /** Iteração do tool-loop em que ocorreu (0-indexed). */
  iteration: number;
  /** Erro raw se status=error. */
  errorMessage?: string;
}

export async function runToolLoop(
  opts: RunToolLoopOptions,
): Promise<{
  finalText: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }>;
  cacheStats: { hits: number; creates: number; bypassed: number };
  toolTraces: ToolTrace[];
  /** Latência total das chamadas Gemini (sem incluir tool execution). */
  llmLatencyMs: number;
  /** Latência total agregada dos handlers de tool. */
  toolLatencyMs: number;
}> {
  const {
    apiKey,
    model,
    orchestratorModel,
    systemInstruction,
    contents,
    registry,
    emit,
    ctx,
    maxIterations = 8,
    temperature = 0.7,
  } = opts;

  const workingContents: GeminiContent[] = [...contents];
  const executedTools: Array<{ name: string; args: Record<string, unknown>; result: unknown }> = [];
  let finalText = '';
  const cacheStats = { hits: 0, creates: 0, bypassed: 0 };
  const toolTraces: ToolTrace[] = [];
  let llmLatencyMs = 0;
  let toolLatencyMs = 0;

  const toolDeclarations = registry.getDeclarations();

  for (let iter = 0; iter < maxIterations; iter++) {
    const activeModel =
      shouldUseOrchestrator(executedTools.length, orchestratorModel) && orchestratorModel
        ? orchestratorModel
        : model;
    if (activeModel !== model && iter > 0) {
      console.log(
        `[runToolLoop] upgrade pra orchestrator model (${activeModel}) na iter ${iter} após ${executedTools.length} tool calls`,
      );
    }

    // Tenta usar cached content pra system+tools (economiza ~75% input tokens
    // do prompt fixo). Se inviável (< min tokens, model sem suporte), cai pro
    // path normal com systemInstruction + tools inline.
    const cacheLookup = await getOrCreateGeminiCache({
      apiKey,
      model: activeModel,
      systemInstruction,
      tools: toolDeclarations,
    });
    if (cacheLookup.hit) cacheStats.hits++;
    else if (cacheLookup.cacheName) cacheStats.creates++;
    else cacheStats.bypassed++;

    const url = `${GEMINI_API_BASE}/${activeModel}:streamGenerateContent?key=${apiKey}&alt=sse`;
    const body: Record<string, unknown> = {
      contents: workingContents,
      // toolConfig.AUTO — Gemini decide entre chamar tool ou responder em texto.
      // Explícito pra deixar claro o contrato (default já é AUTO mas facilita debug).
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: {
        temperature,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    };
    if (cacheLookup.cacheName) {
      // Cached content já inclui systemInstruction + tools. Não pode duplicar
      // no body — a API rejeita.
      body.cachedContent = cacheLookup.cacheName;
    } else {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
      body.tools = [{ functionDeclarations: toolDeclarations }];
    }

    const llmT0 = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 500)}`);
    }
    if (!response.body) {
      throw new Error('Gemini API sem body');
    }

    const { assistantTurn, deltaText, pendingFunctionCalls } = await parseGeminiStream(
      response.body.getReader(),
      emit,
    );
    llmLatencyMs += Date.now() - llmT0;
    finalText += deltaText;

    if (pendingFunctionCalls.length > 0) {
      workingContents.push(assistantTurn);

      const functionResponseParts: GeminiPart[] = [];
      for (const call of pendingFunctionCalls) {
        emit.toolRunning({
          id: `call_${Math.random().toString(36).slice(2, 10)}`,
          name: call.name,
          label: humanLabelForTool(call.name),
        });

        const stopHeartbeat = emit.startHeartbeat(10_000);
        const toolT0 = Date.now();
        let result;
        let traceStatus: ToolTrace['status'] = 'ok';
        let traceError: string | undefined;
        try {
          result = await registry.execute(call.name, call.args, ctx);
          if (!result.ok) {
            traceStatus = 'error';
            traceError = result.error;
          } else if (isApprovalRequest(result.data)) {
            traceStatus = 'approval';
          }
        } catch (err) {
          traceStatus = 'error';
          traceError = err instanceof Error ? err.message : String(err);
          throw err;
        } finally {
          const duration = Date.now() - toolT0;
          toolLatencyMs += duration;
          toolTraces.push({
            name: call.name,
            durationMs: duration,
            status: traceStatus,
            iteration: iter,
            ...(traceError ? { errorMessage: traceError.slice(0, 300) } : {}),
          });
          stopHeartbeat();
        }
        executedTools.push({ name: call.name, args: call.args, result: result! });

        if (result.card) {
          emit.actionCard(result.card);
        }

        // Tool pediu approval — propaga via stream pra UI abrir o modal.
        // O LLM continua a conversa, mas a função response avisa que ficou
        // pendente (assim o LLM dá texto curto tipo "aguarda confirmação").
        if (result.ok && isApprovalRequest(result.data)) {
          const approval = result.data;
          // Garante que toolName e toolArgs estão preenchidos pra UI
          // conseguir re-call mesmo se a tool esqueceu de setar.
          const enriched = {
            ...approval,
            toolName: approval.toolName ?? call.name,
            toolArgs: approval.toolArgs ?? call.args,
          };
          emit.approvalRequest(enriched);
          functionResponseParts.push({
            functionResponse: {
              name: call.name,
              response: {
                data: {
                  status: 'pending_user_approval',
                  action: approval.action,
                  message:
                    'Aguardando confirmação humana no modal. Não chame essa tool de novo; o usuário vai confirmar ou cancelar pela UI.',
                },
              },
            },
          });
          continue;
        }

        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: result.ok
              ? { data: result.data ?? null }
              : { error: result.error ?? 'unknown error' },
          },
        });
      }

      workingContents.push({ role: 'function', parts: functionResponseParts });
      continue;
    }

    break;
  }

  return {
    finalText,
    toolCalls: executedTools,
    cacheStats,
    toolTraces,
    llmLatencyMs,
    toolLatencyMs,
  };
}

async function parseGeminiStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  emit: KAIStreamEmitter,
): Promise<{
  assistantTurn: GeminiContent;
  deltaText: string;
  pendingFunctionCalls: Array<{ name: string; args: Record<string, unknown> }>;
}> {
  const decoder = new TextDecoder();
  let buffer = '';
  const accumulatedParts: GeminiPart[] = [];
  let deltaText = '';
  const pendingFunctionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (!trimmed.startsWith('data: ')) continue;
      const jsonStr = trimmed.slice(6).trim();
      if (jsonStr === '[DONE]') continue;

      let parsed: GeminiStreamResponse;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        continue;
      }

      const candidate = parsed.candidates?.[0];
      if (!candidate?.content?.parts) continue;

      for (const part of candidate.content.parts) {
        if (part.text) {
          deltaText += part.text;
          emit.content(part.text);
          const lastText = accumulatedParts[accumulatedParts.length - 1];
          if (lastText?.text !== undefined) {
            lastText.text += part.text;
          } else {
            accumulatedParts.push({ text: part.text });
          }
        } else if (part.functionCall) {
          pendingFunctionCalls.push({
            name: part.functionCall.name,
            args: part.functionCall.args ?? {},
          });
          accumulatedParts.push({ functionCall: part.functionCall });
        } else if (part.inlineData) {
          accumulatedParts.push({ inlineData: part.inlineData });
        }
      }
    }
  }

  return {
    assistantTurn: { role: 'model', parts: accumulatedParts },
    deltaText,
    pendingFunctionCalls,
  };
}

function humanLabelForTool(name: string): string {
  const labels: Record<string, string> = {
    echo: 'Executando echo…',
    createContent: 'Gerando rascunho…',
    editContent: 'Reescrevendo rascunho…',
    publishNow: 'Publicando…',
    scheduleFor: 'Agendando…',
    getMetrics: 'Buscando métricas…',
    getClientContext: 'Lendo contexto do cliente…',
    searchLibrary: 'Pesquisando biblioteca…',
    listPendingApprovals: 'Listando rascunhos pendentes…',
    connectAccount: 'Verificando conta conectada…',
    cancelScheduled: 'Cancelando agendamento…',
  };
  return labels[name] ?? `Executando ${name}…`;
}
