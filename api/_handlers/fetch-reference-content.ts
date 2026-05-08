// Migrated from supabase/functions/fetch-reference-content/index.ts
import { authedPost } from '../_lib/handler.js';

interface ReferenceResult {
  success: boolean;
  title?: string;
  content?: string;
  markdown?: string;
  type?: 'youtube' | 'article' | 'html' | 'newsletter';
  thumbnail?: string;
  images?: string[];
  error?: string;
}

function isYoutubeUrl(url: string) {
  return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('ytimg.com');
}

function extractYoutubeVideoId(url: string): string | null {
  const tm = url.match(/ytimg\.com\/(?:an_webp|vi|vi_webp)\/([^\/]+)/);
  if (tm) return tm[1];
  const wm = url.match(/youtube\.com\/watch\?v=([^&]+)/);
  if (wm) return wm[1];
  const sm = url.match(/youtu\.be\/([^?]+)/);
  if (sm) return sm[1];
  const em = url.match(/youtube\.com\/embed\/([^?]+)/);
  if (em) return em[1];
  return null;
}

function processHtml(html: string): ReferenceResult {
  let content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = titleMatch?.[1] || h1Match?.[1] || 'Newsletter Content';
  const images: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const u = m[1];
    if (!u.includes('pixel') && !u.includes('1x1') && !u.startsWith('data:')) images.push(u);
  }
  return { success: true, title: title.trim(), content, type: 'newsletter', images };
}

async function fetchWithFirecrawl(url: string): Promise<ReferenceResult | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  try {
    const r = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown', 'html'], onlyMainContent: true }),
    });
    if (!r.ok) return null;
    const result = await r.json();
    const data = result.data || result;
    const meta = data.metadata || {};
    const images: string[] = [];
    if (meta.ogImage) images.push(meta.ogImage);
    const html = data.html || '';
    const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      let u = m[1];
      if (u.includes('pixel') || u.includes('1x1') || u.startsWith('data:')) continue;
      if (u.startsWith('//')) u = 'https:' + u;
      else if (u.startsWith('/')) {
        try { u = new URL(url).origin + u; } catch { continue; }
      }
      if (u.startsWith('http') && !images.includes(u)) images.push(u);
    }
    return {
      success: true,
      title: meta.title || 'Article',
      content: data.markdown || '',
      markdown: data.markdown || '',
      type: 'article',
      thumbnail: meta.ogImage || images[0],
      images,
    };
  } catch (e) {
    console.error('[fetch-reference-content] Firecrawl error:', e);
    return null;
  }
}

async function fetchYoutubeContent(url: string, jwt: string, host: string): Promise<ReferenceResult> {
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) return { success: false, error: 'Could not extract YouTube video ID from URL' };
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const r = await fetch(`${host}/api/extract-youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ url: videoUrl }),
    });
    if (!r.ok) return { success: false, error: 'Failed to extract YouTube content' };
    const data = await r.json();
    const thumbnail = data.thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    return {
      success: true,
      title: data.title || 'YouTube Video',
      content: data.content || data.transcript || '',
      type: 'youtube',
      thumbnail,
      images: thumbnail ? [thumbnail] : [],
    };
  } catch {
    return { success: false, error: 'Failed to fetch YouTube content' };
  }
}

async function fetchArticleContent(url: string): Promise<ReferenceResult> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Kaleidos/1.0)' } });
    if (!r.ok) return { success: false, error: `Failed to fetch URL: ${r.status}` };
    const html = await r.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const title = ogTitleMatch?.[1] || titleMatch?.[1] || 'Article';
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    const thumbnail = ogImageMatch?.[1] || null;
    const images: string[] = [];
    if (thumbnail) images.push(thumbnail);
    const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      let u = m[1];
      if (u.startsWith('//')) u = 'https:' + u;
      else if (u.startsWith('/')) { try { u = new URL(url).origin + u; } catch { continue; } }
      if (!u.includes('1x1') && !u.includes('pixel') && !u.includes('.svg') && !u.includes('data:image') && u.startsWith('http') && !images.includes(u)) images.push(u);
    }
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const raw = articleMatch?.[1] || mainMatch?.[1] || html;
    let content = raw
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
    if (content.length > 100000) content = content.substring(0, 100000) + '...';
    return { success: true, title: title.trim(), content, type: 'article', thumbnail: thumbnail || undefined, images };
  } catch (e) {
    console.error('[fetch-reference-content] Article fetch error:', e);
    return { success: false, error: 'Failed to fetch article content' };
  }
}

export default authedPost(async ({ body, req }) => {
  const { url, html } = body;
  let result: ReferenceResult;
  if (html) {
    result = processHtml(html);
  } else if (url) {
    if (isYoutubeUrl(url)) {
      const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const host = `https://${req.headers.host}`;
      result = await fetchYoutubeContent(url, jwt, host);
    } else {
      result = (await fetchWithFirecrawl(url)) || (await fetchArticleContent(url));
    }
  } else {
    throw new Error('URL or HTML required');
  }
  return result;
});
