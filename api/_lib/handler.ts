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
        res.status(500).json({ error: e?.message || 'Internal error' });
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
        res.status(500).json({ error: e?.message || 'Internal error' });
      }
    }
  };
}
