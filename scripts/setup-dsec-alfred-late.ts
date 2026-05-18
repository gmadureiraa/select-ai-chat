#!/usr/bin/env bun
/**
 * Setup DSEC Labs + Alfred — Late/Zernio profiles + pré-popular OAuth slots
 *
 * 1) DSEC Labs (cliente já existe em KAI): cria profile Late "DSEC Labs"
 *    e pré-popula client_social_credentials rows pra X (twitter) + LinkedIn
 *    (is_valid=false, pending_oauth=true).
 *
 * 2) Alfred (cliente NOVO): cria registro em `clients`, cria profile Late
 *    "Alfred" e pré-popula slot pra X (twitter).
 *
 * Idempotente: re-rodar não duplica nada. Reusa profiles Late existentes
 * com mesmo nome.
 *
 * Uso:
 *   bun run scripts/setup-dsec-alfred-late.ts --dry-run
 *   bun run scripts/setup-dsec-alfred-late.ts
 */
import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const LATE_API_BASE = 'https://getlate.dev/api/v1';
const KALEIDOS_WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const KALEIDOS_USER_ID = '5014248e-b1ac-4306-8490-2644dcd8aeb5';
const DSEC_CLIENT_ID = '4e8be599-0d50-4759-b8a8-fb0b399e1551';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function loadEnv(): Record<string, string> {
  const file = readFileSync('.env.local', 'utf-8');
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
  console.error('[fatal] LATE_API_KEY não configurada');
  process.exit(1);
}

async function lateGet<T>(path: string) {
  const r = await fetch(`${LATE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${LATE_API_KEY}`, 'Content-Type': 'application/json' },
  });
  const text = await r.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch {}
  return { ok: r.ok, status: r.status, data: data as T, text };
}

async function latePost<T>(path: string, body: unknown) {
  const r = await fetch(`${LATE_API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${LATE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch {}
  return { ok: r.ok, status: r.status, data: data as T, text };
}

interface LateProfile { _id: string; name: string }

async function ensureLateProfile(
  cache: LateProfile[],
  name: string,
): Promise<{ id: string; reused: boolean }> {
  // Match exato; se não rolar, match por nome contém (alguns profiles tem sufixo [hash])
  const matched =
    cache.find((p) => p.name === name) ||
    cache.find((p) => p.name.toLowerCase().startsWith(name.toLowerCase() + ' [')) ||
    cache.find((p) => p.name.toLowerCase() === name.toLowerCase());

  if (matched) {
    return { id: matched._id, reused: true };
  }

  if (dryRun) {
    return { id: `<would-create-${name}>`, reused: false };
  }

  const r = await latePost<{ profile?: { _id: string }; _id?: string }>('/profiles', {
    name,
    timezone: 'America/Sao_Paulo',
  });
  if (!r.ok) {
    const err = (r.data as any)?.error || (r.data as any)?.message || `HTTP ${r.status}`;
    throw new Error(`Late create profile "${name}": ${err}`);
  }
  const profileId = (r.data as any)?.profile?._id || (r.data as any)?._id;
  if (!profileId) throw new Error(`Late retornou OK mas sem profile._id para "${name}"`);
  cache.push({ _id: profileId, name });
  return { id: profileId, reused: false };
}

async function upsertLateProfileCred(
  c: any,
  clientId: string,
  profileId: string,
  profileName: string,
) {
  if (dryRun) return;
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
      clientId,
      profileId,
      profileName,
      JSON.stringify({
        late_profile_id: profileId,
        late_profile_created_at: new Date().toISOString(),
        created_for_client: true,
        created_via: 'setup-dsec-alfred-late',
      }),
    ],
  );
}

async function upsertPendingOAuthSlot(
  c: any,
  clientId: string,
  platform: string,
  expectedHandle: string,
) {
  if (dryRun) return;
  // Não sobrescreve se já existir credencial VÁLIDA (OAuth já feito)
  const existing = await c.query(
    `SELECT id, is_valid FROM client_social_credentials WHERE client_id = $1 AND platform = $2`,
    [clientId, platform],
  );
  if (existing.rows.length > 0 && existing.rows[0].is_valid) {
    console.log(`        SKIP slot ${platform} — já validado (${existing.rows[0].id})`);
    return;
  }
  await c.query(
    `INSERT INTO client_social_credentials
       (client_id, platform, account_name, metadata, is_valid)
     VALUES ($1, $2, $3, $4::jsonb, FALSE)
     ON CONFLICT (client_id, platform) DO UPDATE SET
       account_name = COALESCE(client_social_credentials.account_name, EXCLUDED.account_name),
       metadata = client_social_credentials.metadata || EXCLUDED.metadata,
       updated_at = NOW()
     WHERE client_social_credentials.is_valid = FALSE`,
    [
      clientId,
      platform,
      expectedHandle,
      JSON.stringify({
        pending_oauth: true,
        expected_handle: expectedHandle,
        created_via: 'setup-dsec-alfred-late',
        instructions: 'Conectar via Late dashboard → Connect Account',
      }),
    ],
  );
}

async function ensureAlfredClient(c: any): Promise<string> {
  // Idempotência: tenta achar Alfred existente
  const existing = await c.query(
    `SELECT id FROM clients WHERE name = 'Alfred' AND workspace_id = $1`,
    [KALEIDOS_WORKSPACE_ID],
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  if (dryRun) {
    return '<would-create-alfred>';
  }

  const r = await c.query(
    `INSERT INTO clients
       (name, workspace_id, user_id, created_by, description, context_notes,
        social_media, tags, voice_profile, content_guidelines, identity_guide)
     VALUES ($1, $2, $3, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
     RETURNING id`,
    [
      'Alfred',
      KALEIDOS_WORKSPACE_ID,
      KALEIDOS_USER_ID,
      'Persona pública da DSEC Labs no X (@alfredp2p). Reply guy PT-BR lowercase no nicho de segurança Bitcoin/auto-custódia. Voz independente da marca DSEC institucional.',
      'Status: ativo (persona DSEC Labs).\nVoz: PT-BR lowercase em TODOS os canais desde 2026-05-04 (decisão consolidada — regras antigas EN obsoletas).\nFormato dominante: reply guy no X (@alfredp2p) cruzando posts sobre Bitcoin/auto-custódia/segurança.\nDistinto da voz DSEC institucional (PT-BR formal). Alfred é "alfred", pequeno, conversacional, opinionado.\nKAI client_id: pendente (criado por scripts/setup-dsec-alfred-late.ts).\nRelacionamento: persona da empresa DSEC Labs (cliente Kaleidos).',
      JSON.stringify({
        twitter: '@alfredp2p',
      }),
      JSON.stringify({
        list: ['dsec', 'persona', 'bitcoin', 'seguranca', 'auto-custodia', 'reply-guy', 'twitter'],
      }),
      JSON.stringify({
        tone: 'lowercase, conversacional, direto, sem ego',
        style: 'reply guy, frases curtas, sem capitalização, opinião com fundamento',
        language: 'pt-BR lowercase',
        personality: ['independente', 'tecnico-mas-acessivel', 'sem hype', 'opinionado'],
        forbidden_topics: ['shill de altcoin', 'preço de bitcoin', 'previsão de mercado'],
      }),
      'Voz lowercase em TODOS os canais (X, LinkedIn, blog, newsletter).\nReply guy no X cruzando posts sobre auto-custódia, segurança Bitcoin, OPSEC.\nNUNCA inventar preço, URL, cupom (referência: ColdKit incident 2026-05-04).\nCTA padrão: DM para receber material, aguardar dados reais do Leonardo (founder DSEC).\nDistinto da voz DSEC institucional — Alfred é a persona, DSEC é a marca.',
      '# Alfred — Identity Guide\n\n**Quem é:** persona pública da DSEC Labs no X (@alfredp2p). Reply guy lowercase do nicho segurança Bitcoin/auto-custódia.\n\n**Audiência:** holders BR de Bitcoin de longo prazo, preocupados com segurança e soberania. Devs cripto, OG bitcoiners, gente que rodou de exchange.\n\n**Tom:** tudo em lowercase. Conversacional, direto, sem ego. Reply guy técnico mas acessível.\n\n**Mecanismo único:** persona distinta da marca institucional DSEC. Alfred opina, debate, brinca. DSEC documenta, ensina, vende.\n\n**Formatos:**\n- X reply (principal): comenta posts de bitcoiners BR/EN sobre segurança/auto-custódia\n- LinkedIn post (secundário): mais longo, ainda lowercase, ainda Alfred\n- Blog post: tutorial passo-a-passo canônico (PT-BR formal vira PT-BR Alfred)\n\n**Não-negociáveis:**\n- TUDO em lowercase (regra dura desde 2026-05-04)\n- Sem hashtag\n- Sem emoji exceto contexto raro\n- Nunca inventar preço/URL/cupom\n- Nunca dar call de altcoin\n- Sempre PT-BR (regras antigas EN são obsoletas)',
    ],
  );
  return r.rows[0].id;
}

async function main() {
  console.log('========================================');
  console.log('Setup DSEC Labs + Alfred — Late profiles');
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log('========================================\n');

  const pool = new Pool({ connectionString: DATABASE_URL });
  const c = await pool.connect();

  try {
    // 1) Carregar cache de profiles Late
    let cache: LateProfile[] = [];
    if (!dryRun) {
      console.log('[1] Carregando profiles Late existentes...');
      const list = await lateGet<{ profiles: LateProfile[] }>('/profiles');
      if (!list.ok) {
        console.error(`[fatal] Falha listar profiles Late (HTTP ${list.status}): ${list.text.substring(0, 300)}`);
        process.exit(1);
      }
      cache = list.data?.profiles || [];
      console.log(`    ${cache.length} profiles já existem no Late\n`);
    }

    // ===== DSEC Labs =====
    console.log('[2] DSEC Labs');
    console.log(`    KAI client_id: ${DSEC_CLIENT_ID}`);
    const dsec = await ensureLateProfile(cache, 'DSEC Labs');
    console.log(`    Late profile: ${dsec.id} (${dsec.reused ? 'REUSE' : 'CREATED'})`);
    await upsertLateProfileCred(c, DSEC_CLIENT_ID, dsec.id, 'DSEC Labs');
    console.log(`    [DB] client_social_credentials.late_profile upserted`);
    await upsertPendingOAuthSlot(c, DSEC_CLIENT_ID, 'twitter', '@DSEC_Labs');
    console.log(`    [DB] pending OAuth slot: twitter (@DSEC_Labs)`);
    await upsertPendingOAuthSlot(c, DSEC_CLIENT_ID, 'linkedin', 'DSEC Labs');
    console.log(`    [DB] pending OAuth slot: linkedin (DSEC Labs)`);
    console.log('');

    // ===== Alfred =====
    console.log('[3] Alfred (novo cliente)');
    const alfredId = await ensureAlfredClient(c);
    console.log(`    KAI client_id: ${alfredId} ${alfredId === '<would-create-alfred>' ? '(dry)' : ''}`);
    const alfred = await ensureLateProfile(cache, 'Alfred');
    console.log(`    Late profile: ${alfred.id} (${alfred.reused ? 'REUSE' : 'CREATED'})`);
    if (alfredId !== '<would-create-alfred>') {
      await upsertLateProfileCred(c, alfredId, alfred.id, 'Alfred');
      console.log(`    [DB] client_social_credentials.late_profile upserted`);
      await upsertPendingOAuthSlot(c, alfredId, 'twitter', '@alfredp2p');
      console.log(`    [DB] pending OAuth slot: twitter (@alfredp2p)`);
    }
    console.log('');

    // ===== Report =====
    console.log('========================================');
    console.log('Resumo');
    console.log('========================================');
    console.log(`DSEC Labs:`);
    console.log(`  KAI client_id:    ${DSEC_CLIENT_ID}`);
    console.log(`  Late profile_id:  ${dsec.id}`);
    console.log(`  Dashboard:        https://app.getlate.dev/profiles/${dsec.id}`);
    console.log(`  Plataformas pré-criadas: twitter, linkedin (pending OAuth)`);
    console.log('');
    console.log(`Alfred:`);
    console.log(`  KAI client_id:    ${alfredId}`);
    console.log(`  Late profile_id:  ${alfred.id}`);
    console.log(`  Dashboard:        https://app.getlate.dev/profiles/${alfred.id}`);
    console.log(`  Plataformas pré-criadas: twitter (pending OAuth)`);
    console.log('');
    console.log('PRÓXIMOS PASSOS GABRIEL:');
    console.log(`  1. Abrir https://app.getlate.dev/profiles/${dsec.id}`);
    console.log(`     → Connect Account → Twitter (@DSEC_Labs ou handle real)`);
    console.log(`     → Connect Account → LinkedIn (página DSEC Labs)`);
    console.log(`  2. Abrir https://app.getlate.dev/profiles/${alfred.id}`);
    console.log(`     → Connect Account → Twitter (@alfredp2p)`);
    console.log(`  3. Quando OAuth completar, rodar:`);
    console.log(`       bun run scripts/backfill-late-profiles.ts --client=${DSEC_CLIENT_ID}`);
    console.log(`       bun run scripts/backfill-late-profiles.ts --client=${alfredId}`);
    console.log(`     (re-mapeia accounts conectados → client_social_credentials)`);

    if (dryRun) {
      console.log('\n(dry-run — nenhuma chamada Late nem mutação DB foi feita)');
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
