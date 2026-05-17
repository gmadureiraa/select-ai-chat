/**
 * Helper compartilhado: invoca uma tool registrada e devolve resultado num
 * shape MCP `{content: [...], isError?: boolean}`.
 *
 * Constrói o `ToolExecutionContext` baseado no resultado de `assertMcpAuth`.
 * Quando rodando em service mode (sem `clientId` enviado) tools de escrita
 * podem precisar do `clientId` no argumento — não tentamos adivinhar.
 */
import type { VercelRequest } from '@vercel/node';
import type {
  ToolExecutionContext,
  ToolHandlerResult,
} from '../kai-chat-tools/types.js';
import type { McpAuthResult } from './auth.js';
import { getMcpToolRegistry } from './registry.js';
import { createBufferedEmitter } from './buffered-emitter.js';

export interface McpInvokeOptions {
  toolName: string;
  args: Record<string, unknown>;
  auth: McpAuthResult;
  req: VercelRequest;
  /**
   * Quando o caller já sabe o `clientId` do contexto MCP (ex: passou como
   * `meta.clientId`), pode injetar pra não precisar repetir no `args`.
   */
  clientIdFallback?: string;
  /** Override do baseUrl pra calls internas (testes). */
  internalBaseUrl?: string;
}

export interface McpContentBlock {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

export interface McpInvokeResult {
  content: McpContentBlock[];
  isError: boolean;
  /** Estruturado pra clients que entendem (Claude Code custom UI etc). */
  structuredContent?: Record<string, unknown>;
}

function getInternalBaseUrl(req: VercelRequest): string {
  if (process.env.INTERNAL_API_BASE_URL) {
    return process.env.INTERNAL_API_BASE_URL.replace(/\/$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers.host;
  if (host) return `${proto}://${host}`;
  return 'https://kai-2-topaz.vercel.app';
}

function readHeader(req: VercelRequest, name: string): string | null {
  const raw = req.headers[name.toLowerCase()];
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] : raw;
}

function readBearer(req: VercelRequest): string | null {
  const auth = req.headers.authorization || (req.headers as any).Authorization;
  const headerVal = Array.isArray(auth) ? auth[0] : auth;
  if (!headerVal) return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerVal.trim());
  return match ? match[1] : null;
}

/**
 * Resolve qual `clientId` usar pro tool execution context. Tools que NÃO
 * precisam de cliente (ex: `listClients`, `echo`) recebem string vazia
 * — handlers downstream devem tolerar isso (a maioria já tolera porque o
 * `clientId` é só passado adiante).
 */
function resolveClientId(
  args: Record<string, unknown>,
  fallback?: string,
): string {
  const fromArgs = args.clientId ?? args.client_id;
  if (typeof fromArgs === 'string' && fromArgs.length > 0) return fromArgs;
  if (fallback) return fallback;
  return '';
}

export async function invokeMcpTool(
  opts: McpInvokeOptions,
): Promise<McpInvokeResult> {
  const registry = getMcpToolRegistry();
  if (!registry.has(opts.toolName)) {
    return toErrorResult(
      `Tool "${opts.toolName}" não existe. Disponíveis em /api/mcp/tools/list.`,
    );
  }

  const clientId = resolveClientId(opts.args, opts.clientIdFallback);
  const baseUrl = opts.internalBaseUrl ?? getInternalBaseUrl(opts.req);
  const accessToken =
    readBearer(opts.req) ||
    process.env.KAI_MCP_TOKEN ||
    process.env.MCP_ACCESS_TOKEN ||
    '';

  // Em service mode, dizemos pras tools downstream que esta é internal
  // call (igual o pattern do bot Telegram / dev-test-flows). Tools fazem
  // fetch HTTP com header `x-internal-cron-secret` em vez de Bearer JWT.
  const isInternalCall = opts.auth.mode === 'service';
  const conversationId = readHeader(opts.req, 'x-mcp-conversation-id') || undefined;

  if (isInternalCall && !opts.auth.userId) {
    return toErrorResult(
      'MCP service token sem `x-mcp-user-id` header — algumas tools (que persistem dados) precisam de um user owner. Setar `x-mcp-user-id: <uuid>` na request.',
    );
  }

  const emitter = createBufferedEmitter();
  const ctx: ToolExecutionContext = {
    clientId,
    userId: opts.auth.userId ?? '',
    conversationId,
    emit: emitter,
    accessToken,
    internalBaseUrl: baseUrl,
    isInternalCall,
  };

  let result: ToolHandlerResult;
  try {
    result = await registry.execute(opts.toolName, opts.args, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return toErrorResult(`Tool "${opts.toolName}" throw: ${msg}`);
  }

  return formatResult(opts.toolName, result, emitter.events);
}

function toErrorResult(message: string): McpInvokeResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function formatResult(
  toolName: string,
  result: ToolHandlerResult,
  events: ReturnType<typeof createBufferedEmitter>['events'],
): McpInvokeResult {
  const blocks: McpContentBlock[] = [];

  // Concat any streamed content (rare for tools, common for runner)
  if (events.content.length > 0) {
    blocks.push({ type: 'text', text: events.content.join('') });
  }

  if (!result.ok) {
    const errText = result.error ?? `Tool "${toolName}" failed without message`;
    blocks.push({ type: 'text', text: `ERROR: ${errText}` });
    return {
      content: blocks,
      isError: true,
      structuredContent: { ok: false, error: errText },
    };
  }

  // Stringify the data payload pretty
  if (result.data !== undefined) {
    blocks.push({
      type: 'text',
      text: typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data, null, 2),
    });
  }

  // Cards/imagens emitidas viram content blocks adicionais
  for (const img of events.images) {
    blocks.push({ type: 'image', uri: img });
  }
  if (result.card) {
    blocks.push({
      type: 'text',
      text: `[action_card] ${JSON.stringify(result.card, null, 2)}`,
    });
  }
  for (const card of events.actionCards) {
    blocks.push({
      type: 'text',
      text: `[action_card] ${JSON.stringify(card, null, 2)}`,
    });
  }
  for (const approval of events.approvalRequests) {
    blocks.push({
      type: 'text',
      text: `[approval_required] ${JSON.stringify(approval, null, 2)}`,
    });
  }
  for (const err of events.errors) {
    blocks.push({ type: 'text', text: `[stream_error] ${err}` });
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'text', text: `${toolName} executed OK (no payload).` });
  }

  const structured: Record<string, unknown> = {
    ok: true,
    data: result.data ?? null,
  };
  if (result.card) structured.card = result.card;
  if (events.actionCards.length > 0) structured.actionCards = events.actionCards;
  if (events.approvalRequests.length > 0) structured.approvalRequests = events.approvalRequests;
  if (events.content.length > 0) structured.streamContent = events.content.join('');

  return {
    content: blocks,
    isError: false,
    structuredContent: structured,
  };
}
