// Migrated from supabase/functions/sync-rss-to-library/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

interface SyncResult {
  total: number;
  created: number;
  updated: number;
  transcribed: number;
  errors: number;
  items: Array<{ id: string; title: string; status: string; hasTranscript?: boolean; error?: string }>;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...');
}

function parseAtomFeed(xml: string) {
  const items: Array<{ videoId: string; title: string; published: string; description: string; thumbnail: string }> = [];
  const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const e of entries) {
    const videoId = e.match(/<yt:videoId[^>]*>([\s\S]*?)<\/yt:videoId>/i)?.[1]?.trim() || '';
    const title = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
    const published = e.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]?.trim() || '';
    const description = e.match(/<media:description[^>]*>([\s\S]*?)<\/media:description>/i)?.[1]?.trim() || '';
    const thumbnail = e.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1] || '';
    if (videoId) items.push({ videoId, title: decodeHtmlEntities(title), published, description: decodeHtmlEntities(description), thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` });
  }
  return items;
}

function parseRSSFeed(xml: string) {
  const items: any[] = [];
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const itemXml of matches) {
    const title = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || '';
    const link = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || '';
    const description = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() || '';
    const pubDate = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || '';
    const guid = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() || link;
    const contentEncoded = itemXml.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i)?.[1]?.trim() || '';
    const allImages: string[] = [];
    const enclosure = itemXml.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i)?.[1];
    if (enclosure) allImages.push(enclosure);
    const mediaThumbnail = itemXml.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1];
    if (mediaThumbnail && !allImages.includes(mediaThumbnail)) allImages.push(mediaThumbnail);
    const mediaContent = itemXml.match(/<media:content[^>]*url="([^"]+)"[^>]*>/i)?.[1];
    if (mediaContent && !allImages.includes(mediaContent)) allImages.push(mediaContent);
    const rawContent = contentEncoded || description;
    for (const m of rawContent.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
      if (m[1] && !allImages.includes(m[1])) allImages.push(m[1]);
    }
    const cleanContent = (contentEncoded || description)
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<img[^>]*>/gi, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n').trim();
    items.push({
      guid, title: decodeHtmlEntities(title), link,
      description: decodeHtmlEntities(description.replace(/<[^>]+>/g, '').substring(0, 300)),
      pubDate, content: cleanContent, imageUrl: allImages[0], allImages,
    });
  }
  return items;
}

async function syncYouTube(clientId: string, channelId: string | undefined, rssUrl: string | undefined, mode: string, forceRetranscribe: boolean, limit: number, result: SyncResult, jwt: string, host: string) {
  let feedUrl = rssUrl;
  if (!feedUrl && channelId) feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  if (!feedUrl) {
    const cd = await queryOne<any>('SELECT social_media FROM clients WHERE id = $1', [clientId]);
    const savedChannelId = cd?.social_media?.youtube_channel_id;
    if (savedChannelId) feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${savedChannelId}`;
    else throw new Error('No YouTube channel configured');
  }
  const r = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Kaleidos/1.0)' } });
  if (!r.ok) throw new Error(`Failed to fetch YouTube RSS: ${r.status}`);
  const items = parseAtomFeed(await r.text());
  result.total = items.length;

  const pool = getPool();
  const existing = await pool.query(
    `SELECT id, content_url, content, metadata FROM client_content_library WHERE client_id = $1 AND content_type = 'video_script'`,
    [clientId]
  );
  const existingByUrl = new Map<string, any>();
  for (const e of existing.rows) if (e.content_url) existingByUrl.set(e.content_url, e);

  const toProcess = items.slice(0, limit);
  for (const item of toProcess) {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${item.videoId}`;
      const ex = existingByUrl.get(videoUrl);
      if (ex && mode === 'only_missing' && !forceRetranscribe) {
        result.items.push({ id: item.videoId, title: item.title, status: 'skipped', hasTranscript: !!(ex.content && ex.content.length > 100) });
        continue;
      }
      const needs = !ex || forceRetranscribe || !ex.content || ex.content.length < 100;
      let transcript = '';
      let hasTranscript = false;
      if (needs) {
        try {
          const er = await fetch(`${host}/api/extract-youtube`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
            body: JSON.stringify({ url: videoUrl }),
          });
          if (er.ok) {
            const ed = await er.json();
            transcript = ed.content || ed.transcript || '';
            hasTranscript = transcript.length > 0;
            if (hasTranscript) result.transcribed++;
          }
        } catch (e) {
          console.warn(`Transcript failed for ${item.videoId}:`, e);
        }
      } else {
        transcript = ex.content;
        hasTranscript = true;
      }
      const data = {
        client_id: clientId, title: item.title,
        content: transcript || `Vídeo: ${item.title}`,
        content_type: 'video_script', content_url: videoUrl,
        thumbnail_url: item.thumbnail || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
        metadata: { video_id: item.videoId, published_at: item.published, description: item.description, has_transcript: hasTranscript, synced_from_rss: true, source: 'rss_sync' },
      };
      if (ex) {
        await pool.query(
          `UPDATE client_content_library SET title=$1, content=$2, content_url=$3, thumbnail_url=$4, metadata=$5::jsonb, updated_at=NOW() WHERE id=$6`,
          [data.title, data.content, data.content_url, data.thumbnail_url, JSON.stringify(data.metadata), ex.id]
        );
        result.updated++;
        result.items.push({ id: item.videoId, title: item.title, status: 'updated', hasTranscript });
      } else {
        const ins = await pool.query(
          `INSERT INTO client_content_library (client_id, title, content, content_type, content_url, thumbnail_url, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING id`,
          [clientId, data.title, data.content, data.content_type, data.content_url, data.thumbnail_url, JSON.stringify(data.metadata)]
        );
        result.created++;
        await pool.query(
          `UPDATE youtube_videos SET transcript = $1, content_synced_at = NOW(), content_library_id = $2 WHERE client_id = $3 AND video_id = $4`,
          [transcript || null, ins.rows[0].id, clientId, item.videoId]
        );
        result.items.push({ id: item.videoId, title: item.title, status: 'created', hasTranscript });
      }
    } catch (err: any) {
      console.error(`Error processing video ${item.videoId}:`, err);
      result.errors++;
      result.items.push({ id: item.videoId, title: item.title, status: 'error', error: err.message });
    }
  }
}

async function syncNewsletter(clientId: string, rssUrl: string | undefined, mode: string, limit: number, result: SyncResult) {
  let feedUrl = rssUrl;
  if (!feedUrl) {
    const cd = await queryOne<any>('SELECT social_media FROM clients WHERE id = $1', [clientId]);
    feedUrl = cd?.social_media?.newsletter_rss;
    if (!feedUrl) throw new Error('No newsletter RSS configured');
  }
  const r = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Kaleidos/1.0)' } });
  if (!r.ok) throw new Error(`Failed to fetch Newsletter RSS: ${r.status}`);
  const items = parseRSSFeed(await r.text());
  result.total = items.length;
  const pool = getPool();
  const existing = await pool.query(
    `SELECT id, content_url, metadata FROM client_content_library WHERE client_id = $1 AND content_type = 'newsletter'`,
    [clientId]
  );
  const existingByUrl = new Map<string, any>();
  for (const e of existing.rows) {
    if (e.content_url) existingByUrl.set(e.content_url, e);
    const guid = e.metadata?.rss_guid;
    if (guid) existingByUrl.set(guid, e);
  }
  const toProcess = items.slice(0, limit);
  for (const item of toProcess) {
    try {
      const ex = existingByUrl.get(item.link) || existingByUrl.get(item.guid);
      if (ex && mode === 'only_missing') {
        result.items.push({ id: item.guid, title: item.title, status: 'skipped' });
        continue;
      }
      const thumbnail = item.imageUrl || item.allImages?.[0] || null;
      const data = {
        client_id: clientId, title: item.title,
        content: item.content || item.description || `Newsletter: ${item.title}`,
        content_type: 'newsletter', content_url: item.link || null, thumbnail_url: thumbnail,
        metadata: { rss_guid: item.guid, pub_date: item.pubDate, description: item.description, all_images: item.allImages, synced_from_rss: true, source: 'rss_sync' },
      };
      if (ex) {
        await pool.query(
          `UPDATE client_content_library SET title=$1, content=$2, content_url=$3, thumbnail_url=$4, metadata=$5::jsonb, updated_at=NOW() WHERE id=$6`,
          [data.title, data.content, data.content_url, data.thumbnail_url, JSON.stringify(data.metadata), ex.id]
        );
        result.updated++;
        result.items.push({ id: item.guid, title: item.title, status: 'updated' });
      } else {
        const ins = await pool.query(
          `INSERT INTO client_content_library (client_id, title, content, content_type, content_url, thumbnail_url, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING id`,
          [clientId, data.title, data.content, data.content_type, data.content_url, data.thumbnail_url, JSON.stringify(data.metadata)]
        );
        result.created++;
        const metricDate = item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : null;
        if (metricDate) {
          await pool.query(
            `UPDATE platform_metrics SET content_library_id = $1 WHERE client_id = $2 AND platform = 'newsletter' AND metric_date = $3`,
            [ins.rows[0].id, clientId, metricDate]
          );
        }
        result.items.push({ id: item.guid, title: item.title, status: 'created' });
      }
    } catch (err: any) {
      console.error(`Error processing newsletter ${item.guid}:`, err);
      result.errors++;
      result.items.push({ id: item.guid, title: item.title, status: 'error', error: err.message });
    }
  }
}

export default authedPost(async ({ body, req, user }) => {
  const { clientId, platform, rssUrl, channelId, mode = 'only_missing', forceRetranscribe = false, limit = 20 } = body;
  if (!clientId || !platform) throw new Error('clientId and platform are required');
  await assertClientAccess(user.id, clientId);

  console.log(`Syncing ${platform} RSS to library for client ${clientId}`);

  const result: SyncResult = { total: 0, created: 0, updated: 0, transcribed: 0, errors: 0, items: [] };
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const host = `https://${req.headers.host}`;

  if (platform === 'youtube') {
    await syncYouTube(clientId, channelId, rssUrl, mode, forceRetranscribe, limit, result, jwt, host);
  } else if (platform === 'newsletter') {
    await syncNewsletter(clientId, rssUrl, mode, limit, result);
  } else {
    throw new Error(`Unknown platform: ${platform}`);
  }

  console.log(`Sync complete: ${result.created} created, ${result.updated} updated, ${result.transcribed} transcribed, ${result.errors} errors`);
  return result;
});
