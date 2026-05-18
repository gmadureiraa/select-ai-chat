import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

// Parse .env.local
const envFile = readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  let val = m[2].trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  env[m[1]] = val;
}

const pool = new Pool({ connectionString: env.DATABASE_URL });
const c = await pool.connect();

try {
  const before = await c.query(`
    SELECT COUNT(*) AS total,
           COUNT(scheduled_at) AS com_scheduled,
           COUNT(due_date) AS com_due,
           COUNT(*) FILTER (WHERE status='scheduled') AS qt_scheduled
    FROM planning_items
    WHERE workspace_id = '11111111-1111-1111-1111-111111111111'
      AND client_id = '14bf8576-7104-48ca-962d-014308e45a4e'
      AND status != 'published'
      AND (scheduled_at >= NOW() OR due_date >= CURRENT_DATE)
  `);
  console.log('ANTES:', before.rows[0]);

  const upd = await c.query(`
    UPDATE planning_items
    SET scheduled_at = NULL,
        due_date = NULL,
        status = CASE WHEN status='scheduled' THEN 'approved' ELSE status END,
        updated_at = NOW()
    WHERE workspace_id = '11111111-1111-1111-1111-111111111111'
      AND client_id = '14bf8576-7104-48ca-962d-014308e45a4e'
      AND status != 'published'
      AND (scheduled_at >= NOW() OR due_date >= CURRENT_DATE)
    RETURNING id, status
  `);
  console.log('Atualizados:', upd.rows.length);
  const viraramApproved = upd.rows.filter((r: any) => r.status === 'approved').length;
  console.log('Status->approved:', viraramApproved);
} finally {
  c.release();
  await pool.end();
}
