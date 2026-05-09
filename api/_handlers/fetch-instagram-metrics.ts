// Migrated from supabase/functions/fetch-instagram-metrics/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

export default authedPost(async ({ body, user }) => {
  const { clientId, username } = body;
  if (!clientId || !username) throw new Error('clientId and username are required');
  await assertClientAccess(user.id, clientId);

  const apifyApiKey = process.env.APIFY_API_KEY || process.env.APIFY_API_TOKEN;
  if (!apifyApiKey) throw new Error('APIFY_API_KEY not configured');

  const actorId = 'apify~instagram-profile-scraper';
  const r = await fetch(`https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], resultsLimit: 12 }),
  });
  if (!r.ok) throw new Error(`Apify request failed: ${r.status}: ${await r.text()}`);
  const apifyData = await r.json();
  if (!apifyData || apifyData.length === 0) throw new Error('No data returned from Apify');

  const profileData = apifyData[0];
  const recentPosts = profileData.latestPosts || [];

  let totalViews = 0, totalLikes = 0, totalComments = 0, totalShares = 0;
  const postMetrics = recentPosts.slice(0, 12).map((post: any) => {
    const views = post.videoViewCount || post.playCount || 0;
    const likes = post.likesCount || 0;
    const comments = post.commentsCount || 0;
    totalViews += views;
    totalLikes += likes;
    totalComments += comments;
    return {
      id: post.id, shortcode: post.shortCode, type: post.type, timestamp: post.timestamp,
      likes, comments, views, caption: post.caption?.substring(0, 100), url: post.url,
    };
  });

  const followers = profileData.followersCount || 0;
  const engagementRate = followers > 0 ? Number(((totalLikes + totalComments) / (recentPosts.length * followers) * 100).toFixed(2)) : 0;

  const metrics = {
    followers,
    following: profileData.followsCount || 0,
    posts_count: profileData.postsCount || 0,
    total_views: totalViews,
    total_likes: totalLikes,
    total_comments: totalComments,
    total_shares: totalShares,
    engagement_rate: engagementRate,
    recent_posts: postMetrics,
    bio: profileData.biography,
    profile_pic: profileData.profilePicUrl,
    is_verified: profileData.verified,
    fetched_at: new Date().toISOString(),
  };

  const today = new Date().toISOString().split('T')[0];
  await getPool().query(
    `INSERT INTO platform_metrics (
       client_id, platform, metric_date, subscribers, total_posts, views, likes, comments, shares, engagement_rate, metadata
     ) VALUES ($1, 'instagram', $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (client_id, platform, metric_date) DO UPDATE SET
       subscribers = EXCLUDED.subscribers,
       total_posts = EXCLUDED.total_posts,
       views = EXCLUDED.views,
       likes = EXCLUDED.likes,
       comments = EXCLUDED.comments,
       shares = EXCLUDED.shares,
       engagement_rate = EXCLUDED.engagement_rate,
       metadata = EXCLUDED.metadata`,
    [
      clientId, today, metrics.followers, metrics.posts_count,
      metrics.total_views, metrics.total_likes, metrics.total_comments, metrics.total_shares,
      metrics.engagement_rate,
      JSON.stringify({
        following: metrics.following,
        recent_posts: metrics.recent_posts,
        bio: metrics.bio,
        profile_pic: metrics.profile_pic,
        is_verified: metrics.is_verified,
        fetched_at: metrics.fetched_at,
      }),
    ]
  );

  return { success: true, metrics };
});
