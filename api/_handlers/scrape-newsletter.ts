// Migrated from supabase/functions/scrape-newsletter/index.ts
import { anonPost } from '../_lib/handler.js';

interface NewsletterImage {
  url: string;
  alt?: string;
}
interface Heading {
  tag: string;
  text: string;
}
interface CarouselSlide {
  slideNumber: number;
  type: 'hook' | 'bridge' | 'content' | 'cta';
  text: string;
  imageUrl?: string;
  heading?: string;
}
interface NewsletterData {
  title: string;
  url: string;
  content: string;
  markdown?: string;
  images: NewsletterImage[];
  headings: Heading[];
  highlights: string[];
  paragraphs: string[];
  carouselSlides: CarouselSlide[];
  stats: {
    imageCount: number;
    paragraphCount: number;
    headingCount: number;
    contentLength: number;
  };
}

function buildCarouselSlides(
  title: string,
  headings: Heading[],
  paragraphs: string[],
  highlights: string[],
  images: NewsletterImage[]
): CarouselSlide[] {
  const slides: CarouselSlide[] = [];

  const hookText = headings[0]?.text || highlights[0] || paragraphs[0]?.substring(0, 150) || title;
  slides.push({
    slideNumber: 1,
    type: 'hook',
    text: hookText,
    imageUrl: images[0]?.url,
    heading: 'GANCHO',
  });

  const bridgeText = paragraphs[0] || headings[1]?.text || 'Contexto da newsletter';
  slides.push({
    slideNumber: 2,
    type: 'bridge',
    text: bridgeText.substring(0, 300),
    imageUrl: images[1]?.url,
    heading: 'PONTE',
  });

  const contentParagraphs = paragraphs.slice(1, 5);
  contentParagraphs.forEach((para, idx) => {
    slides.push({
      slideNumber: idx + 3,
      type: 'content',
      text: para.substring(0, 350),
      imageUrl: images[idx + 2]?.url,
      heading: headings[idx + 1]?.text,
    });
  });

  while (slides.length < 6 && paragraphs.length > slides.length - 2) {
    const idx = slides.length - 2;
    slides.push({
      slideNumber: slides.length + 1,
      type: 'content',
      text: paragraphs[idx]?.substring(0, 350) || '',
      imageUrl: images[slides.length]?.url,
    });
  }

  const ctaText = paragraphs[paragraphs.length - 1] || 'Acesse o conteúdo completo no link original.';
  slides.push({
    slideNumber: slides.length + 1,
    type: 'cta',
    text: ctaText.substring(0, 200),
    heading: 'CTA',
  });

  return slides;
}

async function scrapeWithFirecrawl(url: string): Promise<NewsletterData | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  try {
    const r = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html', 'links'],
        onlyMainContent: false,
        waitFor: 2000,
      }),
    });
    if (!r.ok) {
      console.error('[scrape-newsletter] Firecrawl error:', r.status);
      return null;
    }
    const result = await r.json();
    const data = result.data || result;
    const markdown = data.markdown || '';
    const html = data.html || '';
    const metadata = data.metadata || {};

    const images: NewsletterImage[] = [];
    const imgPatterns = [
      /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi,
      /<img[^>]+alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi,
      /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
      /<source[^>]+srcset=["']([^"'\s]+)/gi,
    ];

    for (const pattern of imgPatterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(html)) !== null) {
        let imgUrl = m[1];
        const alt = m[2] || undefined;
        if (
          imgUrl.includes('tracking') ||
          imgUrl.includes('pixel') ||
          imgUrl.includes('1x1') ||
          imgUrl.includes('spacer') ||
          imgUrl.includes('beacon') ||
          imgUrl.length < 15
        ) {
          continue;
        }
        if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
        else if (imgUrl.startsWith('/')) {
          try {
            const u = new URL(url);
            imgUrl = u.origin + imgUrl;
          } catch {
            continue;
          }
        }
        if (!imgUrl.startsWith('data:') && imgUrl.length > 20) {
          if (!images.some((x) => x.url === imgUrl)) images.push({ url: imgUrl, alt });
        }
      }
    }

    const headings: Heading[] = [];
    const headingMatches = markdown.matchAll(/^(#{1,3})\s+(.+)$/gm);
    for (const mm of headingMatches as IterableIterator<RegExpMatchArray>) {
      const level = mm[1].length;
      headings.push({ tag: `h${level}`, text: mm[2].trim() });
    }

    const paragraphs: string[] = markdown
      .split(/\n\n+/)
      .map((p: string) => p.replace(/^#+\s+/, '').trim())
      .filter((p: string) => p.length > 30 && !p.startsWith('![') && !p.startsWith('http'));

    const highlights: string[] = [];
    const boldMatches = markdown.matchAll(/\*\*([^*]+)\*\*/g);
    for (const mm of boldMatches as IterableIterator<RegExpMatchArray>) {
      if (mm[1].length > 20 && mm[1].length < 300) highlights.push(mm[1]);
    }

    const carouselSlides = buildCarouselSlides(
      metadata.title || 'Newsletter',
      headings,
      paragraphs,
      highlights,
      images
    );

    return {
      title: metadata.title || 'Newsletter',
      url,
      content: markdown,
      markdown,
      images,
      headings,
      highlights,
      paragraphs,
      carouselSlides,
      stats: {
        imageCount: images.length,
        paragraphCount: paragraphs.length,
        headingCount: headings.length,
        contentLength: markdown.length,
      },
    };
  } catch (err) {
    console.error('[scrape-newsletter] Firecrawl exception:', err);
    return null;
  }
}

async function scrapeWithRegex(url: string): Promise<NewsletterData> {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!r.ok) throw new Error(`Failed to fetch newsletter: ${r.statusText}`);
  const html = await r.text();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const title = ogTitleMatch?.[1] || titleMatch?.[1]?.trim() || 'Newsletter';

  const images: NewsletterImage[] = [];
  const imgPatterns = [
    /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
    /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi,
    /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
  ];
  for (const pattern of imgPatterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
      let imgUrl = m[1];
      if (imgUrl.includes('tracking') || imgUrl.includes('pixel') || imgUrl.includes('1x1')) continue;
      if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
      else if (imgUrl.startsWith('/')) {
        try {
          const u = new URL(url);
          imgUrl = u.origin + imgUrl;
        } catch {
          continue;
        }
      }
      if (!imgUrl.startsWith('data:') && imgUrl.length > 20) {
        if (!images.some((x) => x.url === imgUrl)) images.push({ url: imgUrl });
      }
    }
  }

  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');

  const headings: Heading[] = [];
  const headingRegex = /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = headingRegex.exec(cleanHtml)) !== null) {
    const text = hm[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length > 3 && text.length < 200) headings.push({ tag: hm[1], text });
  }

  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pRegex.exec(cleanHtml)) !== null) {
    const text = pm[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 30) paragraphs.push(text);
  }

  const highlights: string[] = [];
  const quoteRegex = /<(?:blockquote|strong|b)[^>]*>([\s\S]*?)<\/(?:blockquote|strong|b)>/gi;
  let qm: RegExpExecArray | null;
  while ((qm = quoteRegex.exec(cleanHtml)) !== null) {
    const text = qm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length > 20 && text.length < 300) highlights.push(text);
  }

  const content = paragraphs.join('\n\n');
  const carouselSlides = buildCarouselSlides(title, headings, paragraphs, highlights, images);

  return {
    title,
    url,
    content,
    images,
    headings,
    highlights,
    paragraphs,
    carouselSlides,
    stats: {
      imageCount: images.length,
      paragraphCount: paragraphs.length,
      headingCount: headings.length,
      contentLength: content.length,
    },
  };
}

export default anonPost(async ({ body }) => {
  const { url } = body || {};
  if (!url) throw new Error('URL is required');

  console.log('[scrape-newsletter] Processing:', url);

  let data = await scrapeWithFirecrawl(url);
  if (!data) data = await scrapeWithRegex(url);

  return { success: true, data };
});
