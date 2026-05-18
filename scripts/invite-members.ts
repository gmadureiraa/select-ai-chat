#!/usr/bin/env bun
/**
 * Cria convites pra 3 emails do time Kaleidos no workspace KAI 2.0.
 * Não dispara email — retorna os links de aceite pra Gabriel enviar manual.
 *
 * Decisão 2026-05-18: role = member (com canViewClients/canViewTools
 * liberadas via useWorkspace.ts). Member pode criar/editar clientes mas
 * NÃO pode convidar outros membros nem gerenciar automações.
 */
import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const [k, ...rest] = l.split('=');
      return [
        k.trim(),
        rest.join('=').trim().replace(/^"/, '').replace(/"\s*\\n?\s*$/, '').replace(/"$/, ''),
      ];
    }),
);

const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const INVITED_BY = '5014248e-b1ac-4306-8490-2644dcd8aeb5'; // Gabriel (owner)
const ROLE = 'member';
const EXPIRES_DAYS = 30;
const BASE_URL = 'https://kai-2-topaz.vercel.app';

const EMAILS = [
  'rebelo@kaleidosdigital.com',
  'copy@kaleidosdigital.com',
  'nathalia@kaleidosdigital.com',
];

const pool = new Pool({ connectionString: env.DATABASE_URL });
const c = await pool.connect();

console.log(`Convidando ${EMAILS.length} membros (role=${ROLE}, expira em ${EXPIRES_DAYS}d)...\n`);

try {
  for (const email of EMAILS) {
    const r = await c.query(
      `INSERT INTO workspace_invites (workspace_id, email, role, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + ($5 || ' days')::interval)
       ON CONFLICT (workspace_id, email)
       DO UPDATE SET role = EXCLUDED.role,
                     invited_by = EXCLUDED.invited_by,
                     expires_at = EXCLUDED.expires_at,
                     accepted_at = NULL
       RETURNING id, email, role, expires_at, created_at`,
      [WORKSPACE_ID, email.toLowerCase(), ROLE, INVITED_BY, String(EXPIRES_DAYS)],
    );
    const inv = r.rows[0];
    const link = `${BASE_URL}/signup?invite=${inv.id}`;
    console.log(`✓ ${inv.email}`);
    console.log(`  Role: ${inv.role}`);
    console.log(`  Expira: ${new Date(inv.expires_at).toLocaleDateString('pt-BR')}`);
    console.log(`  Link aceite: ${link}\n`);
  }

  // Lista invites pendentes pra confirmar
  console.log('---');
  console.log('Pendentes no workspace:');
  const all = await c.query(
    `SELECT email, role, expires_at, accepted_at IS NOT NULL as aceito
       FROM workspace_invites
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT 10`,
    [WORKSPACE_ID],
  );
  console.table(all.rows);
} finally {
  c.release();
  await pool.end();
}
