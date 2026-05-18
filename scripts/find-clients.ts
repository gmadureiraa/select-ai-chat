#!/usr/bin/env bun
import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const [k, ...rest] = l.split('=');
      return [k.trim(), rest.join('=').trim().replace(/^"/, '').replace(/"\s*\\n?\s*$/, '').replace(/"$/, '')];
    }),
);

const pool = new Pool({ connectionString: env.DATABASE_URL });
const c = await pool.connect();
try {
  const r = await c.query(`
    SELECT id, name, workspace_id
      FROM clients
     WHERE LOWER(name) LIKE '%kaleidos%'
        OR LOWER(name) LIKE '%defiverso%'
        OR LOWER(name) LIKE '%dsec%'
        OR LOWER(name) LIKE '%d-sec%'
        OR LOWER(name) LIKE '%alfred%'
     ORDER BY name
  `);
  console.log(JSON.stringify(r.rows, null, 2));
  console.log('---');
  const cols = await c.query(`
    SELECT workspace_id, id, name, column_type, position
      FROM kanban_columns
     ORDER BY workspace_id, position
  `);
  console.log('Kanban columns by workspace:');
  for (const col of cols.rows) {
    console.log(`  ws=${col.workspace_id}  pos=${col.position}  ${col.name} (${col.column_type})`);
  }
} finally {
  c.release();
  await pool.end();
}
