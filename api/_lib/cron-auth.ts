// Centralized cron authentication.
//
// PROBLEMA HISTÓRICO: ~30 handlers cron/process-* aceitavam o header
// `x-vercel-cron: 1` como prova de "request veio do scheduler do Vercel".
// Esse header NÃO é stripped por Vercel em requests externos — qualquer um
// pode `curl -H "x-vercel-cron: 1" https://app.kaleidos.com.br/api/cron-...`
// e disparar scrapes (que custam $$ em Apify), regen de briefs, envio de
// pushes etc.
//
// Doc oficial Vercel (2024+): use APENAS `Authorization: Bearer $CRON_SECRET`.
// O scheduler do Vercel já anexa esse header automaticamente nos crons declarados
// em vercel.json — não precisa de header customizado.
//
// USO:
//   import { assertCronAuth } from '../_lib/cron-auth.js';
//   if (!assertCronAuth(req, res)) return;
//
// Retorna true se passou (handler segue). Retorna false e já respondeu 401
// se falhou. Sempre verifique o boolean.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jsonError } from './cors.js';

/**
 * Verifica auth de cron via Bearer token contra CRON_SECRET.
 *
 * Aceita:
 *   - `Authorization: Bearer ${CRON_SECRET}` (recomendado, scheduler Vercel envia)
 *   - `x-internal-cron-secret: ${CRON_SECRET}` (dev/teste internal-only)
 *
 * NÃO aceita mais `x-vercel-cron` ou `x-internal-cron` standalone (eram forjáveis).
 *
 * Retorna `true` se autorizado. Se não, responde 401 e retorna `false`.
 */
export function assertCronAuth(req: VercelRequest, res: VercelResponse): boolean {
  const cronSecret = process.env.CRON_SECRET?.replace(/\\n/g, '').trim();
  if (!cronSecret) {
    // Misconfig — fail closed.
    if (!res.writableEnded) {
      jsonError(res, 503, 'CRON_SECRET not configured');
    }
    return false;
  }

  if (matchesCronSecret(req, cronSecret)) return true;

  if (!res.writableEnded) {
    jsonError(res, 401, 'Unauthorized');
  }
  return false;
}

/**
 * Check if a request is a valid cron call (Bearer CRON_SECRET).
 * Não responde — apenas retorna boolean. Útil pra handlers que aceitam
 * cron OU user autenticado.
 *
 * Aceita Authorization: Bearer $CRON_SECRET ou x-internal-cron-secret header.
 * NÃO aceita os headers `x-vercel-cron` ou `x-internal-cron` standalone.
 */
export function isValidCronCall(req: VercelRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.replace(/\\n/g, '').trim();
  if (!cronSecret) return false;
  return matchesCronSecret(req, cronSecret);
}

/**
 * Header pra usar em fan-out interno (cron mestre chamando sub-crons).
 * Retorna `{Authorization: 'Bearer ...'}` se CRON_SECRET tá setado, senão {}.
 */
export function cronAuthHeaders(): Record<string, string> {
  const cronSecret = process.env.CRON_SECRET?.replace(/\\n/g, '').trim();
  if (!cronSecret) return {};
  return { Authorization: `Bearer ${cronSecret}` };
}

function matchesCronSecret(req: VercelRequest, cronSecret: string): boolean {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const auth = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (auth === `Bearer ${cronSecret}`) return true;

  const internal = req.headers['x-internal-cron-secret'];
  const internalVal = Array.isArray(internal) ? internal[0] : internal;
  if (internalVal === cronSecret) return true;

  return false;
}
