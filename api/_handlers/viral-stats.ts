// POST /api/viral-stats — agregados de uso viral pra Home + Client Analytics.
// Auth: requer usuário do workspace.
//
// Body: { workspace_id: string, client_id?: string | null, range?: '7d' | '30d' | '90d' }
//
// Tabelas usadas (todas tem workspace_id + client_id + created_at):
//   viral_carousels      — output do generate-viral-carousel
//   viral_reels          — output do adapt-viral-reel
//   viral_radar_briefs   — output do generate-radar-brief
//   workspace_tokens     — saldo + quota mensal (sem filtro client)
//   planning_items       — pipeline editorial
//
// Cada subquery é individualmente safe — se uma tabela falhar, retorna zeros
// ao invés de derrubar o handler inteiro (radar-admin-stats pattern).

import { authedPost } from "../_lib/handler.js";
import { queryOne } from "../_lib/db.js";

interface CountResult {
  total?: number;
  published?: number;
  draft?: number;
  this_period?: number;
}

interface TokenResult {
  quota: number;
  used: number;
  remaining: number;
  balance?: number;
}

interface PlanningResult {
  ideas: number;
  drafts: number;
  scheduled: number;
  published_total: number;
  published_this_period: number;
}

async function safeOne<T>(sql: string, params: any[]): Promise<T | null> {
  try {
    return await queryOne<T>(sql, params);
  } catch (e) {
    console.warn('[viral-stats] subquery failed:', (e as Error)?.message);
    return null;
  }
}

export default authedPost(async ({ body }) => {
  const { workspace_id, client_id, range = '30d' } = body as {
    workspace_id?: string;
    client_id?: string | null;
    range?: '7d' | '30d' | '90d';
  };
  if (!workspace_id) throw new Error('workspace_id required');

  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  // Use parameterized interval to avoid injection
  const sinceClause = `now() - ($${'__since__'} || ' days')::interval`;

  const filterClient = client_id ? 'AND client_id = $2' : '';
  const baseParams: any[] = client_id ? [workspace_id, client_id] : [workspace_id];
  // Append days as the last param, replacing the placeholder index in each query
  const buildSql = (sql: string) => {
    const idx = baseParams.length + 1;
    // Use regex replace instead of replaceAll for broader lib compat.
    return sql.replace(/\$__since__/g, String(idx));
  };
  const params = [...baseParams, String(days)];

  const [carousels, reels, briefs, tokens, planningStats] = await Promise.all([
    safeOne<CountResult>(
      buildSql(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'published')::int AS published,
          COUNT(*) FILTER (WHERE status = 'draft')::int AS draft,
          COUNT(*) FILTER (WHERE created_at > ${sinceClause})::int AS this_period
        FROM viral_carousels
        WHERE workspace_id = $1 ${filterClient}
      `),
      params,
    ),
    safeOne<CountResult>(
      buildSql(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at > ${sinceClause})::int AS this_period
        FROM viral_reels
        WHERE workspace_id = $1 ${filterClient}
      `),
      params,
    ),
    safeOne<CountResult>(
      buildSql(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at > ${sinceClause})::int AS this_period
        FROM viral_radar_briefs
        WHERE workspace_id = $1 ${filterClient}
      `),
      params,
    ),
    safeOne<TokenResult>(
      `SELECT
        COALESCE(monthly_quota, 0)::int AS quota,
        COALESCE(tokens_used_this_period, 0)::int AS used,
        GREATEST(0, COALESCE(monthly_quota, 0) - COALESCE(tokens_used_this_period, 0))::int AS remaining,
        COALESCE(balance, 0)::int AS balance
      FROM workspace_tokens
      WHERE workspace_id = $1`,
      [workspace_id],
    ),
    safeOne<PlanningResult>(
      buildSql(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'idea')::int AS ideas,
          COUNT(*) FILTER (WHERE status = 'draft')::int AS drafts,
          COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
          COUNT(*) FILTER (WHERE status = 'published')::int AS published_total,
          COUNT(*) FILTER (WHERE status = 'published' AND created_at > ${sinceClause})::int AS published_this_period
        FROM planning_items
        WHERE workspace_id = $1 ${filterClient}
      `),
      params,
    ),
  ]);

  return {
    range,
    days,
    carousels: carousels ?? { total: 0, published: 0, draft: 0, this_period: 0 },
    reels: reels ?? { total: 0, this_period: 0 },
    briefs: briefs ?? { total: 0, this_period: 0 },
    tokens: tokens ?? { quota: 0, used: 0, remaining: 0, balance: 0 },
    planning: planningStats ?? {
      ideas: 0,
      drafts: 0,
      scheduled: 0,
      published_total: 0,
      published_this_period: 0,
    },
  };
});
