#!/usr/bin/env bun
/**
 * Importador idempotente de conteúdo pra KAI 2.0 (Neon).
 *
 * Fontes:
 *   1. ClickUp Kaleidos (Conteúdo & Growth → Redes Sociais)  → client Kaleidos
 *   2. ClickUp Defiverso (Instagram Defiverso)                → client Defiverso
 *   3. Supabase KAI antigo (DSEC Labs planning_items)         → client DSEC Labs
 *
 * Idempotência: metadata.external_id é único por (source, id). Se já existe,
 * faz UPDATE em vez de INSERT — preserva edits manuais que rolaram no KAI 2.0.
 */
import { Pool } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

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

// ─── Constantes de mapeamento ────────────────────────────────────────────
const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const OWNER_USER_ID = '5014248e-b1ac-4306-8490-2644dcd8aeb5'; // Gabriel (owner do workspace)

const CLIENTS = {
  kaleidos: 'efdecbbc-00d9-460b-a746-3053b7366f6d',
  defiverso: '6129ea04-e53e-426d-b5ab-ce8553dde11e',
  dsec: '4e8be599-0d50-4759-b8a8-fb0b399e1551',
  madureira: '14bf8576-7104-48ca-962d-014308e45a4e',
  hugo: '501cc4b6-0055-446a-b71a-d786af0a4158',
  lucas: 'e600c33f-717d-45c4-aa67-fe76f4130139',
  layla: '903d4c5e-e0c1-4098-a336-8fe4da11b1eb',
};

// list_id ClickUp → { client_key, platform }
const LIST_ROUTING: Record<string, { clientKey: keyof typeof CLIENTS; platform: string }> = {
  '901113611531': { clientKey: 'madureira', platform: 'instagram' },
  '901113611532': { clientKey: 'madureira', platform: 'twitter' },
  '901113627163': { clientKey: 'madureira', platform: 'linkedin' },
  '901113510382': { clientKey: 'dsec', platform: 'blog' },
  '901113510384': { clientKey: 'dsec', platform: 'twitter' },
  '901113510386': { clientKey: 'dsec', platform: 'linkedin' },
  '901113534480': { clientKey: 'dsec', platform: 'other' },
  '901111727480': { clientKey: 'defiverso', platform: 'newsletter' },
  '901113468535': { clientKey: 'defiverso', platform: 'instagram' },
  '901111718522': { clientKey: 'defiverso', platform: 'twitter' },
  '901112500589': { clientKey: 'lucas', platform: 'youtube' },
  '901112411569': { clientKey: 'hugo', platform: 'youtube' },
  '901112411571': { clientKey: 'hugo', platform: 'other' },
  '901113389898': { clientKey: 'lucas', platform: 'linkedin' },
  '901111718507': { clientKey: 'layla', platform: 'newsletter' },
};

// ClickUp status → KAI column_type
const CLICKUP_STATUS_MAP: Record<string, string | null> = {
  Open: 'idea',
  iniciar: 'idea',
  'em andamento': 'draft',
  design: 'draft',
  'edição de vídeo': 'draft',
  revisão: 'review',
  publicar: 'approved',
  aprovado: 'approved',
  programado: 'scheduled',
  reprovado: null, // pular
};

// tags ClickUp → content_type KAI
function inferContentType(tags: string[], name: string): string {
  const lc = (tags ?? []).map((t) => t.toLowerCase());
  const nameLc = name.toLowerCase();
  if (lc.includes('carrossel') || nameLc.includes('[carrossel]') || nameLc.startsWith('carrossel')) return 'carousel';
  if (lc.includes('reels') || nameLc.includes('[reels]') || nameLc.startsWith('reels')) return 'short_video';
  if (lc.includes('roteiro')) return 'short_video';
  if (lc.includes('estático único') || lc.includes('estatico unico')) return 'static_image';
  if (lc.includes('newsletter') || nameLc.includes('newsletter')) return 'newsletter';
  if (nameLc.includes('linkedin')) return 'linkedin_post';
  if (nameLc.includes('twitter') || nameLc.includes('tweet')) return 'tweet';
  return 'social_post';
}

function inferPlatform(listSlug: 'kaleidos' | 'defiverso', name: string): string {
  const nameLc = name.toLowerCase();
  if (nameLc.startsWith('post twitter') || nameLc.includes('tweet')) return 'twitter';
  if (nameLc.includes('linkedin')) return 'linkedin';
  return 'instagram';
}

// ─── Helpers DB ───────────────────────────────────────────────────────────
type ColumnMap = Record<string, string>;

async function loadColumnMap(c: any): Promise<ColumnMap> {
  const r = await c.query(
    `SELECT id, column_type FROM kanban_columns WHERE workspace_id = $1 AND is_default = true`,
    [WORKSPACE_ID],
  );
  const map: ColumnMap = {};
  for (const row of r.rows) map[row.column_type] = row.id;
  return map;
}

async function upsertPlanningItem(c: any, item: {
  clientId: string;
  source: string;
  externalId: string;
  title: string;
  content: string | null;
  contentType: string;
  platform: string;
  status: string;
  columnId: string;
  scheduledAt: string | null;
  dueDate: string | null;
  externalUrl: string;
  labels: string[];
  extraMetadata?: Record<string, unknown>;
}): Promise<'inserted' | 'updated' | 'skipped'> {
  const metadata = {
    source: item.source,
    external_id: item.externalId,
    external_url: item.externalUrl,
    ...(item.extraMetadata ?? {}),
  };
  // Dedupe via metadata->>'external_id' + source
  const existing = await c.query(
    `SELECT id FROM planning_items
      WHERE workspace_id = $1
        AND client_id = $2
        AND metadata->>'source' = $3
        AND metadata->>'external_id' = $4
      LIMIT 1`,
    [WORKSPACE_ID, item.clientId, item.source, item.externalId],
  );
  if (existing.rows.length > 0) {
    // Não sobrescreve — preserva edits feitos depois do import inicial
    return 'skipped';
  }
  await c.query(
    `INSERT INTO planning_items (
       workspace_id, client_id, column_id, title, content, content_type,
       platform, status, scheduled_at, due_date, labels, metadata, position, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, $13)`,
    [
      WORKSPACE_ID,
      item.clientId,
      item.columnId,
      item.title.slice(0, 500),
      item.content,
      item.contentType,
      item.platform,
      item.status,
      item.scheduledAt,
      item.dueDate,
      JSON.stringify(item.labels),
      JSON.stringify(metadata),
      OWNER_USER_ID,
    ],
  );
  return 'inserted';
}

// ─── Importadores ────────────────────────────────────────────────────────
async function importClickUp(
  c: any,
  fixtureFile: string,
  clientKey: 'kaleidos' | 'defiverso',
  cols: ColumnMap,
): Promise<{ inserted: number; skipped: number; rejected: number }> {
  const tasks = JSON.parse(readFileSync(join(import.meta.dir, '_fixtures', fixtureFile), 'utf-8'));
  let inserted = 0,
    skipped = 0,
    rejected = 0;
  for (const t of tasks) {
    const colType = CLICKUP_STATUS_MAP[t.status];
    if (!colType) {
      rejected++;
      continue;
    }
    const columnId = cols[colType];
    if (!columnId) {
      console.warn(`No column for type ${colType}`);
      rejected++;
      continue;
    }
    const dueIso = t.due_date ? new Date(Number(t.due_date)).toISOString() : null;
    const status = colType === 'scheduled' ? 'scheduled' : colType === 'approved' ? 'approved' : colType;
    const result = await upsertPlanningItem(c, {
      clientId: CLIENTS[clientKey],
      source: 'clickup',
      externalId: t.id,
      title: t.name,
      content: null,
      contentType: inferContentType(t.tags ?? [], t.name),
      platform: inferPlatform(clientKey, t.name),
      status,
      columnId,
      scheduledAt: colType === 'scheduled' ? dueIso : null,
      dueDate: dueIso ? dueIso.slice(0, 10) : null,
      externalUrl: t.url,
      labels: t.tags ?? [],
      extraMetadata: { clickup_status: t.status, clickup_list: fixtureFile.replace('.json', '') },
    });
    if (result === 'inserted') inserted++;
    else skipped++;
  }
  return { inserted, skipped, rejected };
}

// Batch 2: lê fixture com tasks que carregam `list_id`, e mapeia via LIST_ROUTING
async function importClickUpRouted(
  c: any,
  fixtureFile: string,
  cols: ColumnMap,
): Promise<{ inserted: number; skipped: number; rejected: number }> {
  const tasks = JSON.parse(readFileSync(join(import.meta.dir, '_fixtures', fixtureFile), 'utf-8'));
  let inserted = 0,
    skipped = 0,
    rejected = 0;
  for (const t of tasks) {
    const routing = LIST_ROUTING[t.list_id];
    if (!routing) {
      console.warn(`No routing for list_id ${t.list_id}`);
      rejected++;
      continue;
    }
    const colType = CLICKUP_STATUS_MAP[t.status];
    if (!colType) {
      rejected++;
      continue;
    }
    const columnId = cols[colType];
    if (!columnId) {
      console.warn(`No column for type ${colType}`);
      rejected++;
      continue;
    }
    const dueIso = t.due_date ? new Date(Number(t.due_date)).toISOString() : null;
    const status = colType;
    const result = await upsertPlanningItem(c, {
      clientId: CLIENTS[routing.clientKey],
      source: 'clickup',
      externalId: t.id,
      title: t.name,
      content: null,
      contentType: inferContentType(t.tags ?? [], t.name),
      platform: routing.platform,
      status,
      columnId,
      scheduledAt: colType === 'scheduled' ? dueIso : null,
      dueDate: dueIso ? dueIso.slice(0, 10) : null,
      externalUrl: t.url,
      labels: t.tags ?? [],
      extraMetadata: { clickup_status: t.status, clickup_list_id: t.list_id },
    });
    if (result === 'inserted') inserted++;
    else skipped++;
  }
  return { inserted, skipped, rejected };
}

async function importDsec(c: any, cols: ColumnMap): Promise<{ inserted: number; skipped: number }> {
  const dumpFile =
    '/Users/gabrielmadureira/.claude/projects/-Users-gabrielmadureira-GOS/e4830dc2-a20c-4b6b-bc37-3fdc50099fb0/tool-results/mcp-kaleidos-query_table-1779107582128.txt';
  const raw = readFileSync(dumpFile, 'utf-8');
  const parsed = JSON.parse(raw);
  const rows: any[] = parsed.data;
  let inserted = 0,
    skipped = 0;

  // status Supabase usa idea/draft/review/approved/scheduled/published — match direto com nosso column_type
  for (const r of rows) {
    const colType: string = r.status ?? 'idea';
    const columnId = cols[colType];
    if (!columnId) {
      console.warn(`DSEC: no column for status ${colType}`);
      continue;
    }
    const result = await upsertPlanningItem(c, {
      clientId: CLIENTS.dsec,
      source: 'kai-supabase',
      externalId: r.id,
      title: r.title || 'Sem título',
      content: r.content ?? null,
      contentType: r.content_type ?? 'social_post',
      platform: r.platform ?? 'twitter',
      status: r.status ?? 'idea',
      columnId,
      scheduledAt: r.scheduled_at,
      dueDate: r.due_date,
      externalUrl: `https://kai.kaleidos.com.br/planning/items/${r.id}`,
      labels: Array.isArray(r.labels) ? r.labels : [],
      extraMetadata: { original_metadata: r.metadata, media_urls: r.media_urls },
    });
    if (result === 'inserted') inserted++;
    else skipped++;
  }
  return { inserted, skipped };
}

// ─── Main ────────────────────────────────────────────────────────────────
const c = await pool.connect();
try {
  const cols = await loadColumnMap(c);
  console.log('Column map:', cols);
  console.log('---');

  console.log('→ Importando Kaleidos (ClickUp)...');
  const k = await importClickUp(c, 'clickup-kaleidos-901113038758.json', 'kaleidos', cols);
  console.log(`  inserted=${k.inserted}  skipped=${k.skipped}  rejected_status=${k.rejected}`);

  console.log('→ Importando Defiverso IG (ClickUp)...');
  const d = await importClickUp(c, 'clickup-defiverso-ig-901111718528.json', 'defiverso', cols);
  console.log(`  inserted=${d.inserted}  skipped=${d.skipped}  rejected_status=${d.rejected}`);

  console.log('→ Importando DSEC (Supabase)...');
  const ds = await importDsec(c, cols);
  console.log(`  inserted=${ds.inserted}  skipped=${ds.skipped}`);

  // Batch 2 — listas adicionais por cliente, roteadas via list_id
  const batch2Files = [
    'clickup-madureira.json',
    'clickup-defiverso-extra.json',
    'clickup-hugo-lucas-layla.json',
    'clickup-dsec.json',
  ];
  let b2Inserted = 0,
    b2Skipped = 0,
    b2Rejected = 0;
  for (const fixture of batch2Files) {
    console.log(`→ Importando ${fixture}...`);
    const r = await importClickUpRouted(c, fixture, cols);
    console.log(`  inserted=${r.inserted}  skipped=${r.skipped}  rejected=${r.rejected}`);
    b2Inserted += r.inserted;
    b2Skipped += r.skipped;
    b2Rejected += r.rejected;
  }

  console.log('---');
  console.log(`Total inserted batch 1: ${k.inserted + d.inserted + ds.inserted}`);
  console.log(`Total inserted batch 2: ${b2Inserted} (skipped=${b2Skipped} rejected=${b2Rejected})`);
} finally {
  c.release();
  await pool.end();
}
