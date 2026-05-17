// Cron handler: scrape RSS news sources into viral_news_articles.
// Schedule (Pro plan): every 6h. Reads viral_tracked_sources where source_type='rss'.
// Auth: x-vercel-cron header OR Authorization: Bearer $CRON_SECRET.
//
// Pipeline:
//  1. SELECT all active RSS sources from viral_tracked_sources
//  2. For each source: fetch RSS, parse items, UPSERT into viral_news_articles by url
//  3. UPDATE last_scraped_at on the source
//
// Adapted from radar-viral v1 (refresh.ts) — uses rss2json fallback when raw XML
// parsing fails.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { query } from '../_lib/db.js';
import { assertCronAuth } from '../_lib/cron-auth.js';

interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  thumbnail?: string;
}

interface TrackedSource {
  id: string;
  source_url: string;
  source_name: string | null;
  category: string | null;
  niche: string | null;
}

interface SourceResult {
  source_id: string;
  source_name: string;
  inserted: number;
  status: string;
  duration_ms: number;
}

// ─── HTML strip ─────────────────────────────────────────────────────
function stripHtml(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim()
    .slice(0, 1000);
}

// ─── XML/RSS parsing ────────────────────────────────────────────────
// Best-effort regex parser for the most common RSS 2.0 / Atom shapes.
function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ||
                     xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ||
                     [];
  for (const block of itemBlocks) {
    const title = stripHtml(
      (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
        .replace(/<!\[CDATA\[|\]\]>/g, ''),
    );
    const link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ||
                  block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ||
                  '').trim();
    const description = stripHtml(
      (block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ||
       block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ||
       block.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ||
       '').replace(/<!\[CDATA\[|\]\]>/g, ''),
    );
    const pubDate =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ||
      block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]?.trim() ||
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]?.trim() ||
      undefined;
    const thumbnail =
      block.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1] ||
      block.match(/<media:content[^>]*url="([^"]+)"/i)?.[1] ||
      block.match(/<enclosure[^>]*url="([^"]+)"/i)?.[1] ||
      undefined;
    if (title && link) {
      items.push({ title, link, description, pubDate, thumbnail });
    }
  }
  return items;
}

// ─── rss2json fallback ──────────────────────────────────────────────
async function fetchViaRss2Json(rssUrl: string): Promise<RssItem[]> {
  try {
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      status: string;
      items?: Array<{ title: string; link: string; pubDate: string; description?: string; thumbnail?: string; enclosure?: { link?: string } }>;
    };
    if (data.status !== 'ok' || !Array.isArray(data.items)) return [];
    return data.items.map((it) => ({
      title: it.title,
      link: it.link,
      description: stripHtml(it.description),
      pubDate: it.pubDate,
      thumbnail: it.thumbnail || it.enclosure?.link,
    }));
  } catch {
    return [];
  }
}

async function fetchRss(rssUrl: string): Promise<RssItem[]> {
  // Try direct fetch + parse first
  try {
    const res = await fetch(rssUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'Mozilla/5.0 KAI-Radar-Cron' },
    });
    if (res.ok) {
      const xml = await res.text();
      const items = parseRssXml(xml);
      if (items.length > 0) return items;
    }
  } catch {
    /* fall through */
  }
  // Fallback rss2json
  return fetchViaRss2Json(rssUrl);
}

// ─── Upsert ─────────────────────────────────────────────────────────
async function upsertArticle(
  source: TrackedSource,
  item: RssItem,
): Promise<boolean> {
  if (!item.link) return false;
  try {
    await query(
      `INSERT INTO viral_news_articles
        (source_id, source_name, title, url, summary, category, niche, thumbnail_url, published_at, scraped_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10::jsonb)
       ON CONFLICT (url) DO UPDATE SET
         scraped_at = NOW(),
         summary = COALESCE(EXCLUDED.summary, viral_news_articles.summary),
         thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, viral_news_articles.thumbnail_url)`,
      [
        source.id,
        source.source_name ?? null,
        item.title.slice(0, 500),
        item.link,
        item.description?.slice(0, 1000) ?? null,
        source.category ?? null,
        source.niche ?? null,
        item.thumbnail ?? null,
        item.pubDate ? new Date(item.pubDate).toISOString() : null,
        JSON.stringify({ pubDate: item.pubDate ?? null }),
      ],
    );
    return true;
  } catch (err: any) {
    console.warn(`[cron-news] upsert ${item.link} failed:`, err?.message);
    return false;
  }
}

// ─── Handler ────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  if (!assertCronAuth(req, res)) return;

  const t0 = Date.now();
  const dry = String(req.query.dry || '') === 'true';
  const itemsPerSource = Math.min(
    parseInt(String(req.query.limit || '10'), 10) || 10,
    20,
  );

  // Per-client mode: ?client_id=<uuid> — só fontes daquele client
  // Default (global): só fontes sem client_id setado
  const clientIdRaw = req.query.client_id;
  const clientId = Array.isArray(clientIdRaw) ? clientIdRaw[0] : clientIdRaw;
  const isPerClient = typeof clientId === 'string' && clientId.length > 0;

  let sources: TrackedSource[] = [];
  try {
    const baseSelect = `SELECT id, source_url, source_name, category, niche
         FROM viral_tracked_sources
        WHERE source_type = 'rss'
          AND COALESCE(is_active, true) = true`;

    if (isPerClient) {
      sources = await query<TrackedSource>(
        `${baseSelect}
          AND client_id = $1
        ORDER BY last_scraped_at NULLS FIRST
        LIMIT 60`,
        [clientId],
      );
    } else {
      sources = await query<TrackedSource>(
        `${baseSelect}
          AND client_id IS NULL
        ORDER BY last_scraped_at NULLS FIRST
        LIMIT 60`,
      );
    }
  } catch (err: any) {
    return jsonError(res, 500, 'Failed to query sources', { detail: err?.message });
  }

  if (sources.length === 0) {
    return res.status(200).json({
      ok: true,
      skipped: isPerClient
        ? `No active RSS sources for client ${clientId}`
        : 'No active global RSS sources in viral_tracked_sources',
      scope: isPerClient ? 'client' : 'global',
      client_id: isPerClient ? clientId : null,
      hint: 'Insert sources via INSERT INTO viral_tracked_sources(source_type,source_url,...)',
      duration_ms: Date.now() - t0,
    });
  }

  if (dry) {
    return res.status(200).json({
      ok: true,
      dry: true,
      scope: isPerClient ? 'client' : 'global',
      client_id: isPerClient ? clientId : null,
      sources: sources.length,
      sample: sources.slice(0, 5).map((s) => ({
        id: s.id,
        name: s.source_name,
        url: s.source_url,
      })),
      duration_ms: Date.now() - t0,
    });
  }

  const results: SourceResult[] = [];
  let totalInserted = 0;
  let totalErrors = 0;

  for (const source of sources) {
    const ts0 = Date.now();
    try {
      const items = await fetchRss(source.source_url);
      let inserted = 0;
      for (const item of items.slice(0, itemsPerSource)) {
        const ok = await upsertArticle(source, item);
        if (ok) inserted++;
      }
      totalInserted += inserted;

      // Update last_scraped_at
      await query(
        `UPDATE viral_tracked_sources SET last_scraped_at = NOW() WHERE id = $1`,
        [source.id],
      ).catch(() => null);

      results.push({
        source_id: source.id,
        source_name: source.source_name ?? source.source_url,
        inserted,
        status: items.length === 0 ? 'empty_feed' : 'ok',
        duration_ms: Date.now() - ts0,
      });
    } catch (err: any) {
      totalErrors++;
      results.push({
        source_id: source.id,
        source_name: source.source_name ?? source.source_url,
        inserted: 0,
        status: `error: ${(err?.message || String(err)).slice(0, 80)}`,
        duration_ms: Date.now() - ts0,
      });
    }
    // Be nice to RSS endpoints
    await new Promise((r) => setTimeout(r, 200));
  }

  return res.status(200).json({
    ok: true,
    scope: isPerClient ? 'client' : 'global',
    client_id: isPerClient ? clientId : null,
    sources: sources.length,
    total_inserted: totalInserted,
    errors: totalErrors,
    duration_ms: Date.now() - t0,
    results,
  });
}
