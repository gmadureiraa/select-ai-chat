// Centralized authorization helpers for client/workspace ownership checks.
//
// Padrão antes deste arquivo: cada handler aceitava `clientId` no body sem
// verificar se o `user.id` autenticado tem acesso ao cliente. Qualquer user
// autenticado podia passar qualquer UUID e ler/escrever dados de outro cliente.
//
// Uso:
//   import { assertClientAccess } from '../_lib/access.js';
//   await assertClientAccess(user.id, clientId); // throws 403 se não tiver acesso
//
// Implementação: lookup `clients.workspace_id` → `workspace_members.user_id`.

import { queryOne } from './db.js';

/**
 * Lança erro 403 (forbidden) se o user não for membro do workspace
 * que owns o cliente. Retorna `{ workspaceId }` se passou.
 *
 * Performance: 1 query (JOIN clients × workspace_members). Usa o índice
 * existente em workspace_members(user_id, workspace_id).
 */
export async function assertClientAccess(
  userId: string,
  clientId: string,
): Promise<{ workspaceId: string }> {
  if (!userId) throw withStatus(new Error('Authentication required'), 401);
  if (!clientId) throw withStatus(new Error('clientId obrigatório'), 400);

  const row = await queryOne<{ workspace_id: string }>(
    `SELECT c.workspace_id
       FROM clients c
       JOIN workspace_members wm
         ON wm.workspace_id = c.workspace_id
      WHERE c.id = $1
        AND wm.user_id = $2
      LIMIT 1`,
    [clientId, userId],
  );

  if (!row) {
    throw withStatus(new Error('Acesso negado ao cliente'), 403);
  }
  return { workspaceId: row.workspace_id };
}

/**
 * Lança 403 se o user não for membro do workspace.
 */
export async function assertWorkspaceAccess(
  userId: string,
  workspaceId: string,
  roles?: Array<'owner' | 'admin' | 'member'>,
): Promise<void> {
  if (!userId) throw withStatus(new Error('Authentication required'), 401);
  if (!workspaceId) throw withStatus(new Error('workspaceId obrigatório'), 400);

  const row = await queryOne<{ role: string }>(
    `SELECT role FROM workspace_members
      WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
    [workspaceId, userId],
  );

  if (!row) {
    throw withStatus(new Error('Acesso negado ao workspace'), 403);
  }
  if (roles && roles.length > 0 && !roles.includes(row.role as any)) {
    throw withStatus(
      new Error(`Permissão insuficiente (requer: ${roles.join('/')})`),
      403,
    );
  }
}

function withStatus(err: Error, status: number): Error {
  (err as any).status = status;
  (err as any).statusCode = status;
  return err;
}
