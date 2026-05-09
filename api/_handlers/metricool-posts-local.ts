// Lê posts locais (tabela metricool_posts populada pelo cron de backfill).
// Drop-in pra useMetricoolPostsLocal — fallback à API quando vazio.
//
// Body:
//   - clientId   (uuid, obrigatório)
//   - network    (string, obrigatório)
//   - from?      (ISO string) default -90d
//   - to?        (ISO string) default agora
//   - limit?     (number) default 200
import { authedPost } from '../_lib/handler.js';
import { query } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

export default authedPost(async ({ body, user }) => {
  const { clientId, network, from, to, limit = 200 } = body;
  if (!clientId) throw new Error('clientId obrigatório');
  if (!network) throw new Error('network obrigatório');

  // Authorization: confirma que o user logado tem acesso ao cliente
  // (lança 403 se não for membro do workspace dono do cliente).
  await assertClientAccess(user.id, clientId);

  const fromDate = from ? new Date(from) : new Date(Date.now() - 90 * 86400_000);
  const toDate = to ? new Date(to) : new Date();
  const cap = Math.min(Number(limit) || 200, 1000);

  const rows = await query<any>(
    `SELECT
        post_id,
        post_type,
        url,
        caption,
        thumbnail_url,
        media_urls,
        published_at,
        likes,
        comments,
        shares,
        saves,
        reach,
        impressions,
        views,
        video_views,
        engagement_rate,
        last_synced_at
       FROM metricool_posts
      WHERE client_id = $1
        AND network = $2
        AND (published_at IS NULL OR published_at BETWEEN $3 AND $4)
      ORDER BY published_at DESC NULLS LAST
      LIMIT $5`,
    [clientId, network, fromDate.toISOString(), toDate.toISOString(), cap],
  );

  // Shape compatível com MetricoolPost (hook useMetricoolPosts)
  const posts = rows.map((r) => ({
    id: r.post_id,
    postId: r.post_id,
    type: r.post_type,
    url: r.url,
    permalink: r.url,
    caption: r.caption,
    text: r.caption,
    thumbnail: r.thumbnail_url,
    imageUrl: r.thumbnail_url,
    mediaUrl: r.thumbnail_url,
    mediaUrls: r.media_urls || [],
    date: r.published_at,
    publishedAt: r.published_at,
    publishDate: r.published_at,
    likes: Number(r.likes) || 0,
    comments: Number(r.comments) || 0,
    shares: Number(r.shares) || 0,
    saves: Number(r.saves) || 0,
    reach: Number(r.reach) || 0,
    impressions: Number(r.impressions) || 0,
    views: Number(r.views) || 0,
    videoViews: Number(r.video_views) || 0,
    engagementRate: r.engagement_rate != null ? Number(r.engagement_rate) : undefined,
    lastSyncedAt: r.last_synced_at,
  }));

  return {
    ok: true,
    network,
    posts,
    count: posts.length,
    source: 'local',
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  };
});
