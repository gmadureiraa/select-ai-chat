#!/usr/bin/env bun
/**
 * Enriquece planning_items vindos do ClickUp com descrição + attachments
 * via API ClickUp direta (paralelo, 10 requests simultâneos).
 *
 * Pré-req: CLICKUP_API_TOKEN no .env.local
 *
 * Idempotente: só faz UPDATE se content estiver null/vazio (não sobrescreve
 * edits manuais que rolaram no KAI 2.0).
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
        rest
          .join('=')
          .trim()
          .replace(/^"/, '')
          .replace(/"\s*\\n?\s*$/, '')
          .replace(/"$/, ''),
      ];
    }),
);

const TOKEN = env.CLICKUP_API_TOKEN;
if (!TOKEN) {
  console.error('CLICKUP_API_TOKEN não setado no .env.local');
  process.exit(1);
}

const pool = new Pool({ connectionString: env.DATABASE_URL });
const PARALLEL = 10;
const RETRY_429_MS = 1100; // ClickUp ratelimit é 100req/min

interface ClickUpTask {
  id: string;
  description?: string | null;
  text_content?: string | null;
  markdown_description?: string | null;
  attachments?: Array<{ id: string; title?: string; url?: string; type?: number }>;
  custom_fields?: any[];
}

async function fetchTask(taskId: string, retries = 3): Promise<ClickUpTask | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(
        `https://api.clickup.com/api/v2/task/${taskId}?include_subtasks=false&custom_fields=true`,
        { headers: { Authorization: TOKEN } },
      );
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, RETRY_429_MS * (attempt + 1)));
        continue;
      }
      if (res.status === 404) return null;
      if (!res.ok) {
        if (attempt === retries - 1) {
          console.warn(`  ${taskId}: HTTP ${res.status}`);
          return null;
        }
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      return (await res.json()) as ClickUpTask;
    } catch (err) {
      if (attempt === retries - 1) {
        console.warn(`  ${taskId}: ${(err as Error).message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

async function processCard(
  client: any,
  card: { id: string; clickup_id: string },
): Promise<'enriched' | 'no-content' | 'failed'> {
  const task = await fetchTask(card.clickup_id);
  if (!task) return 'failed';

  // Prefere markdown_description, cai pra text_content, cai pra description
  const rawContent =
    (task.markdown_description?.trim() ?? '') ||
    (task.text_content?.trim() ?? '') ||
    (task.description?.trim() ?? '');

  const attachments = (task.attachments ?? [])
    .filter((a) => a.url)
    .map((a) => a.url as string);

  if (!rawContent && attachments.length === 0) return 'no-content';

  await client.query(
    `UPDATE planning_items
        SET content = COALESCE(NULLIF(content, ''), $1),
            media_urls = CASE
              WHEN media_urls IS NULL OR media_urls = '[]'::jsonb THEN $2::jsonb
              ELSE media_urls
            END,
            metadata = metadata || $3::jsonb,
            updated_at = NOW()
      WHERE id = $4`,
    [
      rawContent || null,
      JSON.stringify(attachments),
      JSON.stringify({
        enriched_at: new Date().toISOString(),
        clickup_attachment_count: attachments.length,
      }),
      card.id,
    ],
  );
  return 'enriched';
}

const cards: Array<{ id: string; clickup_id: string }> = JSON.parse(
  readFileSync('scripts/_fixtures/clickup-cards-to-enrich.json', 'utf-8'),
);

console.log(`Enriquecendo ${cards.length} cards (paralelo=${PARALLEL})...`);
const c = await pool.connect();

let enriched = 0,
  noContent = 0,
  failed = 0,
  processed = 0;

const startTime = Date.now();
try {
  for (let i = 0; i < cards.length; i += PARALLEL) {
    const batch = cards.slice(i, i + PARALLEL);
    const results = await Promise.all(batch.map((card) => processCard(c, card)));
    for (const r of results) {
      if (r === 'enriched') enriched++;
      else if (r === 'no-content') noContent++;
      else failed++;
    }
    processed += batch.length;
    if (processed % 50 === 0 || processed === cards.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(
        `  ${processed}/${cards.length} (enriched=${enriched} no-content=${noContent} failed=${failed}) ${elapsed}s`,
      );
    }
  }
} finally {
  c.release();
  await pool.end();
}

console.log('---');
console.log(`✓ Enriched: ${enriched}`);
console.log(`○ No content: ${noContent}`);
console.log(`✗ Failed: ${failed}`);
console.log(`Tempo total: ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
