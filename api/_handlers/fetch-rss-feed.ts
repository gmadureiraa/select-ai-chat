// Migrated from supabase/functions/fetch-rss-feed/index.ts
import { anonPost } from '../_lib/handler.js';

interface RSSItem {
  guid: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  content: string;
  imageUrl?: string;
  allImages?: string[];
}

function parseAtomFeed(xml: string): { title: string; items: RSSItem[] } {
  const feedTitle = xml.match(/<feed[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || 'YouTube Feed';
  const items: RSSItem[] = [];
  const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const e of entries) {
    const videoId = e.match(/<yt:videoId[^>]*>([\s\S]*?)<\/yt:videoId>/i)?.[1]?.trim() || '';
    const title = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
    const published = e.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]?.trim() || '';
    const updated = e.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]?.trim() || '';
    const description = e.match(/<media:description[^>]*>([\s\S]*?)<\/media:description>/i)?.[1]?.trim() || '';
    const thumbnail = e.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1] || '';
    const link = e.match(/<link[^>]*href="([^"]+)"/i)?.[1] || '';
    const cleanDescription = description
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").substring(0, 300);
    items.push({
      guid: videoId ? `yt:video:${videoId}` : link,
      title,
      link: link || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''),
      description: cleanDescription,
      pubDate: published || updated,
      content: description,
      imageUrl: thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''),
      allImages: thumbnail ? [thumbnail] : (videoId ? [`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`] : []),
    });
  }
  return { title: feedTitle, items };
}

function parseRSSFeed(xml: string): { title: string; items: RSSItem[] } {
  const isAtom = xml.includes('<feed') && xml.includes('<entry');
  if (isAtom) return parseAtomFeed(xml);

  const channelTitle = xml.match(/<channel>[\s\S]*?<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || 'RSS Feed';
  const items: RSSItem[] = [];
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const itemXml of matches) {
    const title = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || '';
    const link = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || '';
    const description = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() || '';
    const pubDate = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || '';
    const guid = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() || link;
    const contentEncoded = itemXml.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i)?.[1]?.trim() || '';

    let imageUrl = '';
    const mediaContent = itemXml.match(/<media:content[^>]*url="([^"]+)"[^>]*>/i)?.[1];
    const enclosure = itemXml.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image[^"]*"/i)?.[1];
    const imgTag = (contentEncoded || description).match(/<img[^>]*src="([^"]+)"[^>]*>/i)?.[1];
    imageUrl = mediaContent || enclosure || imgTag || '';

    const allImages: string[] = [];
    const rawContent = contentEncoded || description;
    for (const m of rawContent.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
      if (m[1] && !allImages.includes(m[1])) allImages.push(m[1]);
    }
    for (const m of rawContent.matchAll(/data-src=["']([^"']+)["']/gi)) {
      if (m[1] && !allImages.includes(m[1])) allImages.push(m[1]);
    }

    const cleanDescription = description.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").substring(0, 300);

    const content = (contentEncoded || description)
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<figure[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<figcaption[^>]*>([\s\S]*?)<\/figcaption>[\s\S]*?<\/figure>/gi, '\n\n![$2]($1)\n\n')
      .replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '\n\n![$2]($1)\n\n')
      .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi, '\n\n![$1]($2)\n\n')
      .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, '\n\n![]($1)\n\n')
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
      .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n\n#### $1\n\n')
      .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n\n> $1\n\n')
      .replace(/<hr[^>]*>/gi, '\n\n---\n\n')
      .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n').replace(/<br\s*\/?>/gi, '  \n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n').replace(/<\/p>/gi, '\n\n').replace(/<p[^>]*>/gi, '')
      .replace(/<\/div>\s*<div[^>]*>/gi, '\n\n').replace(/<div[^>]*>/gi, '\n').replace(/<\/div>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ').replace(/<\/li>/gi, '\n').replace(/<\/?[ou]l[^>]*>/gi, '\n')
      .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**').replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*').replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`').replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n\n```\n$1\n```\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
      .replace(/&hellip;/g, '...').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();

    const finalImageUrl = imageUrl || allImages[0] || '';
    items.push({ guid, title, link, description: cleanDescription, pubDate, content, imageUrl: finalImageUrl, allImages });
  }
  return { title: channelTitle, items };
}

export default anonPost(async ({ body }) => {
  const { rssUrl, limit = 20 } = body;
  if (!rssUrl) throw new Error('RSS URL is required');
  console.log(`Fetching RSS feed: ${rssUrl}`);
  const r = await fetch(rssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Kaleidos/1.0; +https://kaleidos.app)',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
  });
  if (!r.ok) throw new Error(`Failed to fetch RSS: ${r.status} ${r.statusText}`);
  const xml = await r.text();
  const { title: feedTitle, items } = parseRSSFeed(xml);
  console.log(`Parsed ${items.length} items from feed "${feedTitle}"`);
  return { success: true, feedTitle, items: items.slice(0, limit), totalItems: items.length };
});
