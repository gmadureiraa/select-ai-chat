#!/usr/bin/env bun
/**
 * Backfill Late/Zernio profiles — todos os clientes
 *
 * Lista todos os `clients` que ainda NÃO têm `client_social_credentials` linha
 * `platform='late_profile'` (= ainda não foi criado profile no Late) e cria
 * 1-por-1, persistindo o profileId resultante.
 *
 * Pattern de storage idêntico ao handler `late-create-brand.ts`: row em
 * `client_social_credentials` com platform='late_profile' (canonical).
 *
 * Uso:
 *   bun run scripts/backfill-late-profiles.ts --dry-run
 *   bun run scripts/backfill-late-profiles.ts                # roda de verdade
 *   bun run scripts/backfill-late-profiles.ts --workspace=<id>  # restringe
 *   bun run scripts/backfill-late-profiles.ts --client=<id>     # 1 cliente só
 *
 * Pré-requisitos:
 *   - LATE_API_KEY em .env.local
 *   - DATABASE_URL em .env.local
 *
 * Idempotência:
 *   - SKIP automático em clientes que já têm late_profile row.
 *   - SKIP também se o profile já existe no Late com o mesmo nome (matching
 *     soft, mesma lógica do handler).
 *
 * Rate-limit:
 *   - 1 request a cada 1.5s (40/min, abaixo do cap conhecido do Late).
 */
import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const LATE_API_BASE = 'https://getlate.dev/api/v1';
const RATE_LIMIT_MS = 1_500;

// ===== Args =====
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const wsArg = args.find((a) => a.startsWith('--workspace='));
const clientArg = args.find((a) => a.startsWith('--client='));
const workspaceId = wsArg ? wsArg.split('=')[1] : null;
const onlyClientId = clientArg ? clientArg.split('=')[1] : null;

// ===== Env loader =====
function loadEnv(): Record<string, string> {
  let file = '';
  try {
    file = readFileSync('.env.local', 'utf-8');
  } catch {
    return {};
  }
  const env: Record<string, string> = {};
  for (const line of file.split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue;
    const [k, ...rest] = line.split('=');
    let v = rest.join('=').trim().replace(/^"/, '').replace(/"\s*$/, '');
    env[k.trim()] = v;
  }
  return env;
}

const env = loadEnv();
const LATE_API_KEY = env.LATE_API_KEY || process.env.LATE_API_KEY;
const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[fatal] DATABASE_URL não configurada');
  process.exit(1);
}
if (!LATE_API_KEY && !dryRun) {
  console.error('[fatal] LATE_API_KEY não configurada — set em .env.local (pegar do dashboard https://getlate.dev → Settings → API)');
  process.exit(1);
}

// ===== Late helpers =====
async function lateGet<T>(path: string): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const r = await fetch(`${LATE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${LATE_API_KEY}`, 'Content-Type': 'application/json' },
  });
  const text = await r.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch {}
  return { ok: r.ok, status: r.status, data, text };
}

async function latePost<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const r = await fetch(`${LATE_API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${LATE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch {}
  return { ok: r.ok, status: r.status, data, text };
}

interface ClientRow {
  id: string;
  name: string;
  workspace_id: string;
}

// ===== Main =====
async function main() {
  console.log('========================================');
  console.log('Backfill Late/Zernio profiles');
  console.log('========================================');
  console.log(`Mode:       ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  if (workspaceId) console.log(`Workspace:  ${workspaceId}`);
  if (onlyClientId) console.log(`Client:     ${onlyClientId}`);
  console.log('');

  const pool = new Pool({ connectionString: DATABASE_URL });
  const c = await pool.connect();

  try {
    // 1) Lista todos os profiles JÁ existentes no Late (cache pra evitar duplicar)
    let lateProfilesCache: Array<{ _id: string; name: string }> = [];
    if (!dryRun) {
      console.log('[1/3] Carregando profiles existentes no Late...');
      const listResp = await lateGet<{ profiles: Array<{ _id: string; name: string }> }>('/profiles');
      if (!listResp.ok) {
        console.error(`[fatal] Falha ao listar profiles Late (HTTP ${listResp.status}): ${listResp.text.substring(0, 200)}`);
        process.exit(1);
      }
      lateProfilesCache = listResp.data?.profiles || [];
      console.log(`       ${lateProfilesCache.length} profiles já existem no Late`);
    } else {
      console.log('[1/3] (dry-run) Pulando carregamento de profiles Late');
    }

    // 2) Lista clientes pendentes (sem row late_profile)
    console.log('[2/3] Listando clientes sem late_profile...');
    const filters: string[] = [];
    const params: any[] = [];
    if (workspaceId) {
      params.push(workspaceId);
      filters.push(`c.workspace_id = $${params.length}`);
    }
    if (onlyClientId) {
      params.push(onlyClientId);
      filters.push(`c.id = $${params.length}`);
    }
    const whereExtra = filters.length ? `AND ${filters.join(' AND ')}` : '';

    const pendingRes = await c.query<ClientRow>(
      `SELECT c.id, c.name, c.workspace_id
         FROM clients c
        WHERE NOT EXISTS (
                SELECT 1 FROM client_social_credentials csc
                 WHERE csc.client_id = c.id AND csc.platform = 'late_profile'
              )
          ${whereExtra}
        ORDER BY c.name ASC`,
      params,
    );
    const pending = pendingRes.rows;
    console.log(`       ${pending.length} clientes pendentes`);

    if (pending.length === 0) {
      console.log('\nNada pra fazer. Todos os clientes já têm late_profile.');
      return;
    }

    // 3) Loop
    console.log('[3/3] Processando...\n');
    let created = 0;
    let reused = 0;
    let failed = 0;
    const failures: Array<{ id: string; name: string; err: string }> = [];

    for (let i = 0; i < pending.length; i++) {
      const client = pending[i];
      const progress = `[${i + 1}/${pending.length}]`;
      const profileName = client.name;

      if (dryRun) {
        const existing = lateProfilesCache.find((p) => p.name === profileName);
        console.log(`${progress} DRY  "${client.name}" (${client.id.substring(0, 8)}) — ${existing ? `reuse profile ${existing._id}` : 'criaria novo profile'}`);
        continue;
      }

      try {
        // Verifica se já existe no Late por nome (idempotência soft)
        const matched = lateProfilesCache.find((p) => p.name === profileName);
        let profileId: string | undefined;

        if (matched) {
          profileId = matched._id;
          reused++;
          console.log(`${progress} REUSE "${client.name}" → ${profileId} (já existia no Late)`);
        } else {
          // POST /v1/profiles
          const r = await latePost<{ profile?: { _id: string }; _id?: string }>('/profiles', {
            name: profileName,
            timezone: 'America/Sao_Paulo',
          });
          if (!r.ok) {
            const err = (r.data as any)?.error || (r.data as any)?.message || `HTTP ${r.status}`;
            throw new Error(err);
          }
          profileId = (r.data as any)?.profile?._id || (r.data as any)?._id;
          if (!profileId) throw new Error('Late retornou OK mas sem profile._id');
          created++;
          console.log(`${progress} OK    "${client.name}" → ${profileId} (criado)`);
          lateProfilesCache.push({ _id: profileId, name: profileName });
        }

        // Persiste em client_social_credentials
        const now = new Date().toISOString();
        await c.query(
          `INSERT INTO client_social_credentials
             (client_id, platform, account_id, account_name, metadata, is_valid)
           VALUES ($1, 'late_profile', $2, $3, $4::jsonb, TRUE)
           ON CONFLICT (client_id, platform) DO UPDATE SET
             account_id = EXCLUDED.account_id,
             account_name = EXCLUDED.account_name,
             metadata = EXCLUDED.metadata,
             is_valid = TRUE,
             updated_at = NOW()`,
          [
            client.id,
            profileId,
            profileName,
            JSON.stringify({
              late_profile_id: profileId,
              late_profile_created_at: now,
              created_for_client: true,
              created_via: 'backfill-late-profiles',
            }),
          ],
        );
      } catch (err: any) {
        failed++;
        const msg = err?.message || String(err);
        failures.push({ id: client.id, name: client.name, err: msg });
        console.error(`${progress} FAIL  "${client.name}" — ${msg}`);
      }

      // Rate-limit
      if (i < pending.length - 1) await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }

    console.log('\n========================================');
    console.log('Resumo');
    console.log('========================================');
    console.log(`Total pendentes: ${pending.length}`);
    console.log(`  Created: ${created}`);
    console.log(`  Reused:  ${reused}`);
    console.log(`  Failed:  ${failed}`);
    if (failures.length > 0) {
      console.log('\nFalhas:');
      for (const f of failures) {
        console.log(`  - ${f.name} (${f.id.substring(0, 8)}): ${f.err}`);
      }
    }
    if (dryRun) {
      console.log('\n(dry-run — nenhuma chamada Late foi feita, nenhum DB foi alterado)');
    }
  } finally {
    c.release();
    await pool.end();
  }
}

await main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
