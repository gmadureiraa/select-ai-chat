// Migrated from supabase/functions/firecrawl-scrape/index.ts
import { anonPost } from '../_lib/handler.js';

export default anonPost(async ({ body }) => {
  const { url, options } = body;
  if (!url) throw new Error('URL is required');

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('Firecrawl not configured');

  let formattedUrl = String(url).trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }

  const r = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: formattedUrl,
      formats: options?.formats || ['markdown', 'html', 'links'],
      onlyMainContent: options?.onlyMainContent ?? true,
      waitFor: options?.waitFor,
      location: options?.location,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `Firecrawl request failed: ${r.status}`);

  const images: string[] = [];
  const htmlContent = data.data?.html || data.html || '';

  if (htmlContent) {
    const imgPatterns = [
      /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
      /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi,
      /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
      /<source[^>]+srcset=["']([^"'\s]+)/gi,
    ];
    for (const pattern of imgPatterns) {
      let m;
      while ((m = pattern.exec(htmlContent)) !== null) {
        let imgUrl = m[1];
        if (
          imgUrl.includes('tracking') || imgUrl.includes('pixel') || imgUrl.includes('1x1') ||
          imgUrl.includes('spacer') || imgUrl.includes('blank.gif') || imgUrl.includes('beacon') ||
          imgUrl.length < 15
        ) continue;
        if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
        else if (imgUrl.startsWith('/')) {
          try {
            const u = new URL(formattedUrl);
            imgUrl = u.origin + imgUrl;
          } catch { continue; }
        } else if (!imgUrl.startsWith('http') && !imgUrl.startsWith('data:')) {
          try {
            const u = new URL(formattedUrl);
            const parts = u.pathname.split('/');
            parts.pop();
            imgUrl = u.origin + parts.join('/') + '/' + imgUrl;
          } catch { continue; }
        }
        if (!imgUrl.startsWith('data:') && imgUrl.length > 20 && !images.includes(imgUrl)) {
          images.push(imgUrl);
        }
      }
    }
  }

  const metadata = data.data?.metadata || data.metadata || {};
  if (metadata.ogImage && !images.includes(metadata.ogImage)) images.unshift(metadata.ogImage);

  return {
    success: true,
    data: {
      markdown: data.data?.markdown || data.markdown || '',
      html: data.data?.html || data.html || '',
      links: data.data?.links || data.links || [],
      images,
      metadata: {
        title: metadata.title || '',
        description: metadata.description || '',
        ogImage: metadata.ogImage || '',
        sourceURL: metadata.sourceURL || formattedUrl,
        statusCode: metadata.statusCode || 200,
      },
    },
  };
});
