#!/usr/bin/env bun
import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const migrationFile = join(import.meta.dir, '..', 'migrations', '0045_planning_kanban_v2_approval_gate.sql');
const migrationSql = readFileSync(migrationFile, 'utf-8');
const sha = createHash('sha256').update(migrationSql).digest('hex');

console.log('Migration: 0045_planning_kanban_v2_approval_gate.sql');
console.log(`SHA-256: ${sha}`);
console.log('---');

const client = await pool.connect();
try {
  const before = await client.query(`
    SELECT workspace_id, name, position, column_type
      FROM kanban_columns
     WHERE is_default = true
     ORDER BY workspace_id, position
  `);
  console.log(`Before: ${before.rows.length} default columns across ${new Set(before.rows.map((c: any) => c.workspace_id)).size} workspaces`);

  const already = await client.query(
    `SELECT 1 FROM __migrations_applied WHERE id = '0045_planning_kanban_v2_approval_gate'`,
  );
  if (already.rows.length > 0) {
    console.error('Migration 0045 already applied. Aborting.');
    process.exit(1);
  }

  console.log('Applying migration...');
  await client.query('BEGIN');
  try {
    await client.query(migrationSql);
    await client.query(
      `INSERT INTO __migrations_applied (id, sha256, notes)
         VALUES ('0045_planning_kanban_v2_approval_gate', $1, 'kanban v2 com gate Aprovar')`,
      [sha],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  const after = await client.query(`
    SELECT workspace_id, name, position, column_type
      FROM kanban_columns
     WHERE is_default = true
     ORDER BY workspace_id, position
  `);
  const approvalCount = after.rows.filter((c: any) => c.column_type === 'pending_approval').length;
  console.log('---');
  console.log(`After: ${after.rows.length} default columns | ${approvalCount} novas colunas "Aprovar"`);

  const sampleWs = after.rows[0]?.workspace_id;
  if (sampleWs) {
    const sample = after.rows.filter((c: any) => c.workspace_id === sampleWs);
    console.log(`Sample workspace ${sampleWs}:`);
    for (const c of sample) console.log(`  ${c.position}. ${c.name} (${c.column_type})`);
  }
} finally {
  client.release();
  await pool.end();
}
