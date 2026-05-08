// Migrated from supabase/functions/update-newsletter-covers/index.ts
// Walks newsletters in client_content_library without thumbnail_url and tries
// to backfill them by (1) extracting first markdown image from content, then
// (2) scraping og:image from the source URL.
import { authedPost } from '../_lib/handler.js';
import { query, getPool } from '../_lib/db.js';

interface NewsletterRow {
  id: string;
  title: string;
  content_url: string | null;
  content: string | null;
}

interface UpdateItem {
  id: string;
  title: string;
  status: 'updated' | 'failed' | 'no_url' | 'no_image_found';
  thumbnail_url?: string;
  error?: string;
}

interface UpdateResult {
  total: number;
  updated: number;
  failed: number;
  items: UpdateItem[];
}

async function scrapeOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Kaleidos/1.0; +https://kaleidos.app)',
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const ogImageMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    return ogImageMatch?.[1] ?? null;
  } catch (err) {
    console.warn(`[update-newsletter-covers] scrape failed for ${url}:`, err);
    return null;
  }
}

export default authedPost(async ({ body }) => {
  const { clientId, limit = 50 } = body as { clientId?: string; limit?: number };
  if (!clientId) throw new Error('clientId is required');

  console.log(`[update-newsletter-covers] starting for client ${clientId}`);

  const newsletters = await query<NewsletterRow>(
    `SELECT id, title, content_url, content
       FROM client_content_library
      WHERE client_id = $1
        AND content_type = 'newsletter'
        AND thumbnail_url IS NULL
      LIMIT $2`,
    [clientId, Math.min(limit, 200)]
  );

  const result: UpdateResult = {
    total: newsletters.length,
    updated: 0,
    failed: 0,
    items: [],
  };

  console.log(`[update-newsletter-covers] found ${result.total} newsletters without covers`);

  const pool = getPool();

  for (const newsletter of newsletters) {
    try {
      // 1. try markdown image inside content
      let thumbnailUrl: string | null = null;
      const markdownImageMatch = newsletter.content?.match(
        /!\[.*?\]\((https?:\/\/[^\)]+)\)/
      );
      thumbnailUrl = markdownImageMatch?.[1] ?? null;

      // 2. fallback to scraping og:image
      if (!thumbnailUrl && newsletter.content_url) {
        console.log(
          `[update-newsletter-covers] scraping og:image from ${newsletter.content_url}`
        );
        thumbnailUrl = await scrapeOgImage(newsletter.content_url);
      }

      if (thumbnailUrl) {
        await pool.query(
          `UPDATE client_content_library
              SET thumbnail_url = $1, updated_at = now()
            WHERE id = $2`,
          [thumbnailUrl, newsletter.id]
        );
        result.updated++;
        result.items.push({
          id: newsletter.id,
          title: newsletter.title,
          status: 'updated',
          thumbnail_url: thumbnailUrl,
        });
      } else {
        result.items.push({
          id: newsletter.id,
          title: newsletter.title,
          status: newsletter.content_url ? 'no_image_found' : 'no_url',
        });
      }
    } catch (err) {
      console.error(`[update-newsletter-covers] error on ${newsletter.id}:`, err);
      result.failed++;
      result.items.push({
        id: newsletter.id,
        title: newsletter.title,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  console.log(
    `[update-newsletter-covers] done: ${result.updated} updated, ${result.failed} failed`
  );

  return result;
});
