// GET /api/client-context?client_id=<uuid>
//
// Returns the full multi-tenant `ClientContext` payload (clients,
// preferences, websites, docs, visual refs, content library, reference
// library, viral keywords/competitors) for the given client_id.
//
// Auth:
//   - Bearer JWT required.
//   - Caller must be a workspace_member of the client's workspace OR
//     a super_admin.
//
// Used by:
//   - Frontend `useClientContext` for hydrate-on-server scenarios
//   - Anywhere a single-shot HTTP fetch is preferred over 8 parallel
//     supabase.from() round-trips (e.g. SSR, server actions).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { queryOne } from '../_lib/db.js';
import { getClientContextServer } from '../_lib/shared/client-context.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);

  if (req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  const user = await tryAuth(req);
  if (!user) {
    return jsonError(res, 401, 'Authentication required');
  }

  const clientIdRaw = req.query.client_id;
  const clientId = Array.isArray(clientIdRaw) ? clientIdRaw[0] : clientIdRaw;
  if (!clientId || typeof clientId !== 'string') {
    return jsonError(res, 400, 'client_id é obrigatório');
  }

  // Authorize: super_admin OR workspace_member of the client's workspace
  const access = await queryOne<{ ok: boolean }>(
    `SELECT TRUE AS ok
       FROM clients c
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = c.workspace_id AND wm.user_id = $2
      WHERE c.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM super_admins sa WHERE sa.user_id = $2
          )
        )
      LIMIT 1`,
    [clientId, user.id]
  ).catch(() => null);

  if (!access) {
    return jsonError(res, 403, 'Acesso negado a esse cliente');
  }

  try {
    const ctx = await getClientContextServer(clientId);
    if (!ctx) {
      return jsonError(res, 404, 'Cliente não encontrado');
    }
    return res.status(200).json({ ok: true, context: ctx });
  } catch (err: any) {
    console.error('[client-context] error:', err);
    return jsonError(res, 500, err?.message || 'Erro interno');
  }
}
