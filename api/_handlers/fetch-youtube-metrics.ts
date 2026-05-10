// Migrated from supabase/functions/fetch-youtube-metrics/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

export default authedPost(async ({ body, user }) => {
  const { clientId, channelId } = body;
  if (!clientId || !channelId) throw new Error('clientId and channelId are required');
  await assertClientAccess(user.id, clientId);

  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  if (!YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY not configured');

  let resolvedChannelId = channelId;
  if (channelId.startsWith('@') || (!channelId.startsWith('UC') && !channelId.startsWith('HC'))) {
    const handleParam = channelId.startsWith('@') ? channelId : `@${channelId}`;
    const hr = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handleParam}&key=${YOUTUBE_API_KEY}`);
    const hd = await hr.json();
    if (hd.items?.length) {
      resolvedChannelId = hd.items[0].id;
    } else {
      const ur = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${channelId.replace('@', '')}&key=${YOUTUBE_API_KEY}`);
      const ud = await ur.json();
      if (ud.items?.length) resolvedChannelId = ud.items[0].id;
    }
  }

  const cr = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&id=${resolvedChannelId}&key=${YOUTUBE_API_KEY}`);
  const cd = await cr.json();
  if (cd.error) throw new Error(`YouTube API error: ${cd.error.message}`);
  if (!cd.items?.length) throw new Error('Channel not found');

  const channel = cd.items[0];
  const channelStats = channel.statistics;
  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads || `UU${String(channelId).substring(2)}`;

  const allVideoIds: string[] = [];
  let nextPageToken: string | undefined;
  do {
    const pageParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
    const pr = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}${pageParam}`);
    const pd = await pr.json();
    if (!pd.items) break;
    allVideoIds.push(...pd.items.map((i: any) => i.contentDetails.videoId));
    nextPageToken = pd.nextPageToken;
  } while (nextPageToken && allVideoIds.length < 200);

  const pool = getPool();
  const today = new Date().toISOString().split('T')[0];

  if (allVideoIds.length === 0) {
    await pool.query(
      `INSERT INTO platform_metrics (client_id, platform, metric_date, subscribers, views, total_posts, metadata)
       VALUES ($1,'youtube',$2,$3,$4,$5,$6::jsonb)
       ON CONFLICT (client_id, platform, metric_date) DO UPDATE SET
         subscribers = EXCLUDED.subscribers, views = EXCLUDED.views, total_posts = EXCLUDED.total_posts, metadata = EXCLUDED.metadata`,
      [
        clientId, today,
        parseInt(channelStats.subscriberCount || '0'),
        parseInt(channelStats.viewCount || '0'),
        parseInt(channelStats.videoCount || '0'),
        JSON.stringify({ channel_id: channelId, channel_title: channel.snippet.title }),
      ]
    );
    return { success: true, videosUpdated: 0, channelStats };
  }

  const allVideos: any[] = [];
  for (let i = 0; i < allVideoIds.length; i += 50) {
    const batch = allVideoIds.slice(i, i + 50);
    const vr = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${batch.join(',')}&key=${YOUTUBE_API_KEY}`);
    const vd = await vr.json();
    if (vd.items) allVideos.push(...vd.items);
  }

  for (const video of allVideos) {
    const duration = video.contentDetails.duration;
    const m = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const hours = parseInt(m?.[1] || '0');
    const minutes = parseInt(m?.[2] || '0');
    const seconds = parseInt(m?.[3] || '0');
    const durationSeconds = hours * 3600 + minutes * 60 + seconds;
    await pool.query(
      `INSERT INTO youtube_videos (
         client_id, video_id, title, published_at, duration_seconds,
         total_views, likes, comments, watch_hours, subscribers_gained,
         impressions, click_rate, thumbnail_url, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
       ON CONFLICT (client_id, video_id) DO UPDATE SET
         title = EXCLUDED.title, total_views = EXCLUDED.total_views,
         likes = EXCLUDED.likes, comments = EXCLUDED.comments, metadata = EXCLUDED.metadata`,
      [
        clientId, video.id, video.snippet.title, video.snippet.publishedAt, durationSeconds,
        parseInt(video.statistics.viewCount || '0'), parseInt(video.statistics.likeCount || '0'),
        parseInt(video.statistics.commentCount || '0'), 0, 0, 0, 0,
        video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
        JSON.stringify({ description: video.snippet.description?.substring(0, 500) }),
      ]
    );
  }

  await pool.query(
    `INSERT INTO platform_metrics (client_id, platform, metric_date, subscribers, views, total_posts, metadata)
     VALUES ($1,'youtube',$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT (client_id, platform, metric_date) DO UPDATE SET
       subscribers = EXCLUDED.subscribers, views = EXCLUDED.views, total_posts = EXCLUDED.total_posts, metadata = EXCLUDED.metadata`,
    [
      clientId, today,
      parseInt(channelStats.subscriberCount || '0'),
      parseInt(channelStats.viewCount || '0'),
      parseInt(channelStats.videoCount || '0'),
      JSON.stringify({ channel_id: channelId, channel_title: channel.snippet.title }),
    ]
  );

  return {
    success: true,
    videosUpdated: allVideos.length,
    channelStats: {
      subscribers: channelStats.subscriberCount,
      totalViews: channelStats.viewCount,
      videoCount: channelStats.videoCount,
    },
  };
});
