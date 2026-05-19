// Common handler wrapper: CORS + auth + JSON parse + error normalization.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from './cors.js';
import { verifyAuth, tryAuth, type AuthUser } from './auth.js';

export interface HandlerCtx {
  user: AuthUser;
  body: Record<string, unknown>;
  req: VercelRequest;
  res: VercelResponse;
}

export interface AnonHandlerCtx {
  user: AuthUser | null;
  body: Record<string, unknown>;
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

function parseBody(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  }
  return {};
}

function errorMessage(error: unknown, fallback = 'Internal error'): string {
  return error instanceof Error ? error.message : fallback;
}

function errorStatus(error: unknown, message: string): number {
  if (error && typeof error === 'object') {
    const value =
      (error as { statusCode?: unknown }).statusCode ??
      (error as { status?: unknown }).status;
    if (typeof value === 'number') return value;
  }
  return inferErrorStatus(message) || 500;
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
    applyCors(res, req);
    if (req.method !== 'POST') {
      return jsonError(res, 405, 'Method not allowed');
    }
    let user: AuthUser;
    try {
      user = await verifyAuth(req);
    } catch (err) {
      return jsonError(res, 401, errorMessage(err, 'Authentication required'));
    }
    try {
      const body = parseBody(req.body);
      const result = await fn({ user, body, req, res });
      if (!res.writableEnded) {
        res.status(200).json(result ?? { ok: true });
      }
    } catch (err) {
      console.error('[handler] error:', err);
      if (!res.writableEnded) {
        const msg = errorMessage(err);
        const status = errorStatus(err, msg);
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
    applyCors(res, req);
    if (req.method !== 'POST') {
      return jsonError(res, 405, 'Method not allowed');
    }
    const user = await tryAuth(req);
    try {
      const body = parseBody(req.body);
      const result = await fn({ user, body, req, res });
      if (!res.writableEnded) {
        res.status(200).json(result ?? { ok: true });
      }
    } catch (err) {
      console.error('[handler] error:', err);
      if (!res.writableEnded) {
        const msg = errorMessage(err);
        const status = errorStatus(err, msg);
        res.status(status).json({ error: msg });
      }
    }
  };
}
