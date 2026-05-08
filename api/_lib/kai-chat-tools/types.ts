/**
 * Tipos de tools — infra pro Gemini function calling no kai-simple-chat (Node).
 * Diferenças vs Deno:
 *   - ctx.db = Neon Pool helpers (`query`, `queryOne`) em vez de supabase client.
 *   - Removemos `supabaseUrl`. Edge function chamadas viram chamadas internas
 *     a outros handlers Vercel — passamos `internalBaseUrl` (default = process.env.INTERNAL_API_BASE_URL ou monta do host).
 */
import type { KAIActionCard, KAIStreamEmitter } from './kai-stream.js';

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<
    string,
    {
      type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
      description: string;
      enum?: string[];
      items?: { type: string; description?: string };
      format?: string;
    }
  >;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export interface ToolExecutionContext {
  clientId: string;
  userId: string;
  conversationId?: string;
  emit: KAIStreamEmitter;
  /** Auth token bruto do request — usado pra chamar outros handlers internos. */
  accessToken: string;
  /**
   * Base URL pra chamadas internas a outros handlers Vercel. Em produção =
   * `https://<deploy>.vercel.app`. Em dev local = `http://localhost:3000` ou
   * o que `req.headers.host` indicar. Sempre sem trailing slash.
   */
  internalBaseUrl: string;
}

export interface ToolHandlerResult<TData = unknown> {
  ok: boolean;
  data?: TData;
  card?: KAIActionCard;
  error?: string;
}

export type ToolHandler<TArgs = Record<string, unknown>, TData = unknown> = (
  args: TArgs,
  ctx: ToolExecutionContext,
) => Promise<ToolHandlerResult<TData>>;

export interface RegisteredTool<TArgs = Record<string, unknown>, TData = unknown> {
  definition: ToolDefinition;
  handler: ToolHandler<TArgs, TData>;
}
