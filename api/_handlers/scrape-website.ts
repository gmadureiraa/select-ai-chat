// Migrated from supabase/functions/scrape-website/index.ts
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import { assertSafeUrl } from '../_lib/url-guard.js';

const BodySchema = z.object({
  url: z.string().url('URL must be a valid http(s) URL'),
  clientId: z.string().min(1, 'clientId is required'),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Invalid input: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    );
  }
  const { url, clientId } = parsed.data;
  await assertClientAccess(user.id, clientId);
  // SSRF guard: bloqueia IPs privados, cloud metadata, DB ports.
  await assertSafeUrl(url);

  console.log('Scraping website:', url);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KaleidosBot/1.0)' },
  });
  if (!response.ok) throw new Error(`Failed to fetch website: ${response.statusText}`);
  const html = await response.text();

  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : url;
  const markdown = `# ${title}\n\nURL: ${url}\n\n${textContent.substring(0, 5000)}...`;

  // Upsert client_websites
  const pool = getPool();
  const rows = await pool.query(
    `INSERT INTO client_websites (client_id, url, scraped_content, scraped_markdown, last_scraped_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (client_id, url)
     DO UPDATE SET scraped_content = EXCLUDED.scraped_content,
                   scraped_markdown = EXCLUDED.scraped_markdown,
                   last_scraped_at = NOW()
     RETURNING *`,
    [clientId, url, textContent.substring(0, 10000), markdown]
  );
  const data = rows.rows[0];
  console.log('Website scraped successfully:', data.id);
  return { success: true, data };
});
