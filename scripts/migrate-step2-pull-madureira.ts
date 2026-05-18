import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const WORKSPACE_NEON = '11111111-1111-1111-1111-111111111111';
const CLIENT_NEON = '14bf8576-7104-48ca-962d-014308e45a4e';
const OWNER_NEON = '5014248e-b1ac-4306-8490-2644dcd8aeb5';

const FILES = [
  '/Users/gabrielmadureira/.claude/projects/-Users-gabrielmadureira-GOS/e4830dc2-a20c-4b6b-bc37-3fdc50099fb0/tool-results/mcp-kaleidos-query_table-1779124903968.txt',
  '/Users/gabrielmadureira/.claude/projects/-Users-gabrielmadureira-GOS/e4830dc2-a20c-4b6b-bc37-3fdc50099fb0/tool-results/mcp-kaleidos-query_table-1779124905350.txt',
];

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

// Load + dedupe by id
const seen = new Map<string, any>();
for (const f of FILES) {
  const txt = readFileSync(f, 'utf-8');
  const parsed = JSON.parse(txt);
  for (const row of parsed.data) {
    if (!seen.has(row.id)) seen.set(row.id, row);
  }
}
const sourceItems = [...seen.values()];
console.log(`Source items (deduped): ${sourceItems.length}`);
console.log(`  With scheduled_at: ${sourceItems.filter(r => r.scheduled_at).length}`);
console.log(`  With due_date: ${sourceItems.filter(r => r.due_date).length}`);

const pool = new Pool({ connectionString: env.DATABASE_URL });
const c = await pool.connect();

try {
  // 1. Get destination column names
  const cols = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='planning_items'
  `);
  const neonCols = new Set(cols.rows.map((r: any) => r.column_name));
  console.log(`Neon planning_items columns: ${neonCols.size}`);

  // 2. Get kanban columns to resolve column_id by status (column_type)
  const kc = await c.query(`
    SELECT id, column_type FROM kanban_columns
    WHERE workspace_id = $1
  `, [WORKSPACE_NEON]);
  const colByType: Record<string, string> = {};
  for (const r of kc.rows) colByType[r.column_type] = r.id;
  console.log('Kanban column types:', Object.keys(colByType));

  const statusToColType: Record<string, string> = {
    idea: 'idea',
    draft: 'draft',
    review: 'review',
    approved: 'approved',
    scheduled: 'scheduled',
  };

  // Build list of cols we can copy from source to dest
  const copyableSource = [
    'title', 'description', 'content', 'platform', 'content_type',
    'due_date', 'scheduled_at', 'published_at', 'status', 'priority',
    'position', 'labels', 'assigned_to', 'media_urls',
    'external_post_id', 'error_message', 'retry_count',
    'added_to_library', 'content_library_id',
    'recurrence_type', 'recurrence_days', 'recurrence_time',
    'recurrence_end_date', 'recurrence_parent_id', 'is_recurrence_template',
    'next_retry_at',
  ];

  const willCopy = copyableSource.filter(c => neonCols.has(c));
  const skipped = copyableSource.filter(c => !neonCols.has(c));
  console.log('Copying cols:', willCopy.length, '→', willCopy.join(','));
  if (skipped.length) console.log('SKIPPED (not in Neon):', skipped.join(','));

  let inserted = 0;
  let alreadyExists = 0;
  let errors = 0;
  const lastFive: any[] = [];

  for (const row of sourceItems) {
    // Idempotency check
    const exists = await c.query(
      `SELECT id FROM planning_items
       WHERE workspace_id=$1 AND client_id=$2 AND metadata->>'original_supabase_id'=$3
       LIMIT 1`,
      [WORKSPACE_NEON, CLIENT_NEON, row.id]
    );
    if (exists.rows.length > 0) { alreadyExists++; continue; }

    const colType = statusToColType[row.status] || 'idea';
    const columnId = colByType[colType] || colByType['idea'] || null;
    if (!columnId) {
      console.error(`No column_id for status=${row.status}, skipping ${row.id}`);
      errors++;
      continue;
    }

    const newId = randomUUID();
    const newMeta = {
      ...(row.metadata || {}),
      source: 'kai-1.0-migration',
      original_supabase_id: row.id,
      migrated_at: new Date().toISOString(),
    };

    const cols: string[] = ['id', 'workspace_id', 'client_id', 'column_id', 'created_by', 'metadata'];
    const vals: any[] = [newId, WORKSPACE_NEON, CLIENT_NEON, columnId, OWNER_NEON, JSON.stringify(newMeta)];

    for (const col of willCopy) {
      const v = row[col];
      if (v === undefined) continue;
      cols.push(col);
      if (col === 'labels' || col === 'media_urls') {
        // jsonb columns — pass JSON string
        vals.push(JSON.stringify(v ?? []));
      } else if (col === 'recurrence_days') {
        // text[] — pass array directly (or null)
        vals.push(Array.isArray(v) && v.length > 0 ? v : null);
      } else {
        vals.push(v);
      }
    }

    const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
    const colList = cols.join(',');

    try {
      await c.query(
        `INSERT INTO planning_items (${colList}) VALUES (${placeholders})`,
        vals
      );
      inserted++;
      lastFive.push({ title: row.title?.slice(0, 60), scheduled_at: row.scheduled_at, status: row.status });
      if (lastFive.length > 5) lastFive.shift();
    } catch (e: any) {
      errors++;
      if (errors <= 3) console.error(`Insert error for ${row.id}: ${e.message}`);
    }
  }

  console.log('\n=== RESULTADO ===');
  console.log(`Total source: ${sourceItems.length}`);
  console.log(`Inseridos: ${inserted}`);
  console.log(`Já existiam (skip): ${alreadyExists}`);
  console.log(`Erros: ${errors}`);
  console.log('\nÚltimos 5 inseridos:');
  for (const x of lastFive) console.log(' -', x);
} finally {
  c.release();
  await pool.end();
}
