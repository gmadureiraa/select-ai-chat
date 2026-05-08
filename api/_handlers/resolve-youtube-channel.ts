// Migrated from supabase/functions/resolve-youtube-channel/index.ts
import { anonPost } from '../_lib/handler.js';

export default anonPost(async ({ body }) => {
  const handle = body?.handle;
  if (!handle) throw new Error('Handle is required');
  const cleanHandle = String(handle).replace(/^@/, '').trim();
  console.log(`[resolve-youtube-channel] @${cleanHandle}`);

  const r = await fetch(`https://www.youtube.com/@${cleanHandle}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });
  if (!r.ok) throw new Error(`Channel not found: ${r.status}`);
  const html = await r.text();

  const patterns = [
    /"channelId":"(UC[\w-]{22})"/,
    /youtube\.com\/channel\/(UC[\w-]{22})/,
    /itemprop="channelId"\s+content="(UC[\w-]{22})"/,
    /"externalId":"(UC[\w-]{22})"/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return { channelId: m[1], handle: cleanHandle };
  }
  throw new Error('Could not extract channel ID from page');
});
