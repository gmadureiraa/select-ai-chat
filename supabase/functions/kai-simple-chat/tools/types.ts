/**
 * Tipos de tools — infra pro Gemini function calling no kai-simple-chat.
 *
 * Cada Tool = function declaration (schema JSON pro LLM) + handler (executa
 * server-side quando o LLM chama). O runner (`runner.ts`) orquestra o loop:
 * LLM → emits tool_call → handler roda → resposta volta pro LLM → continua.
 */

import type {
  KAIActionCard,
  KAIStreamEmitter,
} from "../../_shared/kai-stream.ts";

// deno-lint-ignore no-explicit-any
export type SupabaseClient = any;

/**
 * JSON Schema para args da tool (subset do que Gemini function calling aceita).
 * Spec: https://ai.google.dev/gemini-api/docs/function-calling
 */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<
    string,
    {
      type: "string" | "number" | "integer" | "boolean" | "array" | "object";
      description: string;
      enum?: string[];
      items?: { type: string; description?: string };
      format?: string; // "date-time", "email", etc
    }
  >;
  required?: string[];
}

/** Declaração que vai pro LLM no campo `tools`. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

/** Contexto compartilhado entre handlers — injetado pelo runner a cada chamada. */
export interface ToolExecutionContext {
  supabase: SupabaseClient;
  clientId: string;
  userId: string;
  conversationId?: string;
  /** Emitter pra tool enviar action_card ou tool_running incremental. */
  emit: KAIStreamEmitter;
  /** Auth token do request (caso a tool precise chamar outra edge function). */
  accessToken: string;
  /** URL base do Supabase (pra tool chamar outras edges). */
  supabaseUrl: string;
}

/**
 * Resultado de uma tool execution:
 *   - `data` é injetado de volta no LLM como tool_result (pro próximo turno).
 *   - `card` (opcional) é emitido pro front renderizar no chat.
 *   - `error` encerra a tool com falha; o LLM recebe a mensagem e pode reagir.
 */
export interface ToolHandlerResult<TData = unknown> {
  ok: boolean;
  data?: TData;
  card?: KAIActionCard;
  error?: string;
}

/** Assinatura que cada tool handler implementa. */
export type ToolHandler<TArgs = Record<string, unknown>, TData = unknown> = (
  args: TArgs,
  ctx: ToolExecutionContext,
) => Promise<ToolHandlerResult<TData>>;

/** Par completo que vai no registry: declaração + handler. */
export interface RegisteredTool<TArgs = Record<string, unknown>, TData = unknown> {
  definition: ToolDefinition;
  handler: ToolHandler<TArgs, TData>;
}
