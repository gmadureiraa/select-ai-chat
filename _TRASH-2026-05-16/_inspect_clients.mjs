import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const existing = await sql`SELECT id, name, workspace_id, created_at FROM clients ORDER BY name`;
console.log('--- existing clients ---');
console.table(existing);

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name IN ('workspaces','workspace_members','users','user_profiles','clients')
  ORDER BY table_name
`;
console.log('--- relevant tables ---');
console.table(tables);

const owners = await sql`
  SELECT user_id, role
  FROM workspace_members
  WHERE workspace_id = '11111111-1111-1111-1111-111111111111'
  ORDER BY role
`;
console.log('--- workspace_members ---');
console.table(owners);

const ws = await sql`SELECT * FROM workspaces WHERE id = '11111111-1111-1111-1111-111111111111'`;
console.log('--- workspace ---');
console.table(ws);
