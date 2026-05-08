/**
 * Importa todos os swipes Instagram coletados em
 * `vault/99 - SISTEMA/biblioteca/swipe-instagram/{_disponiveis,_usados}/`
 * pra biblioteca global do KAI:
 *
 *   - URL com `/reel/` OU caption sugere video → `library_reels`
 *   - slides > 1                                → `library_ideas` (category='carrossel')
 *   - slides === 1 + url `/p/`                   → `library_ideas` (category='estatico')
 *
 * Pra cada swipe:
 *   1. Parseia frontmatter YAML (author, shortcode, url, posted_at, likes, comments, slides).
 *   2. Lê primeira imagem (slide 01) e sobe pro Vercel Blob como thumbnail.
 *   3. Insere na tabela apropriada com is_global=true.
 *
 * Idempotência: ON CONFLICT DO NOTHING via UNIQUE (source_url).
 *
 * Run:
 *   set -a && source .env && source .env.local.tmp && set +a
 *   bunx tsx scripts/import-swipe-files.ts
 */
import { Pool } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import * as fs from "node:fs";
import * as path from "node:path";

const VAULT_BASE = "/Users/gabrielmadureira/GOS/vault/99 - SISTEMA/biblioteca/swipe-instagram";
const FOLDERS = ["_disponiveis", "_usados"];

const DATABASE_URL = process.env.DATABASE_URL;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!DATABASE_URL) {
  console.error("DATABASE_URL ausente.");
  process.exit(1);
}

interface Swipe {
  author: string;
  shortcode: string;
  url: string;
  posted_at: string | null;
  likes: number | null;
  comments: number | null;
  slides: number;
  caption: string;
  thumbnail_path: string | null;
  hooks: string[];
}

function parseFrontmatter(text: string): Record<string, string> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const eq = line.indexOf(":");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    out[k] = v;
  }
  return out;
}

function extractCaption(text: string): string {
  const m = text.match(/## Caption\s*\n```\n([\s\S]*?)\n```/);
  return m ? m[1].trim() : "";
}

function extractHooks(text: string): string[] {
  // Pega o primeiro bloco de texto de cada slide como hook
  const slides = [...text.matchAll(/### Slide \d+\n[\s\S]*?\n```\n([\s\S]*?)\n```/g)];
  return slides
    .slice(0, 3)
    .map((m) => m[1].trim().split("\n")[0])
    .filter((s) => s.length > 0 && s.length < 200);
}

function isReel(url: string, caption: string): boolean {
  if (/\/reel\//i.test(url)) return true;
  // Se a caption tem "@" como autor only e slides=1, provavelmente é reel
  return false;
}

async function uploadThumb(
  imagePath: string,
  blobPath: string,
): Promise<string | null> {
  if (!BLOB_TOKEN) {
    console.warn(`  [no-blob-token] skip upload thumbnail`);
    return null;
  }
  try {
    const buf = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase().replace(".", "") || "jpg";
    const contentType = ext === "png" ? "image/png" : "image/jpeg";
    const blob = await put(blobPath, buf, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      token: BLOB_TOKEN,
    });
    return blob.url;
  } catch (err: any) {
    console.warn(`  [blob-fail] ${blobPath}:`, err?.message);
    return null;
  }
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  const allSwipes: Swipe[] = [];

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
        const caption = extractCaption(content);
        const hooks = extractHooks(content);

        // Imagem da capa: primeira em images/
        const imagesDir = path.join(postDir, "images");
        let thumbnailPath: string | null = null;
        if (fs.existsSync(imagesDir)) {
          const imgs = fs.readdirSync(imagesDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
          if (imgs.length > 0) {
            thumbnailPath = path.join(imagesDir, imgs[0]);
          }
        }

        allSwipes.push({
          author: fm.author || creator,
          shortcode: fm.shortcode || shortcode,
          url: fm.url || `https://www.instagram.com/p/${shortcode}/`,
          posted_at: fm.posted_at || null,
          likes: fm.likes ? parseInt(fm.likes, 10) : null,
          comments: fm.comments ? parseInt(fm.comments, 10) : null,
          slides: fm.slides ? parseInt(fm.slides, 10) : 1,
          caption,
          thumbnail_path: thumbnailPath,
          hooks,
        });
      }
    }
  }

  console.log(`Coletados ${allSwipes.length} swipes do filesystem.`);

  let reelsInserted = 0;
  let ideasCarrossel = 0;
  let ideasEstatico = 0;
  let skipped = 0;
  let blobUploaded = 0;

  const client = await pool.connect();
  try {
    for (let i = 0; i < allSwipes.length; i++) {
      const s = allSwipes[i];
      const treatedAsReel = isReel(s.url, s.caption);

      // Upload thumbnail
      let thumbUrl: string | null = null;
      if (s.thumbnail_path) {
        const blobPath = `swipe-thumbs/${s.author}/${s.shortcode}.jpg`;
        thumbUrl = await uploadThumb(s.thumbnail_path, blobPath);
        if (thumbUrl) blobUploaded++;
      }

      const title = (s.caption.split("\n")[0] || `${s.author} ${s.shortcode}`).slice(0, 200).trim() || `${s.author} — ${s.shortcode}`;

      try {
        if (treatedAsReel) {
          // library_reels
          const r = await client.query(
            `INSERT INTO public.library_reels
               (title, caption, source_url, thumbnail_url, author_handle,
                likes, comments, posted_at, category, tags, hooks, is_global)
             VALUES ($1, $2, $3, $4, $5,
                     $6, $7, $8::timestamptz, $9, $10::text[], $11::text[], true)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [
              title,
              s.caption.slice(0, 2000),
              s.url,
              thumbUrl,
              s.author,
              s.likes,
              s.comments,
              s.posted_at,
              "instagram",
              ["reel", "swipe"],
              s.hooks,
            ],
          );
          if (r.rowCount && r.rowCount > 0) reelsInserted++;
          else skipped++;
        } else {
          // library_ideas
          const category = s.slides > 1 ? "carrossel" : "estatico";
          const tags = s.slides > 1 ? ["carrossel", "swipe"] : ["estatico", "swipe"];
          const r = await client.query(
            `INSERT INTO public.library_ideas
               (title, category, hook, description, source_url, source_handle,
                tags, is_global)
             VALUES ($1, $2, $3, $4, $5, $6, $7::text[], true)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [
              title,
              category,
              s.hooks[0] ?? null,
              s.caption.slice(0, 2000),
              s.url,
              s.author,
              tags,
            ],
          );
          if (r.rowCount && r.rowCount > 0) {
            if (category === "carrossel") ideasCarrossel++;
            else ideasEstatico++;
          } else skipped++;
        }
      } catch (err: any) {
        console.error(`Insert failed ${s.shortcode}:`, err?.message);
        skipped++;
      }

      if ((i + 1) % 25 === 0) {
        console.log(`  ${i + 1}/${allSwipes.length}  reels:${reelsInserted} carrossel:${ideasCarrossel} estatico:${ideasEstatico} skip:${skipped} thumbs:${blobUploaded}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log("\n========================================");
  console.log(`Total swipes processados: ${allSwipes.length}`);
  console.log(`  → library_reels:        ${reelsInserted}`);
  console.log(`  → library_ideas (carrossel): ${ideasCarrossel}`);
  console.log(`  → library_ideas (estático):  ${ideasEstatico}`);
  console.log(`  → skipped (já existia ou erro): ${skipped}`);
  console.log(`  → thumbnails uploadeded: ${blobUploaded}`);
  console.log("========================================\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
