// Migrated from supabase/functions/google-trends-br/index.ts
import { anonPost } from '../_lib/handler.js';
import { cacheViralSearch } from '../_lib/shared/viral-cache.js';

const FEED = 'https://trends.google.com/trending/rss?geo=BR';

export default anonPost(async ({ user, body }) => {
  const r = await fetch(FEED, { headers: { 'User-Agent': 'Mozilla/5.0 kAI-Trends' } });
  if (!r.ok) throw new Error(`Trends HTTP ${r.status}`);
  const xml = await r.text();
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const items = blocks.slice(0, 30).map((b) => {
    const get = (re: RegExp) => (b.match(re)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    return {
      title: get(/<title>([\s\S]*?)<\/title>/i),
      traffic: get(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/i),
      pubDate: get(/<pubDate>([\s\S]*?)<\/pubDate>/i),
      picture: get(/<ht:picture>([\s\S]*?)<\/ht:picture>/i),
      link: get(/<link>([\s\S]*?)<\/link>/i),
    };
  });

  await cacheViralSearch({
    workspaceId: body?.workspaceId,
    clientId: body?.clientId,
    source: 'trends',
    query: 'google-trends-br',
    items,
    filters: { geo: 'BR' },
    userId: user?.id ?? null,
  });

  return { items };
});
