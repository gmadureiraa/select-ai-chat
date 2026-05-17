/**
 * MCP unified endpoint — JSON-RPC 2.0 over HTTP.
 *
 * URL: POST /api/mcp   (também responde GET com info do server pra discovery)
 *
 * Suporta o subset do MCP protocol que clients (Claude Code, Cursor) precisam:
 *   - initialize
 *   - tools/list
 *   - tools/call
 *   - resources/list
 *   - resources/read
 *   - ping
 *
 * Auth: igual `mcp-tools-call` — Bearer KAI_MCP_TOKEN OU JWT user.
 *
 * Setup do client:
 * ```json
 * {
 *   "mcpServers": {
 *     "kai": {
 *       "url": "https://kai.kaleidos.com.br/api/mcp",
 *       "headers": { "Authorization": "Bearer ${KAI_MCP_TOKEN}" }
 *     }
 *   }
 * }
 * ```
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { assertMcpAuth, tryMcpAuth } from '../_lib/mcp/auth.js';
import { invokeMcpTool } from '../_lib/mcp/invoke.js';
import { listMcpDescriptors, mcpRegistryStats } from '../_lib/mcp/registry.js';
import { listResources, readResource } from '../_lib/mcp/resources.js';

const PROTOCOL_VERSION = '2024-11-05';

const SERVER_INFO = {
  name: 'kaleidos-kai-mcp',
  version: '2.0.0',
};

const SERVER_CAPABILITIES = {
  tools: { listChanged: false },
  resources: { listChanged: false, subscribe: false },
  prompts: {},
  logging: {},
};

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

function rpcError(
  res: VercelResponse,
  id: any,
  code: number,
  message: string,
  data?: any,
) {
  return res.status(200).json({
    jsonrpc: '2.0',
    id,
    error: { code, message, ...(data ? { data } : {}) },
  });
}

function rpcResult(res: VercelResponse, id: any, result: any) {
  return res.status(200).json({ jsonrpc: '2.0', id, result });
}

async function readJsonBody(req: VercelRequest): Promise<any | null> {
  try {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string' && req.body.length > 0) {
      return JSON.parse(req.body);
    }
    return null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);

  // GET /api/mcp — info pública (não exige auth, mas só mostra metadados)
  if (req.method === 'GET') {
    const auth = await tryMcpAuth(req);
    const stats = mcpRegistryStats();
    return res.status(200).json({
      ...SERVER_INFO,
      protocolVersion: PROTOCOL_VERSION,
      capabilities: SERVER_CAPABILITIES,
      tools: { count: stats.count },
      authenticated: !!auth,
      authMode: auth?.mode ?? null,
      hint: 'POST JSON-RPC 2.0 requests to this URL. See MCP-SETUP.md.',
    });
  }

  if (req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed — use POST for JSON-RPC');
  }

  const body = (await readJsonBody(req)) as JsonRpcRequest | null;
  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return rpcError(res, null, -32700, 'Parse error / invalid JSON-RPC envelope');
  }

  const id = body.id ?? null;
  const method = body.method;
  const params = body.params ?? {};

  // `initialize` é permitido sem auth (negotiation) mas todo resto exige.
  if (method === 'initialize') {
    const clientProtocol = params.protocolVersion ?? PROTOCOL_VERSION;
    return rpcResult(res, id, {
      protocolVersion: clientProtocol,
      capabilities: SERVER_CAPABILITIES,
      serverInfo: SERVER_INFO,
      instructions:
        'KAI MCP server. Use tools/list pra descobrir tools, resources/list pra listar clients/planning/library.',
    });
  }

  // `notifications/initialized` é fire-and-forget
  if (method === 'notifications/initialized' || method === 'initialized') {
    return res.status(200).json({ jsonrpc: '2.0', id, result: {} });
  }

  if (method === 'ping') {
    return rpcResult(res, id, {});
  }

  // Demais methods exigem auth
  let auth;
  try {
    auth = await assertMcpAuth(req);
  } catch (err: any) {
    return rpcError(res, id, -32001, err?.message || 'Unauthorized');
  }

  try {
    switch (method) {
      case 'tools/list': {
        return rpcResult(res, id, { tools: listMcpDescriptors() });
      }

      case 'tools/call': {
        const toolName = params.name;
        if (!toolName || typeof toolName !== 'string') {
          return rpcError(res, id, -32602, 'params.name (tool name) é obrigatório');
        }
        const args = (params.arguments ?? params.args ?? {}) as Record<string, unknown>;
        const clientIdFallback = params.meta?.clientId as string | undefined;
        const result = await invokeMcpTool({
          toolName,
          args,
          auth,
          req,
          clientIdFallback,
        });
        return rpcResult(res, id, {
          content: result.content,
          isError: result.isError,
          ...(result.structuredContent
            ? { structuredContent: result.structuredContent }
            : {}),
        });
      }

      case 'resources/list': {
        const limit = typeof params.limit === 'number' ? params.limit : undefined;
        const resources = await listResources(auth, limit);
        return rpcResult(res, id, { resources });
      }

      case 'resources/read': {
        const uri = params.uri;
        if (!uri || typeof uri !== 'string') {
          return rpcError(res, id, -32602, 'params.uri obrigatório');
        }
        const content = await readResource(auth, uri);
        return rpcResult(res, id, { contents: [content] });
      }

      case 'prompts/list':
      case 'resources/templates/list': {
        // Não implementado mas devolve vazio pra clients não quebrarem
        const key = method.startsWith('prompts') ? 'prompts' : 'resourceTemplates';
        return rpcResult(res, id, { [key]: [] });
      }

      default:
        return rpcError(res, id, -32601, `Method não suportado: ${method}`);
    }
  } catch (err: any) {
    console.error(`[mcp] method="${method}" error:`, err);
    return rpcError(res, id, -32603, err?.message || 'Internal error');
  }
}
