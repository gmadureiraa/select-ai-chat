/**
 * Helpers de autorização compartilhados pra TOOLS (KAI chat + MCP).
 *
 * Padrão: cada tool que recebe `client_id` ou `workspace_id` via args
 * (controlado pelo LLM ou pelo MCP caller) DEVE validar que o `ctx.userId`
 * efetivo tem acesso. Sem isso, prompt injection + ID guess vazam dados
 * cross-tenant.
 *
 * Service mode (MCP `KAI_MCP_TOKEN` sem `x-mcp-user-id`):
 *   - `ctx.userId` é '' e `ctx.isInternalCall === true`.
 *   - As helpers retornam `{ skipped: true }` — ASSUMINDO que quem tem o
 *     KAI_MCP_TOKEN é o Gabriel local com poder total (super_admin equiv).
 *   - Service mode COM `x-mcp-user-id` setado vira o user assumido e
 *     `ctx.userId` carrega o UUID. Nesse caso valida normal.
 *
 * Uso:
 *
 *   import { assertToolClientAccess, isToolAccessFail } from './tool-access.js';
 *   handler: async (args, ctx) => {
 *     const clientId = String(args.client_id ?? ctx.clientId ?? '').trim();
 *     const guard = await assertToolClientAccess(ctx, clientId);
 *     if (isToolAccessFail(guard)) return { ok: false, error: guard.error };
 *     // ... segue com o que a tool faz
 *   }
 *
 * NOTA: usamos `isToolAccessFail()` em vez de `if (!guard.ok)` porque o
 * type-checker do @vercel/node 5.x não estreita a union pela negação direta
 * do discriminator (bug observado em 2026-05-18). Type guard explícito força
 * o narrowing.
 */
import { queryOne } from '../db.js';
import type { ToolExecutionContext, ToolHandlerResult } from './types.js';

export type ToolAccessOk = {
  ok: true;
  workspaceId: string | null;
  /** True quando rodou em service mode sem userId — bypass por design. */
  skipped: boolean;
};

export type ToolAccessFail = {
  ok: false;
  error: string;
  /** HTTP status sugerido. */
  status: 401 | 403 | 400 | 404;
};

export type ToolAccessResult = ToolAccessOk | ToolAccessFail;

/**
 * Type guard pra estreitar `ToolAccessResult` em `ToolAccessFail`. Útil
 * quando o flow-analysis do TS não consegue narrow via `!guard.ok` direto
 * (cenário observado no build do Vercel/@vercel/node 5.x). Use:
 *
 *   const guard = await assertToolClientAccess(ctx, clientId);
 *   if (isToolAccessFail(guard)) return { ok: false, error: guard.error };
 */
export function isToolAccessFail(result: ToolAccessResult): result is ToolAccessFail {
  return result.ok === false;
}

function serviceModeNoUser(ctx: ToolExecutionContext): boolean {
  return !!ctx.isInternalCall && !ctx.userId;
}

/**
 * Valida acesso a um cliente.
 *
 * Em service mode sem userId, bypass (Gabriel local com KAI_MCP_TOKEN).
 * Em qualquer outro caso, exige que `ctx.userId` seja membro do workspace
 * dono do cliente OU super_admin.
 */
export async function assertToolClientAccess(
  ctx: ToolExecutionContext,
  clientId: string,
): Promise<ToolAccessResult> {
  if (!clientId) {
    return { ok: false, error: 'client_id obrigatório', status: 400 };
  }
  if (serviceModeNoUser(ctx)) {
    return { ok: true, workspaceId: null, skipped: true };
  }
  if (!ctx.userId) {
    return { ok: false, error: 'userId não disponível no contexto', status: 401 };
  }
  const row = await queryOne<{ workspace_id: string }>(
    `SELECT c.workspace_id
       FROM clients c
       JOIN workspace_members wm
         ON wm.workspace_id = c.workspace_id
        AND wm.user_id = $2
      WHERE c.id = $1
      UNION ALL
      SELECT c.workspace_id
        FROM clients c
       WHERE c.id = $1
         AND EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
      LIMIT 1`,
    [clientId, ctx.userId],
  );
  if (!row) {
    return { ok: false, error: 'Acesso negado ao cliente', status: 403 };
  }
  return { ok: true, workspaceId: row.workspace_id, skipped: false };
}

/**
 * Valida acesso a um workspace. Aceita filtro opcional de roles.
 */
export async function assertToolWorkspaceAccess(
  ctx: ToolExecutionContext,
  workspaceId: string,
  roles?: Array<'owner' | 'admin' | 'member' | 'viewer'>,
): Promise<ToolAccessResult> {
  if (!workspaceId) {
    return { ok: false, error: 'workspace_id obrigatório', status: 400 };
  }
  if (serviceModeNoUser(ctx)) {
    return { ok: true, workspaceId, skipped: true };
  }
  if (!ctx.userId) {
    return { ok: false, error: 'userId não disponível no contexto', status: 401 };
  }
  const row = await queryOne<{ role: string }>(
    `SELECT role::text AS role FROM workspace_members
      WHERE workspace_id = $1 AND user_id = $2
      UNION ALL
      SELECT 'super_admin' AS role FROM super_admins WHERE user_id = $2
      LIMIT 1`,
    [workspaceId, ctx.userId],
  );
  if (!row) {
    return { ok: false, error: 'Acesso negado ao workspace', status: 403 };
  }
  if (
    roles &&
    roles.length > 0 &&
    row.role !== 'super_admin' &&
    !roles.includes(row.role as any)
  ) {
    return {
      ok: false,
      error: `Permissão insuficiente (requer ${roles.join('/')}; tem ${row.role})`,
      status: 403,
    };
  }
  return { ok: true, workspaceId, skipped: false };
}

/**
 * Resolve workspace_id a partir do clientId (com check de acesso). Útil pras
 * tools que aceitam ambos opcionalmente e querem cair pro workspace via
 * cliente atual.
 */
export async function resolveToolWorkspaceFromClient(
  ctx: ToolExecutionContext,
  clientId: string,
): Promise<ToolAccessResult> {
  return assertToolClientAccess(ctx, clientId);
}

/**
 * Atalho: transforma um `ToolAccessFail` em `ToolHandlerResult` ergonômico.
 */
export function accessFailToResult(fail: ToolAccessFail): ToolHandlerResult<never> {
  return { ok: false, error: fail.error };
}
