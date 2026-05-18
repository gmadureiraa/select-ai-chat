import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
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
const r = await c.query(`
  SELECT column_name, data_type, udt_name
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='planning_items'
  AND column_name IN ('labels','media_urls','recurrence_days','metadata')
`);
console.log(r.rows);
c.release();
await pool.end();
