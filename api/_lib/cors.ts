// CORS helpers para Vercel Functions.
//
// Política (2026-05-17 hardening):
// - Aceita Origin se bater na allow-list de domínios próprios + localhost dev.
// - Em qualquer outro caso, NÃO ecoa o Origin (browsers bloqueiam request).
// - Endpoints MCP/Bearer-only podem ser chamados via fetch direto (sem CORS)
//   por server-to-server, mas browsers de origens não autorizadas não enviam
//   credenciais — preservando token MCP de exfil cross-origin.
//
// Mantemos `Access-Control-Allow-Headers/Methods` amplos pra simplicidade
// (são metadados, não credenciais).
import type { VercelRequest, VercelResponse } from '@vercel/node';

const STATIC_ALLOWED_ORIGINS = new Set<string>([
  'https://kai-2-topaz.vercel.app',
  'https://kai.kaleidos.com.br',
  'https://kaleidos.com.br',
  'https://www.kaleidos.com.br',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
]);

const ALLOWED_HOST_SUFFIXES = [
  '.kaleidos.com.br',
];

function deploymentHosts(): Set<string> {
  return new Set(
    [
      process.env.VERCEL_URL,
      process.env.VERCEL_BRANCH_URL,
      process.env.NEXT_PUBLIC_VERCEL_URL,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.replace(/^https?:\/\//, '').replace(/\/$/, '')),
  );
}

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    const host = url.host;
    if (deploymentHosts().has(host)) return true;
    if (ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return true;
  } catch {
    return false;
  }
  return false;
}

function resolveOriginHeader(req: VercelRequest): string | null {
  const raw = req.headers.origin;
  const origin = Array.isArray(raw) ? raw[0] : raw;
  if (!origin) return null;
  return isOriginAllowed(origin) ? origin : null;
}

export const baseCorsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-mcp-user-id, x-mcp-conversation-id, x-kai-ui-state, x-internal-cron-secret, x-internal-call, x-internal-user-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Vary': 'Origin',
};

/**
 * Mantido por compat — código antigo importa `corsHeaders` sem origem.
 * Não inclui Allow-Origin (que precisa do request pra resolver).
 */
export const corsHeaders = baseCorsHeaders;

export function applyCors(res: VercelResponse, req?: VercelRequest) {
  for (const [k, v] of Object.entries(baseCorsHeaders)) {
    res.setHeader(k, v);
  }
  if (req) {
    const allowed = resolveOriginHeader(req);
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', allowed);
    }
    // Se origin não bate, não seta Allow-Origin — request cross-origin é bloqueada
    // pelo browser. Server-to-server (sem origin) continua passando.
  } else {
    // Sem req não dá pra validar Origin. Não abrimos wildcard aqui; callers HTTP
    // devem chamar applyCors(res, req) ou handlePreflight(req, res).
  }
}

/**
 * Handle OPTIONS preflight. Returns true if request was handled (caller should return).
 */
export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  applyCors(res, req);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function jsonError(
  res: VercelResponse,
  status: number,
  message: string,
  extra?: Record<string, unknown>,
  req?: VercelRequest,
) {
  applyCors(res, req);
  res.status(status).json({ error: message, ...(extra || {}) });
}
