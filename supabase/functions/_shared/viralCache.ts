/**
 * Helper compartilhado para padronizar inserção no viral_search_cache.
 * Normaliza a query e armazena filtros estruturados pra histórico consistente
 * entre YouTube, News, Trends e Instagram.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

export interface CacheArgs {
  workspaceId?: string;
  clientId?: string;
  source: "youtube" | "news" | "trends" | "instagram";
  query: string;
  items: unknown[];
  filters?: Record<string, unknown>;
  isFallback?: boolean;
  nextPageToken?: string | null;
  authHeader?: string | null;
}

export function normalizeQuery(q: string): string {
  return (q ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}

export async function cacheViralSearch(args: CacheArgs): Promise<void> {
  if (!args.workspaceId || !args.clientId || !Array.isArray(args.items) || args.items.length === 0) return;
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    let userId: string | null = null;
    if (args.authHeader) {
      const token = args.authHeader.replace("Bearer ", "");
      const { data } = await sb.auth.getUser(token);
      userId = data.user?.id ?? null;
    }
    await sb.from("viral_search_cache").insert({
      workspace_id: args.workspaceId,
      client_id: args.clientId,
      source: args.source,
      query: args.query,
      query_normalized: normalizeQuery(args.query),
      filters: args.filters ?? {},
      items: args.items,
      item_count: args.items.length,
      is_fallback: !!args.isFallback,
      next_page_token: args.nextPageToken ?? null,
      created_by: userId,
    });
  } catch (e) {
    console.warn(`[viralCache:${args.source}] insert failed:`, (e as Error).message);
  }
}
