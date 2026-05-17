/**
 * MCP auth helper.
 *
 * Aceita dois modos de autenticação:
 *   1. `Authorization: Bearer ${KAI_MCP_TOKEN}` — token global do MCP server.
 *      Grants "service-level" access (super_admin equivalente), pensado pra
 *      Claude Code / Cursor / outro client mexendo no workspace inteiro do
 *      Gabriel via mac local.
 *   2. JWT de user normal (mesma verificação do `verifyAuth` em `_lib/auth.ts`).
 *      Permissões respeitam `workspace_members` e checks de `assertClientAccess`.
 *
 * O `MCP_ACCESS_TOKEN` legado (usado pelo `mcp-reader.ts` antigo só pra
 * read-only discovery) continua aceito como alias do `KAI_MCP_TOKEN`.
 */
import type { VercelRequest } from '@vercel/node';
import { tryAuth, verifyAuth, type AuthUser } from '../auth.js';

export interface McpAuthResult {
  /** "service" = token MCP global, "user" = JWT user normal */
  mode: 'service' | 'user';
  /** User UUID. Pra service mode, vem do header `x-mcp-user-id` ou null. */
  userId: string | null;
  /** Quando true, bypassa checks de workspace_members (super_admin equiv). */
  isService: boolean;
  /** Quando mode === 'user', objeto AuthUser completo. */
  user?: AuthUser;
}

function getServiceToken(): string | null {
  return (
    process.env.KAI_MCP_TOKEN ||
    process.env.MCP_ACCESS_TOKEN ||
    null
  );
}

function readBearer(req: VercelRequest): string | null {
  const auth = req.headers.authorization || (req.headers as any).Authorization;
  const headerVal = Array.isArray(auth) ? auth[0] : auth;
  if (!headerVal) return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerVal.trim());
  return match ? match[1] : null;
}

function readHeader(req: VercelRequest, name: string): string | null {
  const raw = req.headers[name.toLowerCase()];
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Tenta autenticar como MCP service token OU JWT user. Throws com `.status = 401`
 * se nenhum dos modos funcionar.
 *
 * Se um service token estiver configurado e o Bearer bater, modo "service" é
 * retornado mesmo que um JWT user também fosse válido. Header opcional
 * `x-mcp-user-id: <uuid>` indica qual user assumir pra calls que precisam de
 * userId (planning_items inserts etc).
 */
export async function assertMcpAuth(req: VercelRequest): Promise<McpAuthResult> {
  const bearer = readBearer(req);
  const serviceToken = getServiceToken();

  if (bearer && serviceToken && bearer === serviceToken) {
    const assumedUser = readHeader(req, 'x-mcp-user-id');
    return {
      mode: 'service',
      userId: assumedUser ?? null,
      isService: true,
    };
  }

  // Fallback: JWT user
  try {
    const user = await verifyAuth(req);
    return {
      mode: 'user',
      userId: user.id,
      isService: false,
      user,
    };
  } catch (err) {
    const error = new Error('Unauthorized — provide KAI_MCP_TOKEN bearer or a valid user JWT');
    (error as any).status = 401;
    throw error;
  }
}

/**
 * Variant que não throw — retorna null quando nada autentica.
 * Útil pra endpoints que opcionalmente expõem dados públicos.
 */
export async function tryMcpAuth(req: VercelRequest): Promise<McpAuthResult | null> {
  try {
    return await assertMcpAuth(req);
  } catch {
    return null;
  }
}

/**
 * Determina o `userId` efetivo pra operações que precisam de um.
 * - service mode: usa header `x-mcp-user-id` se setado, senão fallback `defaultUserId`,
 *   senão throws.
 * - user mode: sempre usa `auth.userId`.
 */
export function resolveUserId(auth: McpAuthResult, defaultUserId?: string): string {
  if (auth.userId) return auth.userId;
  if (defaultUserId) return defaultUserId;
  const err = new Error(
    'MCP service mode precisa de header `x-mcp-user-id: <uuid>` pra esta operação',
  );
  (err as any).status = 400;
  throw err;
}

/** Re-export pra conveniência. */
export { tryAuth };
