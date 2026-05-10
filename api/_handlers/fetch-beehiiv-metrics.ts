// Migrated from supabase/functions/fetch-beehiiv-metrics/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

export default authedPost(async ({ body, user }) => {
  const { clientId } = body;
  if (!clientId) throw new Error('Client ID is required');
  await assertClientAccess(user.id, clientId);

  const beehiivApiKey = process.env.BEEHIIV_API_KEY;
  if (!beehiivApiKey) throw new Error('Beehiiv API key not configured');

  const pubR = await fetch('https://api.beehiiv.com/v2/publications?expand=stats', {
    headers: { Authorization: `Bearer ${beehiivApiKey}`, 'Content-Type': 'application/json' },
  });
  if (!pubR.ok) throw new Error(`Beehiiv API error: ${pubR.status}: ${await pubR.text()}`);
  const publications = await pubR.json();
  const publication = publications.data?.[0];
  if (!publication) throw new Error('No publication found');

  const stats = publication.stats || {};
  const subscribers = stats.active_subscriptions || stats.stat_active_subscriptions || 0;
  const openRate = parseFloat(stats.average_open_rate || stats.stat_average_open_rate || 0);
  const clickRate = parseFloat(stats.average_click_rate || stats.stat_average_click_rate || 0);

  let posts: any[] = [];
  try {
    const pr = await fetch(`https://api.beehiiv.com/v2/publications/${publication.id}/posts?status=confirmed&limit=10`, {
      headers: { Authorization: `Bearer ${beehiivApiKey}`, 'Content-Type': 'application/json' },
    });
    if (pr.ok) {
      const pd = await pr.json();
      posts = pd.data || [];
    }
  } catch {}

  const recentPosts = posts.map((post: any) => ({
    id: post.id,
    title: post.title,
    subtitle: post.subtitle,
    published_at: post.publish_date,
    delivered: post.stats?.delivered || 0,
    opened: post.stats?.unique_opens || 0,
    clicked: post.stats?.unique_clicks || 0,
    open_rate: post.stats?.unique_opens && post.stats?.delivered ? ((post.stats.unique_opens / post.stats.delivered) * 100).toFixed(2) : 0,
    click_rate: post.stats?.unique_clicks && post.stats?.delivered ? ((post.stats.unique_clicks / post.stats.delivered) * 100).toFixed(2) : 0,
  }));

  const today = new Date().toISOString().split('T')[0];
  await getPool().query(
    `INSERT INTO platform_metrics (
       client_id, platform, metric_date, subscribers, open_rate, click_rate, total_posts, metadata
     ) VALUES ($1, 'newsletter', $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (client_id, platform, metric_date) DO UPDATE SET
       subscribers = EXCLUDED.subscribers, open_rate = EXCLUDED.open_rate,
       click_rate = EXCLUDED.click_rate, total_posts = EXCLUDED.total_posts, metadata = EXCLUDED.metadata`,
    [
      clientId, today, subscribers, openRate, clickRate, posts.length,
      JSON.stringify({
        publication_name: publication.name,
        publication_id: publication.id,
        raw_stats: stats,
        recent_posts: recentPosts,
      }),
    ]
  );

  return {
    success: true,
    data: { subscribers, openRate, clickRate, totalPosts: posts.length, recentPosts },
  };
});
