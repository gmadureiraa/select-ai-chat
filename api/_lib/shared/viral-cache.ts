// Port of supabase/functions/_shared/viralCache.ts → Neon
import { getPool } from '../db.js';

export interface CacheArgs {
  workspaceId?: string;
  clientId?: string;
  source: 'youtube' | 'news' | 'trends' | 'instagram';
  query: string;
  items: unknown[];
  filters?: Record<string, unknown>;
  isFallback?: boolean;
  nextPageToken?: string | null;
  userId?: string | null;
}

export function normalizeQuery(q: string): string {
  return (q ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function cacheViralSearch(args: CacheArgs): Promise<void> {
  if (!args.workspaceId || !args.clientId || !Array.isArray(args.items) || args.items.length === 0) return;
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO viral_search_cache (
         workspace_id, client_id, source, query, query_normalized,
         filters, items, item_count, is_fallback, next_page_token, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11)`,
      [
        args.workspaceId,
        args.clientId,
        args.source,
        args.query,
        normalizeQuery(args.query),
        JSON.stringify(args.filters ?? {}),
        JSON.stringify(args.items),
        args.items.length,
        !!args.isFallback,
        args.nextPageToken ?? null,
        args.userId ?? null,
      ]
    );
  } catch (e) {
    console.warn(`[viral-cache:${args.source}] insert failed:`, (e as Error).message);
  }
}
