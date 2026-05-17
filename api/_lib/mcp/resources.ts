/**
 * MCP resources — leitura read-only de objetos do KAI como recursos MCP
 * indexáveis. URI scheme: `kai://<tipo>/<id>`.
 *
 * Tipos atuais:
 *   - `kai://client/<uuid>`         → 1 cliente full
 *   - `kai://planning/<uuid>`       → 1 planning item
 *   - `kai://library/<uuid>`        → 1 library_content_item
 *
 * `listResources()` lista até `limit` registros por tipo respeitando o
 * workspace do user (service mode = global).
 */
import { query, queryOne } from '../db.js';
import type { McpAuthResult } from './auth.js';

export interface McpResourceDescriptor {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: string;
}

const DEFAULT_LIMIT_PER_TYPE = 25;
const MAX_LIMIT_PER_TYPE = 200;

function clampLimit(n: number | undefined): number {
  if (!n || !Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT_PER_TYPE;
  return Math.min(Math.floor(n), MAX_LIMIT_PER_TYPE);
}

async function workspaceFilterParts(
  auth: McpAuthResult,
  alias: string,
): Promise<{ clause: string; params: any[] }> {
  if (auth.isService) {
    return { clause: '', params: [] };
  }
  if (!auth.userId) {
    return { clause: ` WHERE FALSE`, params: [] };
  }
  return {
    clause: ` WHERE ${alias}.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = $1)`,
    params: [auth.userId],
  };
}

export async function listResources(
  auth: McpAuthResult,
  limitPerType?: number,
): Promise<McpResourceDescriptor[]> {
  const limit = clampLimit(limitPerType);
  const out: McpResourceDescriptor[] = [];

  // Clients
  {
    const wf = await workspaceFilterParts(auth, 'c');
    const sql = `SELECT c.id, c.name FROM clients c${wf.clause} ORDER BY c.updated_at DESC NULLS LAST LIMIT $${wf.params.length + 1}`;
    try {
      const rows = await query<{ id: string; name: string | null }>(sql, [
        ...wf.params,
        limit,
      ]);
      for (const r of rows) {
        out.push({
          uri: `kai://client/${r.id}`,
          name: r.name || `Client ${r.id.slice(0, 8)}`,
          description: 'KAI client profile',
          mimeType: 'application/json',
        });
      }
    } catch (err) {
      console.error('[mcp/resources] clients list error:', err);
    }
  }

  // Planning items
  {
    const wf = await workspaceFilterParts(auth, 'p');
    const sql = `SELECT p.id, p.title FROM planning_items p${wf.clause} ORDER BY p.updated_at DESC NULLS LAST LIMIT $${wf.params.length + 1}`;
    try {
      const rows = await query<{ id: string; title: string | null }>(sql, [
        ...wf.params,
        limit,
      ]);
      for (const r of rows) {
        out.push({
          uri: `kai://planning/${r.id}`,
          name: r.title || `Planning ${r.id.slice(0, 8)}`,
          description: 'KAI planning item (content card)',
          mimeType: 'application/json',
        });
      }
    } catch (err) {
      console.error('[mcp/resources] planning list error:', err);
    }
  }

  // Library content items
  {
    // client_content_library has a client_id; we filter via workspace through clients join
    const baseWhere = auth.isService
      ? ''
      : ` WHERE c.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = $1)`;
    const params = auth.isService ? [] : auth.userId ? [auth.userId] : ['__none__'];
    const sql = `SELECT l.id, l.title FROM client_content_library l
                 JOIN clients c ON c.id = l.client_id
                 ${baseWhere}
                 ORDER BY l.updated_at DESC NULLS LAST
                 LIMIT $${params.length + 1}`;
    try {
      const rows = await query<{ id: string; title: string | null }>(sql, [
        ...params,
        limit,
      ]);
      for (const r of rows) {
        out.push({
          uri: `kai://library/${r.id}`,
          name: r.title || `Library ${r.id.slice(0, 8)}`,
          description: 'KAI client content library item',
          mimeType: 'application/json',
        });
      }
    } catch (err) {
      console.error('[mcp/resources] library list error:', err);
    }
  }

  return out;
}

const URI_REGEX = /^kai:\/\/(client|planning|library)\/([0-9a-f-]{8,})$/i;

export async function readResource(
  auth: McpAuthResult,
  uri: string,
): Promise<McpResourceContent> {
  const m = URI_REGEX.exec(uri.trim());
  if (!m) {
    const err = new Error(`URI inválida: ${uri}. Esperado kai://<tipo>/<id>.`);
    (err as any).status = 400;
    throw err;
  }
  const [, type, id] = m;

  switch (type) {
    case 'client':
      return readClientResource(auth, id);
    case 'planning':
      return readPlanningResource(auth, id);
    case 'library':
      return readLibraryResource(auth, id);
    default: {
      const err = new Error(`Tipo de recurso desconhecido: ${type}`);
      (err as any).status = 400;
      throw err;
    }
  }
}

async function assertWorkspaceForRow(
  auth: McpAuthResult,
  workspaceId: string | null,
): Promise<void> {
  if (auth.isService) return;
  if (!auth.userId || !workspaceId) {
    const err = new Error('Acesso negado ao recurso');
    (err as any).status = 403;
    throw err;
  }
  const row = await queryOne<{ workspace_id: string }>(
    `SELECT workspace_id FROM workspace_members WHERE user_id = $1 AND workspace_id = $2 LIMIT 1`,
    [auth.userId, workspaceId],
  );
  if (!row) {
    const err = new Error('Acesso negado ao recurso');
    (err as any).status = 403;
    throw err;
  }
}

async function readClientResource(
  auth: McpAuthResult,
  id: string,
): Promise<McpResourceContent> {
  const row = await queryOne<any>(
    `SELECT * FROM clients WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (!row) {
    const err = new Error('Cliente não encontrado');
    (err as any).status = 404;
    throw err;
  }
  await assertWorkspaceForRow(auth, row.workspace_id);
  return {
    uri: `kai://client/${id}`,
    mimeType: 'application/json',
    text: JSON.stringify(row, null, 2),
  };
}

async function readPlanningResource(
  auth: McpAuthResult,
  id: string,
): Promise<McpResourceContent> {
  const row = await queryOne<any>(
    `SELECT * FROM planning_items WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (!row) {
    const err = new Error('Planning item não encontrado');
    (err as any).status = 404;
    throw err;
  }
  await assertWorkspaceForRow(auth, row.workspace_id);
  return {
    uri: `kai://planning/${id}`,
    mimeType: 'application/json',
    text: JSON.stringify(row, null, 2),
  };
}

async function readLibraryResource(
  auth: McpAuthResult,
  id: string,
): Promise<McpResourceContent> {
  const row = await queryOne<any>(
    `SELECT l.*, c.workspace_id AS _workspace_id
       FROM client_content_library l
       JOIN clients c ON c.id = l.client_id
      WHERE l.id = $1
      LIMIT 1`,
    [id],
  );
  if (!row) {
    const err = new Error('Library item não encontrado');
    (err as any).status = 404;
    throw err;
  }
  await assertWorkspaceForRow(auth, row._workspace_id);
  // Remove o helper field antes de serializar
  const { _workspace_id, ...clean } = row;
  return {
    uri: `kai://library/${id}`,
    mimeType: 'application/json',
    text: JSON.stringify(clean, null, 2),
  };
}
