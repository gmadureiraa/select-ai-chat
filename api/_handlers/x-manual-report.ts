// x-manual-report — CRUD pra relatórios manuais do X/Twitter.
//
// Por que: a X API custa caro (USD 100/mês plano básico, USD 5k+ pra full
// firehose). Em vez de pagar, o usuário cola números do twitter.com/analytics
// em modal e a gente persiste em client_x_manual_reports (migration 0048).
//
// Ações suportadas via body.action:
//   - "list"   → lista todos os relatórios do cliente
//   - "create" → cria novo relatório
//   - "delete" → remove relatório por id
//
// Padrão sigle-endpoint pra evitar 3 handlers separados num feature pequena.
import { authedPost } from '../_lib/handler.js';
import { query, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

export interface XManualReport {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  impressions: number;
  engagements: number;
  likes: number;
  replies: number;
  retweets: number;
  bookmarks: number;
  profile_visits: number;
  new_followers: number;
  notes: string | null;
  top_tweets: Array<{ url?: string; text?: string; impressions?: number; likes?: number }>;
  created_at: string;
  updated_at: string;
}

export default authedPost(async ({ body, user }) => {
  const { clientId, action } = body || {};
  if (!clientId) throw new Error('clientId is required');
  if (!action) throw new Error('action is required');
  await assertClientAccess(user.id, clientId);

  if (action === 'list') {
    const rows = await query<XManualReport>(
      `SELECT id, client_id, period_start::text, period_end::text,
              impressions, engagements, likes, replies, retweets, bookmarks,
              profile_visits, new_followers, notes, top_tweets,
              created_at, updated_at
         FROM public.client_x_manual_reports
        WHERE client_id = $1
        ORDER BY period_end DESC, created_at DESC
        LIMIT 100`,
      [clientId],
    );
    return { success: true, reports: rows };
  }

  if (action === 'create') {
    const {
      periodStart,
      periodEnd,
      impressions = 0,
      engagements = 0,
      likes = 0,
      replies = 0,
      retweets = 0,
      bookmarks = 0,
      profileVisits = 0,
      newFollowers = 0,
      notes = null,
      topTweets = [],
    } = body;
    if (!periodStart || !periodEnd) throw new Error('periodStart and periodEnd are required');

    const row = await queryOne<XManualReport>(
      `INSERT INTO public.client_x_manual_reports
         (client_id, period_start, period_end, impressions, engagements, likes,
          replies, retweets, bookmarks, profile_visits, new_followers, notes,
          top_tweets, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14)
       RETURNING id, client_id, period_start::text, period_end::text,
                 impressions, engagements, likes, replies, retweets, bookmarks,
                 profile_visits, new_followers, notes, top_tweets,
                 created_at, updated_at`,
      [
        clientId,
        periodStart,
        periodEnd,
        Number(impressions) || 0,
        Number(engagements) || 0,
        Number(likes) || 0,
        Number(replies) || 0,
        Number(retweets) || 0,
        Number(bookmarks) || 0,
        Number(profileVisits) || 0,
        Number(newFollowers) || 0,
        notes,
        JSON.stringify(Array.isArray(topTweets) ? topTweets : []),
        user.id,
      ],
    );
    return { success: true, report: row };
  }

  if (action === 'delete') {
    const { id } = body;
    if (!id) throw new Error('id is required for delete');
    await query(
      `DELETE FROM public.client_x_manual_reports WHERE id = $1 AND client_id = $2`,
      [id, clientId],
    );
    return { success: true };
  }

  throw new Error(`Unknown action: ${action}`);
});
