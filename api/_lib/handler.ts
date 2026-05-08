// Common handler wrapper: CORS + auth + JSON parse + error normalization.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from './cors.js';
import { verifyAuth, tryAuth, type AuthUser } from './auth.js';

export interface HandlerCtx {
  user: AuthUser;
  body: any;
  req: VercelRequest;
  res: VercelResponse;
}

export interface AnonHandlerCtx {
  user: AuthUser | null;
  body: any;
  req: VercelRequest;
  res: VercelResponse;
}

type Handler<T = HandlerCtx> = (ctx: T) => Promise<unknown>;

/**
 * Heurística pra distinguir validation errors (4xx) de erros internos (5xx).
 * Marker substrings que aparecem em validation errors comuns deste codebase.
 * Retorna 400/401/403/404 baseado no padrão da mensagem.
 */
function inferErrorStatus(msg: string): number | null {
  if (!msg) return null;
  const m = msg.toLowerCase();
  // Auth-related
  if (/\bunauthor|authentication required|invalid token|expired token/i.test(msg)) return 401;
  if (/\baccess denied|acesso negado|forbidden|permiss/i.test(msg)) return 403;
  // Validation patterns
  if (
    /\b(is required|é obrigat|are required|é necess|must be|invalid input|invalid request|deve ser|inválid)/i.test(msg) ||
    /\b(missing|faltando|nenhum|empty)\b.*\b(field|param|argument|cliente)/i.test(m)
  ) return 400;
  return null;
}

/**
 * Wrap a handler that requires authentication. Auto-handles:
 *   - CORS preflight
 *   - Method check (POST default)
 *   - Auth verification
 *   - JSON body parse
 *   - Error -> 500 JSON
 * Returned value is JSON-encoded with 200 status (unless handler already responded).
 */
export function authedPost(fn: Handler<HandlerCtx>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    if (handlePreflight(req, res)) return;
    applyCors(res);
    if (req.method !== 'POST') {
      return jsonError(res, 405, 'Method not allowed');
    }
    let user: AuthUser;
    try {
      user = await verifyAuth(req);
    } catch (e: any) {
      return jsonError(res, 401, e.message || 'Authentication required');
    }
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : (req.body ? JSON.parse(req.body) : {});
      const result = await fn({ user, body, req, res });
      if (!res.writableEnded) {
        res.status(200).json(result ?? { ok: true });
      }
    } catch (e: any) {
      console.error('[handler] error:', e);
      if (!res.writableEnded) {
        const msg = e?.message || 'Internal error';
        const status = e?.statusCode || e?.status || inferErrorStatus(msg) || 500;
        res.status(status).json({ error: msg });
      }
    }
  };
}

/**
 * Same as authedPost but auth is optional.
 */
export function anonPost(fn: Handler<AnonHandlerCtx>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    if (handlePreflight(req, res)) return;
    applyCors(res);
    if (req.method !== 'POST') {
      return jsonError(res, 405, 'Method not allowed');
    }
    const user = await tryAuth(req);
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : (req.body ? JSON.parse(req.body) : {});
      const result = await fn({ user, body, req, res });
      if (!res.writableEnded) {
        res.status(200).json(result ?? { ok: true });
      }
    } catch (e: any) {
      console.error('[handler] error:', e);
      if (!res.writableEnded) {
        const msg = e?.message || 'Internal error';
        const status = e?.statusCode || e?.status || inferErrorStatus(msg) || 500;
        res.status(status).json({ error: msg });
      }
    }
  };
}
