/**
 * Tool runner — orquestra o loop LLM ↔ tools do Gemini function calling.
 *
 * Fluxo:
 *   1. Envia request pro Gemini com tools=[...registry.getDeclarations()]
 *   2. Lê stream: se vier texto, emite content delta pro front
 *   3. Se vier functionCall, executa handler → re-injeta functionResponse → volta ao Gemini
 *   4. Repete até finish_reason = "stop" ou atingir maxIterations
 *
 * Emite eventos SSE via o emitter (content, tool_running, action_card, error).
 *
 * NOTA: este arquivo ainda não é usado pelo index.ts. Será ativado na F0.3b
 * via feature flag USE_TOOL_CALLING.
 */

import type { KAIStreamEmitter } from "../../_shared/kai-stream.ts";
import type { ToolExecutionContext } from "./types.ts";
import { ToolRegistry } from "./registry.ts";

/** Mensagem no formato que Gemini consome (role + parts). */
export interface GeminiContent {
  role: "user" | "model" | "function";
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
  /** Modelo default (usado na primeira iteração). Ex: "gemini-2.5-flash". */
  model: string;
  /**
   * Modelo para iterações com multi-tool orchestration (F5).
   * Ex: "gemini-2.5-pro". Ativado automaticamente se:
   *   - houve 2+ tool_calls em iterações anteriores OU
   *   - o usuário explicitamente pediu múltiplas ações em 1 turno
   * Se omitido, usa o mesmo `model` em todas as iterações.
   */
  orchestratorModel?: string;
  systemInstruction: string;
  contents: GeminiContent[];
  registry: ToolRegistry;
  emit: KAIStreamEmitter;
  ctx: ToolExecutionContext;
  maxIterations?: number;
  temperature?: number;
}

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Heurística pra decidir quando usar o orchestratorModel (F5).
 * Upgrade pra Pro a partir da 2ª chamada consecutiva de tools, que é
 * onde a latência extra compensa pela qualidade do raciocínio
 * multi-step ("cria 3 posts E agenda 1 por dia" tipo).
 */
function shouldUseOrchestrator(
  toolCallsSoFar: number,
  orchestratorModel?: string,
): boolean {
  if (!orchestratorModel) return false;
  return toolCallsSoFar >= 2;
}

/**
 * Roda um turno inteiro de conversa com tool-calling habilitado.
 * Returns o texto final do assistant (concatenação de todos os deltas) +
 * lista de tool calls executadas (pra logging/usage tracking).
 */
export async function runToolLoop(
  opts: RunToolLoopOptions,
): Promise<{ finalText: string; toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }> }> {
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
  let finalText = "";

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
    const url = `${GEMINI_API_BASE}/${activeModel}:streamGenerateContent?key=${apiKey}&alt=sse`;
    const body = {
      contents: workingContents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: [{ functionDeclarations: registry.getDeclarations() }],
      generationConfig: {
        temperature,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 500)}`);
    }

    // Parse SSE do Gemini e acumula turnos de model
    const { assistantTurn, deltaText, pendingFunctionCalls } = await parseGeminiStream(
      response.body!.getReader(),
      emit,
    );
    finalText += deltaText;

    // Se houver function calls, executa todas e volta pro loop
    if (pendingFunctionCalls.length > 0) {
      workingContents.push(assistantTurn); // adiciona turno do model (com functionCalls)

      const functionResponseParts: GeminiPart[] = [];
      for (const call of pendingFunctionCalls) {
        emit.toolRunning({
          id: `call_${Math.random().toString(36).slice(2, 10)}`,
          name: call.name,
          label: humanLabelForTool(call.name),
        });

        const result = await registry.execute(call.name, call.args, ctx);
        executedTools.push({ name: call.name, args: call.args, result });

        if (result.card) {
          emit.actionCard(result.card);
        }

        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: result.ok
              ? { data: result.data ?? null }
              : { error: result.error ?? "unknown error" },
          },
        });
      }

      // Injeta function responses como próximo turno user
      workingContents.push({ role: "function", parts: functionResponseParts });
      continue; // volta pro while — Gemini vai reagir aos resultados
    }

    // Sem mais function calls — loop termina
    break;
  }

  return { finalText, toolCalls: executedTools };
}

/**
 * Parseia o stream SSE nativo do Gemini (JSON lines em data: …),
 * emite content deltas via `emit.content()` e retorna o turno acumulado
 * do model + function calls pendentes pra execução.
 */
async function parseGeminiStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  emit: KAIStreamEmitter,
): Promise<{
  assistantTurn: GeminiContent;
  deltaText: string;
  pendingFunctionCalls: Array<{ name: string; args: Record<string, unknown> }>;
}> {
  const decoder = new TextDecoder();
  let buffer = "";
  const accumulatedParts: GeminiPart[] = [];
  let deltaText = "";
  const pendingFunctionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (!trimmed.startsWith("data: ")) continue;
      const jsonStr = trimmed.slice(6).trim();
      if (jsonStr === "[DONE]") continue;

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
          // Acumula num único text part (Gemini envia em chunks)
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
          // TODO: emit.image() quando tiver imagem generation
        }
      }
    }
  }

  return {
    assistantTurn: { role: "model", parts: accumulatedParts },
    deltaText,
    pendingFunctionCalls,
  };
}

function humanLabelForTool(name: string): string {
  const labels: Record<string, string> = {
    echo: "Executando echo…",
    createContent: "Gerando rascunho…",
    editContent: "Reescrevendo rascunho…",
    publishNow: "Publicando…",
    scheduleFor: "Agendando…",
    getMetrics: "Buscando métricas…",
    getClientContext: "Lendo contexto do cliente…",
    searchLibrary: "Pesquisando biblioteca…",
    listPendingApprovals: "Listando rascunhos pendentes…",
    connectAccount: "Verificando conta conectada…",
    cancelScheduled: "Cancelando agendamento…",
  };
  return labels[name] ?? `Executando ${name}…`;
}
