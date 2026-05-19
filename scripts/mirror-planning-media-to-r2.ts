/**
 * Espelha midias legadas de planning_items para Cloudflare R2 sem trocar
 * media_urls. Por padrao roda em dry-run; use --apply para copiar e gravar
 * metadata.media_mirrors.
 *
 * Exemplos:
 *   bun run scripts/mirror-planning-media-to-r2.ts --client=Madureira
 *   bun run scripts/mirror-planning-media-to-r2.ts --client=Madureira --apply --limit=20
 *   bun run scripts/mirror-planning-media-to-r2.ts --env-file=/tmp/prod.env --client=Madureira --apply
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { putObject } from '../api/_lib/r2.js';

type PlanningRow = {
  id: string;
  client_id: string | null;
  title: string | null;
  media_urls: unknown;
  metadata: unknown;
};

type MediaMirror = {
  originalUrl: string;
  r2Url?: string;
  key?: string;
  contentType?: string;
  size?: number;
  copiedAt?: string;
  status: 'ok' | 'pending' | 'failed';
  error?: string;
};

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function extensionFor(url: string, contentType: string): string {
  const byType: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'application/pdf': 'pdf',
    'audio/mpeg': 'mp3',
  };
  if (byType[contentType]) return byType[contentType];
  try {
    const ext = new URL(url).pathname.split('.').pop()?.toLowerCase();
    if (ext && /^[a-z0-9]{2,5}$/.test(ext)) return ext;
  } catch {
    // ignore
  }
  return 'bin';
}

function mirrorKey(row: PlanningRow, url: string, index: number, contentType: string): string {
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 12);
  const ext = extensionFor(url, contentType);
  const client = row.client_id || 'general';
  return `planning-media/mirrors/${client}/${row.id}/${String(index + 1).padStart(2, '0')}-${hash}.${ext}`;
}

async function headUrl(url: string): Promise<{ ok: boolean; status: number; contentType: string; size?: number }> {
  const res = await fetch(url, { method: 'HEAD' });
  return {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get('content-type') || 'application/octet-stream',
    size: Number(res.headers.get('content-length') || '') || undefined,
  };
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');
  const envFile = arg('env-file');
  if (envFile) loadEnvFile(envFile);

  const apply = hasFlag('apply');
  const limit = Number(arg('limit') || '200');
  const clientName = arg('client');
  const clientIdArg = arg('client-id');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL ausente');
  if (apply) {
    for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL']) {
      if (!process.env[key]) throw new Error(`${key} ausente para --apply`);
    }
  }

  const sql = neon(databaseUrl);
  let clientId = clientIdArg;
  if (!clientId && clientName) {
    const rows = await sql`SELECT id FROM clients WHERE lower(name) = lower(${clientName}) LIMIT 1`;
    clientId = rows[0]?.id;
    if (!clientId) throw new Error(`Cliente nao encontrado: ${clientName}`);
  }

  const rows = clientId
    ? await sql`
        SELECT id, client_id, title, media_urls, metadata
          FROM planning_items
         WHERE client_id = ${clientId}
           AND jsonb_typeof(media_urls) = 'array'
           AND jsonb_array_length(media_urls) > 0
         ORDER BY scheduled_at NULLS LAST, updated_at DESC
         LIMIT ${limit}
      `
    : await sql`
        SELECT id, client_id, title, media_urls, metadata
          FROM planning_items
         WHERE jsonb_typeof(media_urls) = 'array'
           AND jsonb_array_length(media_urls) > 0
         ORDER BY scheduled_at NULLS LAST, updated_at DESC
         LIMIT ${limit}
      `;

  let checked = 0;
  let mirrored = 0;
  let failed = 0;

  for (const row of rows as PlanningRow[]) {
    const urls = Array.isArray(row.media_urls)
      ? row.media_urls.filter((url): url is string => typeof url === 'string' && /^https?:\/\//.test(url))
      : [];
    const metadata = asRecord(row.metadata);
    const existing = Array.isArray(metadata.media_mirrors)
      ? (metadata.media_mirrors as MediaMirror[])
      : [];
    const byOriginal = new Map(existing.map((mirror) => [mirror.originalUrl, mirror]));
    const nextMirrors = [...existing];
    let changed = false;

    for (const [index, url] of urls.entries()) {
      checked++;
      const current = byOriginal.get(url);
      if (current?.status === 'ok' && current.r2Url) continue;

      try {
        const head = await headUrl(url);
        if (!head.ok) throw new Error(`HEAD ${head.status}`);
        if (!apply) {
          console.log(`[dry] ${row.id} #${index + 1} ${head.contentType} ${head.size || '?'} ${url}`);
          continue;
        }

        const bodyRes = await fetch(url);
        if (!bodyRes.ok) throw new Error(`GET ${bodyRes.status}`);
        const contentType = bodyRes.headers.get('content-type') || head.contentType;
        const buffer = Buffer.from(await bodyRes.arrayBuffer());
        const key = mirrorKey(row, url, index, contentType);
        const uploaded = await putObject(key, buffer, contentType);
        const mirror: MediaMirror = {
          originalUrl: url,
          r2Url: uploaded.url,
          key: uploaded.key,
          contentType,
          size: uploaded.size,
          copiedAt: new Date().toISOString(),
          status: 'ok',
        };
        const existingIndex = nextMirrors.findIndex((item) => item.originalUrl === url);
        if (existingIndex >= 0) nextMirrors[existingIndex] = mirror;
        else nextMirrors.push(mirror);
        changed = true;
        mirrored++;
        console.log(`[ok] ${row.id} #${index + 1} -> ${uploaded.url}`);
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[fail] ${row.id} #${index + 1}: ${message}`);
        if (apply) {
          const mirror: MediaMirror = {
            originalUrl: url,
            copiedAt: new Date().toISOString(),
            status: 'failed',
            error: message,
          };
          const existingIndex = nextMirrors.findIndex((item) => item.originalUrl === url);
          if (existingIndex >= 0) nextMirrors[existingIndex] = mirror;
          else nextMirrors.push(mirror);
          changed = true;
        }
      }
    }

    if (apply && changed) {
      const nextMetadata = { ...metadata, media_mirrors: nextMirrors };
      await sql`UPDATE planning_items SET metadata = ${JSON.stringify(nextMetadata)}::jsonb WHERE id = ${row.id}`;
    }
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', cards: rows.length, checked, mirrored, failed }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
