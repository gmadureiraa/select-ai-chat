/**
 * MCP endpoint: lista todas as tools disponíveis.
 *
 * URLs (via router /api/<slug>):
 *   GET  /api/mcp/tools/list   → fallback kebab → `mcp-tools-list`
 *   GET  /api/mcp-tools-list   → direto
 *
 * Auth: aceita `Authorization: Bearer ${KAI_MCP_TOKEN}` OU JWT user.
 * Em open discovery mode (sem `KAI_MCP_TOKEN` configurado) o endpoint é
 * acessível sem Bearer — mas isso só faz sentido em dev. Em prod, configure.
 *
 * Response: `{ tools: McpToolDescriptor[], count: number, server: {...} }`
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryMcpAuth } from '../_lib/mcp/auth.js';
import { listMcpDescriptors, mcpRegistryStats } from '../_lib/mcp/registry.js';

const SERVER_INFO = {
  name: 'kaleidos-kai-mcp',
  version: '2.0.0',
  description:
    'KAI MCP server (full tool catalog) — auto-discovered from kai-chat-tools/index.ts',
  protocolVersion: '2024-11-05',
};

function authConfigured(): boolean {
  return !!(process.env.KAI_MCP_TOKEN || process.env.MCP_ACCESS_TOKEN);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // Auth: required when token is configured
  if (authConfigured()) {
    const auth = await tryMcpAuth(req);
    if (!auth) {
      return jsonError(res, 401, 'Unauthorized — provide KAI_MCP_TOKEN bearer or JWT');
    }
  }

  try {
    const tools = listMcpDescriptors();
    const stats = mcpRegistryStats();

    // JSON-RPC tools/list shape support (when body has jsonrpc)
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if (body && body.jsonrpc) {
        return res.status(200).json({
          jsonrpc: '2.0',
          id: body.id ?? null,
          result: { tools },
        });
      }
    }

    return res.status(200).json({
      server: SERVER_INFO,
      tools,
      count: stats.count,
    });
  } catch (err: any) {
    console.error('[mcp/tools-list] error:', err);
    return jsonError(res, 500, err?.message || 'Internal error');
  }
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
