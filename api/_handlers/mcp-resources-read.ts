/**
 * MCP endpoint: lê 1 resource pela URI `kai://<tipo>/<id>`.
 *
 * URL: GET /api/mcp/resources/read?uri=kai://client/xxx
 *      POST /api/mcp/resources/read   { uri: "..." }   (também JSON-RPC)
 *
 * Response: `{ contents: [McpResourceContent] }`
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { assertMcpAuth } from '../_lib/mcp/auth.js';
import { readResource } from '../_lib/mcp/resources.js';

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

  let uri: string | undefined;
  let isJsonRpc = false;
  let rpcId: any = null;

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body && body.jsonrpc) {
      isJsonRpc = true;
      rpcId = body.id ?? null;
      uri = body.params?.uri;
    } else if (body && typeof body.uri === 'string') {
      uri = body.uri;
    }
  } else {
    const q = req.query.uri;
    const qv = Array.isArray(q) ? q[0] : q;
    if (qv) uri = qv;
  }

  if (!uri) {
    if (isJsonRpc) {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: -32602, message: 'params.uri obrigatório' },
      });
    }
    return jsonError(res, 400, 'uri obrigatório (query ou body)');
  }

  try {
    const content = await readResource(auth, uri);

    if (isJsonRpc) {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: rpcId,
        result: { contents: [content] },
      });
    }

    return res.status(200).json({
      contents: [content],
    });
  } catch (err: any) {
    console.error('[mcp/resources-read] error:', err);
    if (isJsonRpc) {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: -32603, message: err?.message || 'Internal error' },
      });
    }
    return jsonError(res, err?.status || 500, err?.message || 'Internal error');
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
