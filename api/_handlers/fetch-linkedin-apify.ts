// Migrated from supabase/functions/fetch-linkedin-apify/index.ts
// Scrapes LinkedIn profile / company via Apify and upserts platform_metrics.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool } from '../_lib/db.js';
import { tryAuth, type AuthUser } from '../_lib/auth.js';
import { assertClientAccess } from '../_lib/access.js';
import { isValidCronCall } from '../_lib/cron-auth.js';

function detectLinkedInTarget(input: string): { url: string; type: 'person' | 'company' } {
  const cleaned = input.trim();
  let url = cleaned;
  if (!/^https?:\/\//i.test(cleaned)) {
    url = `https://www.linkedin.com/in/${cleaned.replace(/^@/, '')}`;
  }
  const type: 'person' | 'company' = /linkedin\.com\/(company|school)\//i.test(url)
    ? 'company'
    : 'person';
  return { url, type };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  // Auth: cron (Bearer CRON_SECRET) OR authed user.
  // Header `x-vercel-cron` standalone NÃO é confiável.
  const isCron = isValidCronCall(req);
  let authedUser: AuthUser | null = null;
  if (!isCron) {
    authedUser = await tryAuth(req);
    if (!authedUser) return jsonError(res, 401, 'Unauthorized');
  }

  const startedAt = Date.now();
  try {
    const body =
      req.body && typeof req.body === 'object'
        ? req.body
        : req.body
        ? JSON.parse(req.body)
        : {};
    const { clientId, handle } = body as { clientId?: string; handle?: string };
    if (!clientId || !handle) throw new Error('clientId and handle are required');
    if (authedUser && clientId) await assertClientAccess(authedUser.id, clientId);

    const apifyApiKey = process.env.APIFY_API_KEY || process.env.APIFY_API_TOKEN;
    if (!apifyApiKey) throw new Error('APIFY_API_KEY not configured');

    const { url, type } = detectLinkedInTarget(handle);
    console.log(`[fetch-linkedin-apify] ${type}: ${url}`);

    const actorId =
      type === 'company'
        ? 'apimaestro~linkedin-company-detail'
        : 'harvestapi~linkedin-profile-scraper';
    const input: Record<string, unknown> =
      type === 'company' ? { companyUrls: [url] } : { profileUrls: [url], maxItems: 1 };

    const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyApiKey}&timeout=120`;
    const apifyResponse = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('[fetch-linkedin-apify] apify error:', errorText);
      if (apifyResponse.status === 429 || apifyResponse.status === 402) {
        return res.status(200).json({
          success: false,
          error: 'Apify rate limit / payment required',
          retryable: true,
        });
      }
      throw new Error(`Apify request failed: ${apifyResponse.status}`);
    }
    const items = await apifyResponse.json();
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No data returned from Apify LinkedIn scraper');
    }
    const data = items[0];
    const followers = data.followersCount || data.followers || data.connectionsCount || 0;
    const headline = data.headline || data.tagline || data.description;

    const today = new Date().toISOString().split('T')[0];
    const metadata = {
      target_type: type,
      url,
      headline,
      name: data.fullName || data.name,
      verified: data.verified || false,
      fetched_at: new Date().toISOString(),
      raw_keys: Object.keys(data).slice(0, 30),
    };

    await getPool().query(
      `INSERT INTO platform_metrics
        (client_id, platform, metric_date, subscribers, total_posts, metadata)
       VALUES ($1, 'linkedin', $2, $3, $4, $5::jsonb)
       ON CONFLICT (client_id, platform, metric_date) DO UPDATE
         SET subscribers = EXCLUDED.subscribers,
             total_posts = EXCLUDED.total_posts,
             metadata = EXCLUDED.metadata`,
      [clientId, today, followers, data.postsCount || null, JSON.stringify(metadata)],
    );

    return res.status(200).json({
      success: true,
      duration_ms: Date.now() - startedAt,
      items_synced: 1,
      estimated_cost_usd: 0.02,
    });
  } catch (err: any) {
    console.error('[fetch-linkedin-apify] error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      duration_ms: Date.now() - startedAt,
    });
  }
}
