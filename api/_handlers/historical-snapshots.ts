// Lê a série histórica de zernio_daily_snapshots pra um cliente+rede.
// Alimenta o hook useHistoricalSnapshots (Performance UI).
// Substitui o stub que sempre voltava vazio.
import { authedPost } from '../_lib/handler.js';
import { query } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

function spDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

export default authedPost(async ({ body, user }) => {
  const clientId = body?.clientId as string | undefined;
  const network = (body?.network as string | undefined) || 'instagram';
  const period = Number(body?.period) > 0 ? Number(body.period) : 30;
  if (!clientId) throw new Error('clientId required');
  await assertClientAccess(user.id, clientId);

  const now = new Date();
  const from = new Date(now.getTime() - period * 86400000);
  const fromKey = spDateKey(from);
  const toKey = spDateKey(now);

  const rows = await query<any>(
    `SELECT snapshot_date, followers, posts_count, total_likes, total_comments,
            total_shares, total_reach, total_impressions, total_views, total_saves,
            avg_engagement_rate
       FROM zernio_daily_snapshots
      WHERE client_id = $1 AND network = $2 AND snapshot_date >= $3::date
      ORDER BY snapshot_date ASC`,
    [clientId, network, fromKey],
  );

  const snapshots = rows.map((r) => ({
    date: typeof r.snapshot_date === 'string'
      ? r.snapshot_date
      : spDateKey(new Date(r.snapshot_date)),
    followers: r.followers === null ? null : Number(r.followers),
    posts_count: Number(r.posts_count) || 0,
    total_likes: Number(r.total_likes) || 0,
    total_comments: Number(r.total_comments) || 0,
    total_shares: Number(r.total_shares) || 0,
    total_reach: Number(r.total_reach) || 0,
    total_impressions: Number(r.total_impressions) || 0,
    total_views: Number(r.total_views) || 0,
    total_saves: Number(r.total_saves) || 0,
    avg_engagement_rate: Number(r.avg_engagement_rate) || 0,
    source: 'snapshot' as const,
  }));

  const snapshotDays = snapshots.length;
  return {
    ok: true as const,
    snapshots,
    source: snapshotDays > 0 ? ('snapshots' as const) : ('api' as const),
    range: { from: fromKey, to: toKey, days: period },
    coverage: {
      snapshotDays,
      totalDays: period,
      ratio: period > 0 ? Math.round((snapshotDays / period) * 100) / 100 : 0,
    },
  };
});
