/**
 * MCP endpoint: executa uma tool.
 *
 * URL: POST /api/mcp/tools/call (kebab fallback: /api/mcp-tools-call)
 *
 * Body (REST style):
 *   {
 *     "name": "listClients",
 *     "arguments": { "search": "defi" },
 *     "meta": { "clientId": "..." }  // opcional, usado como fallback se tool requer
 *   }
 *
 * Body (JSON-RPC style):
 *   {
 *     "jsonrpc": "2.0",
 *     "id": 1,
 *     "method": "tools/call",
 *     "params": { "name": "...", "arguments": {...} }
 *   }
 *
 * Response (REST):
 *   { content: [...], isError, structuredContent }
 *
 * Response (JSON-RPC):
 *   { jsonrpc: "2.0", id, result: { content: [...], isError } }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { assertMcpAuth } from '../_lib/mcp/auth.js';
import { invokeMcpTool } from '../_lib/mcp/invoke.js';
import { buildRateKey, classifyTool } from '../_lib/mcp/rate-limit-policy.js';
import { rateLimit } from '../_lib/shared/rate-limit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);

  if (req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed — use POST');
  }

  let auth;
  try {
    auth = await assertMcpAuth(req);
  } catch (err: any) {
    return jsonError(res, err?.status || 401, err?.message || 'Unauthorized');
  }

  const body = await readJsonBody(req);
  if (!body) return jsonError(res, 400, 'Invalid JSON body');

  const isJsonRpc = !!body.jsonrpc;
  const params = isJsonRpc ? (body.params ?? {}) : body;

  const toolName = params.name;
  const args = (params.arguments ?? params.args ?? {}) as Record<string, unknown>;
  const clientIdFallback = (params.meta?.clientId as string | undefined) ?? undefined;

  if (!toolName || typeof toolName !== 'string') {
    if (isJsonRpc) {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: body.id ?? null,
        error: { code: -32602, message: 'params.name (tool name) é obrigatório' },
      });
    }
    return jsonError(res, 400, 'name (tool name) é obrigatório');
  }

  // Rate-limit por bucket (cheap/normal/expensive/destructive) + identidade.
  // Upstash quando env setado, fallback in-memory per-instance.
  const policy = classifyTool(toolName);
  const rlKey = buildRateKey({
    bucket: policy.bucket,
    authMode: auth.mode,
    userId: auth.userId,
  });
  const rl = await rateLimit({
    key: rlKey,
    limit: policy.limit,
    windowMs: policy.windowMs,
  });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    res.setHeader('X-RateLimit-Bucket', policy.bucket);
    res.setHeader('X-RateLimit-Limit', String(policy.limit));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', String(Math.floor(rl.reset / 1000)));
    const message = `Rate limit excedido pra tool "${toolName}" (bucket=${policy.bucket}, ${policy.limit}/min). Tente em ${rl.retryAfterSec}s.`;
    if (isJsonRpc) {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: body.id ?? null,
        error: {
          code: -32029,
          message,
          data: {
            bucket: policy.bucket,
            limit: policy.limit,
            retryAfterSec: rl.retryAfterSec,
          },
        },
      });
    }
    return res.status(429).json({
      error: message,
      bucket: policy.bucket,
      limit: policy.limit,
      retryAfterSec: rl.retryAfterSec,
    });
  }
  res.setHeader('X-RateLimit-Bucket', policy.bucket);
  res.setHeader('X-RateLimit-Limit', String(policy.limit));
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(rl.reset / 1000)));

  try {
    const result = await invokeMcpTool({
      toolName,
      args,
      auth,
      req,
      clientIdFallback,
    });

    if (isJsonRpc) {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: body.id ?? null,
        result: {
          content: result.content,
          isError: result.isError,
          ...(result.structuredContent ? { structuredContent: result.structuredContent } : {}),
        },
      });
    }

    return res.status(result.isError ? 400 : 200).json(result);
  } catch (err: any) {
    console.error(`[mcp/tools-call] tool="${toolName}" error:`, err);
    if (isJsonRpc) {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: body.id ?? null,
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
