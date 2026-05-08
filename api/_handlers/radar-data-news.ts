// GET /api/radar-data-news?niche=marketing&limit=60&hours=72&kind=news|analysis
//
// Lê news_articles + classifica como news ou analysis.
// Ported de radar-viral/app/api/data/news/route.ts.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { tryAuth } from "../_lib/auth.js";
import { query } from "../_lib/db.js";

interface NewsArticleRow {
  link: string;
  source_id: string | null;
  source_name: string | null;
  source_color: string | null;
  language: string | null;
  niche: string;
  category: string | null;
  title: string;
  description: string | null;
  thumbnail: string | null;
  pub_date: string | null;
  kind?: "news" | "analysis";
  classifier_score?: number;
}

// ─── Inline classifier (heurística, não-LLM) ─────────────────────────────
const NEWS_VERBS_EN =
  /\b(launch(es|ed)?|raises?|raised|cuts?|fires?|fired|hires?|hired|acquires?|acquired|merges?|merged|files?|filed|approves?|approved|rejects?|rejected|sues?|sued|wins?|won|loses?|lost|buys?|bought|sells?|sold|signs?|signed|partners? with|appointed?|delists?|listed?|released|releases|announces|announced|reveals?|debuts?|rolls? out|scraps?|moves? to|joins?|leaves?|exits?|steps? down|hits?|surpasses?|tops?|breaks?|crosses?|reaches?|surges?|drops?|plunges?|slides?|rallies|jumps?|gains?|adds?|invests?|invested|backs?|backed|opens?|closes?|denies?|denied|seizes?|seized|halts?|halted|pauses?|paused|resumes?|resumed)\b/i;
const NEWS_VERBS_PT =
  /\b(lança|lançou|anuncia|anunciou|compra|comprou|vende|vendeu|demite|demitiu|contrata|contratou|aprova|aprovou|rejeita|rejeitou|processa|processou|fecha parceria|investe|investiu|capta|captou|recebe|recebeu|levanta|levantou|firma|firmou|adquire|adquiriu)\b/i;
const NEWS_TITLE_PATTERNS = [
  /\b\w+\s+(launch(es|ed)?|raises?|cuts?|files?)\b/i,
  /\$\d|\b\d[\d,.]*\s?(million|billion|trillion|bilhão|bilhões|milhão|milhões|mi|bi|m|b)\b/i,
  /\b\d+%/,
];
const ANALYSIS_PATTERNS = [
  /\?$/,
  /^\s*(why|how|what|should|will|can|is|are|does|por que|porque|como|deve|deveria|vai|vão|pode|é|são)\b.*\?/i,
  /\b(what to expect|how to|reasons? (why|to)|things? (you|to)|tips?|guide|tutorial)\b/i,
  /^\s*\d+\s+(reasons?|things?|tips?|ways?|maneiras|motivos|coisas|formas)\b/i,
  /\b(roundup|recap|performance update|day \d+|wrap-?up|highlights)\b/i,
  /\b(could|may|might|predicts?|forecast(s|ed)?|outlook|análise|previsão|prevê)\b/i,
];

function classify(input: {
  title: string;
  description?: string | null;
  source_name?: string | null;
}): { kind: "news" | "analysis"; score: number } {
  const title = (input.title ?? "").trim();
  const desc = (input.description ?? "").trim();
  const haystack = `${title} ${desc}`;
  let score = 0;

  if (NEWS_VERBS_EN.test(haystack)) score += 15;
  if (NEWS_VERBS_PT.test(haystack)) score += 15;
  for (const re of NEWS_TITLE_PATTERNS) if (re.test(title)) score += 12;
  for (const re of ANALYSIS_PATTERNS) if (re.test(title)) score -= 25;

  const allCapsRatio =
    (title.match(/[A-ZÁÉÍÓÚÂÊÔÃÕ]/g) ?? []).length /
    Math.max(1, title.length);
  if (allCapsRatio > 0.6 && title.length > 20) score -= 20;

  return { kind: score >= 0 ? "news" : "analysis", score };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  await tryAuth(req);

  const niche = (req.query.niche as string) || "marketing";
  const limitRaw = Number(req.query.limit ?? 60);
  const hoursRaw = Number(req.query.hours ?? 72);
  const limit = Math.min(120, Math.max(3, Number.isFinite(limitRaw) ? limitRaw : 60));
  const hours = Math.min(720, Math.max(6, Number.isFinite(hoursRaw) ? hoursRaw : 72));
  const kindParam = req.query.kind as "news" | "analysis" | undefined;

  try {
    const fetchSize = Math.min(200, Math.max(limit * 2, limit));
    // KAI viral_news_articles columns: url, source_name, summary,
    // thumbnail_url, published_at (sem source_color/description/pub_date).
    const rawRows = await query<NewsArticleRow>(
      `SELECT url AS link, source_id::text AS source_id, source_name,
              NULL::text AS source_color, language,
              niche, category, title, summary AS description,
              thumbnail_url AS thumbnail, published_at::text AS pub_date
         FROM viral_news_articles
        WHERE niche = $1
          AND published_at >= NOW() - ($2 || ' hours')::interval
        ORDER BY published_at DESC NULLS LAST
        LIMIT $3`,
      [niche, hours, fetchSize],
    );

    const enriched = rawRows.map((r) => {
      const c = classify({
        title: r.title,
        description: r.description,
        source_name: r.source_name,
      });
      return { ...r, kind: c.kind, classifier_score: c.score };
    });

    let filtered = enriched;
    if (kindParam === "news") filtered = enriched.filter((r) => r.kind === "news");
    else if (kindParam === "analysis") filtered = enriched.filter((r) => r.kind === "analysis");

    filtered.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "news" ? -1 : 1;
      const sb = b.classifier_score ?? 0;
      const sa = a.classifier_score ?? 0;
      if (sa !== sb) return sb - sa;
      return (b.pub_date ?? "").localeCompare(a.pub_date ?? "");
    });

    return res.status(200).json({ articles: filtered.slice(0, limit) });
  } catch (err: any) {
    console.error("[radar-data-news] failed:", err);
    return res.status(500).json({
      error: process.env.NODE_ENV === "production" ? "Falha" : String(err),
    });
  }
}
