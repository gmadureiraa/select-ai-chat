/**
 * MCP endpoint: lista resources (clients, planning items, library items).
 *
 * URL: GET /api/mcp/resources/list  (kebab: /api/mcp-resources-list)
 *
 * Query: `?limit=50` (cap por tipo, default 25, max 200)
 *
 * Response: `{ resources: McpResourceDescriptor[], count }`
 * JSON-RPC support via POST.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { assertMcpAuth } from '../_lib/mcp/auth.js';
import { listResources } from '../_lib/mcp/resources.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed');
  }

  let auth;
  try {
    auth = await assertMcpAuth(req);
  } catch (err: any) {
    return jsonError(res, err?.status || 401, err?.message || 'Unauthorized');
  }

  let limit: number | undefined;
  let isJsonRpc = false;
  let rpcId: any = null;

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body && body.jsonrpc) {
      isJsonRpc = true;
      rpcId = body.id ?? null;
      const p = body.params ?? {};
      if (typeof p.limit === 'number') limit = p.limit;
    } else if (body && typeof body.limit === 'number') {
      limit = body.limit;
    }
  } else {
    const q = req.query.limit;
    const qv = Array.isArray(q) ? q[0] : q;
    if (qv) {
      const n = parseInt(qv, 10);
      if (Number.isFinite(n)) limit = n;
    }
  }

  try {
    const resources = await listResources(auth, limit);

    if (isJsonRpc) {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: rpcId,
        result: { resources },
      });
    }

    return res.status(200).json({
      resources,
      count: resources.length,
    });
  } catch (err: any) {
    console.error('[mcp/resources-list] error:', err);
    if (isJsonRpc) {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: -32603, message: err?.message || 'Internal error' },
      });
    }
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
