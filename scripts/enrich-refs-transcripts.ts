/**
 * Enriquece os 157 swipes em client_reference_library do Madureira com:
 *   - metadata.slides_text[]    → texto extraído de cada slide do README.md
 *   - metadata.transcribed_text → texto completo concatenado
 *   - metadata.transcribed_at   → timestamp
 *
 * Script throwaway — roda 1x.
 *
 * Run:
 *   set -a && source .env && set +a
 *   bunx tsx scripts/enrich-refs-transcripts.ts
 */
import { Pool } from "@neondatabase/serverless";
import * as fs from "node:fs";
import * as path from "node:path";

const VAULT_BASE = "/Users/gabrielmadureira/GOS/vault/99 - SISTEMA/biblioteca/swipe-instagram";
const FOLDERS = ["_disponiveis", "_usados"];
const MAD_ID = "14bf8576-7104-48ca-962d-014308e45a4e";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL ausente.");
  process.exit(1);
}

interface ParsedSwipe {
  shortcode: string;
  url: string;
  caption: string;
  slidesText: string[];
}

function parseFrontmatter(text: string): Record<string, string> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const eq = line.indexOf(":");
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

function extractCaption(text: string): string {
  const m = text.match(/## Caption\s*\n```\n([\s\S]*?)\n```/);
  return m ? m[1].trim() : "";
}

function extractAllSlideTexts(text: string): string[] {
  const blocks = [...text.matchAll(/### Slide \d+\n[\s\S]*?\n```\n([\s\S]*?)\n```/g)];
  return blocks.map((m) => m[1].trim()).filter(Boolean);
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  const swipes: ParsedSwipe[] = [];
  for (const folder of FOLDERS) {
    const baseDir = path.join(VAULT_BASE, folder);
    if (!fs.existsSync(baseDir)) continue;
    const creators = fs.readdirSync(baseDir).filter((d) => !d.startsWith("."));
    for (const creator of creators) {
      const creatorDir = path.join(baseDir, creator);
      if (!fs.statSync(creatorDir).isDirectory()) continue;
      const posts = fs.readdirSync(creatorDir).filter((d) => !d.startsWith("."));
      for (const shortcode of posts) {
        const postDir = path.join(creatorDir, shortcode);
        if (!fs.statSync(postDir).isDirectory()) continue;
        const readmePath = path.join(postDir, "README.md");
        if (!fs.existsSync(readmePath)) continue;
        const content = fs.readFileSync(readmePath, "utf8");
        const fm = parseFrontmatter(content);
        const url = fm.url || `https://www.instagram.com/p/${shortcode}/`;
        const slidesText = extractAllSlideTexts(content);
        swipes.push({
          shortcode: fm.shortcode || shortcode,
          url,
          caption: extractCaption(content),
          slidesText,
        });
      }
    }
  }

  console.log(`📦 ${swipes.length} swipes parseados.`);

  const client = await pool.connect();
  let updated = 0;
  let notFound = 0;

  try {
    for (const s of swipes) {
      const transcribed = s.slidesText.join("\n\n---\n\n");
      const r = await client.query(
        `UPDATE client_reference_library
            SET metadata = metadata || jsonb_build_object(
                  'slides_text', $2::jsonb,
                  'transcribed_text', $3::text,
                  'transcribed_at', $4::text
                ),
                content = $5,
                updated_at = now()
          WHERE client_id = $1 AND source_url = $6
          RETURNING id`,
        [
          MAD_ID,
          JSON.stringify(s.slidesText),
          transcribed,
          new Date().toISOString(),
          // content vira: caption + transcribed (full text pra search)
          [s.caption, transcribed].filter(Boolean).join("\n\n").slice(0, 8000),
          s.url,
        ],
      );
      if (r.rowCount && r.rowCount > 0) updated++;
      else notFound++;
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n✅ Updated: ${updated} | Não encontrados na DB: ${notFound}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
