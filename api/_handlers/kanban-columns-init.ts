// Inicializa colunas default do kanban (Planning v2 — 7 colunas com gate
// "Aprovar"): idea/pending_approval/draft/review/approved/scheduled/published.
// Idempotente: só insere se 0 rows existem pro workspace_id.
//
// Substitui supabase.rpc('initialize_kanban_columns', ...) que dependia da
// function PL/pgSQL existir no Neon (Backend Infra audit identificou que nem
// todas as funções foram migradas).
//
// IMPORTANTE: mantém paridade com migration 0045_planning_kanban_v2_approval_gate
// e com a função PL/pgSQL initialize_kanban_columns. Qualquer mudança aqui
// precisa ser refletida nos 3 lugares.
//
// Auth: user precisa ser membro do workspace.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertWorkspaceAccess } from '../_lib/access.js';

const BodySchema = z.object({
  workspace_id: z.string().uuid(),
});

const DEFAULT_COLUMNS: Array<{
  name: string;
  position: number;
  color: string;
  column_type: string;
}> = [
  { name: 'Ideias',    position: 0, color: 'purple', column_type: 'idea' },
  { name: 'Aprovar',   position: 1, color: 'amber',  column_type: 'pending_approval' },
  { name: 'Iniciar',   position: 2, color: 'blue',   column_type: 'draft' },
  { name: 'Revisar',   position: 3, color: 'yellow', column_type: 'review' },
  { name: 'Pronto',    position: 4, color: 'green',  column_type: 'approved' },
  { name: 'Agendado',  position: 5, color: 'orange', column_type: 'scheduled' },
  { name: 'Publicado', position: 6, color: 'gray',   column_type: 'published' },
];

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const { workspace_id } = parsed.data;
  await assertWorkspaceAccess(user.id, workspace_id);

  const pool = getPool();
  // Check se já tem colunas
  const existing = await pool.query(
    `SELECT id FROM kanban_columns WHERE workspace_id = $1 LIMIT 1`,
    [workspace_id],
  );
  if (existing.rows.length > 0) {
    return { ok: true, initialized: false, message: 'Workspace já tem colunas' };
  }

  // Insert default columns numa só query
  const values: string[] = [];
  const params: unknown[] = [];
  for (const col of DEFAULT_COLUMNS) {
    params.push(workspace_id, col.name, col.position, col.color, true, col.column_type);
    const n = params.length;
    values.push(
      `($${n - 5}, $${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n})`,
    );
  }

  await pool.query(
    `INSERT INTO kanban_columns
       (workspace_id, name, position, color, is_default, column_type)
     VALUES ${values.join(', ')}`,
    params,
  );

  return { ok: true, initialized: true, count: DEFAULT_COLUMNS.length };
});
