/**
 * Atualiza thumbnail_url do client_content_library do Madureira pros swipes
 * importados — re-uploadando primeira imagem de cada post pro Vercel Blob
 * (allowOverwrite=true, idempotente) e fazendo UPDATE.
 *
 * Run:
 *   set -a && source .env && source .env.local.tmp 2>/dev/null && set +a
 *   bunx tsx scripts/update-swipe-thumbnails.ts
 */
import { Pool } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import * as fs from "node:fs";
import * as path from "node:path";

const VAULT_BASE = "/Users/gabrielmadureira/GOS/vault/99 - SISTEMA/biblioteca/swipe-instagram";
const FOLDERS = ["_disponiveis", "_usados"];
const MAD_ID = "14bf8576-7104-48ca-962d-014308e45a4e";

const DATABASE_URL = process.env.DATABASE_URL;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!DATABASE_URL || !BLOB_TOKEN) {
  console.error("DATABASE_URL ou BLOB_READ_WRITE_TOKEN ausente.");
  process.exit(1);
}

interface SwipeItem {
  author: string;
  shortcode: string;
  url: string;
  thumbnail_path: string | null;
}

function parseFrontmatter(text: string): Record<string, string> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const eq = line.indexOf(":");
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const items: SwipeItem[] = [];

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
        const imagesDir = path.join(postDir, "images");
        let thumbnailPath: string | null = null;
        if (fs.existsSync(imagesDir)) {
          const imgs = fs
            .readdirSync(imagesDir)
            .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
            .sort();
          if (imgs.length > 0) thumbnailPath = path.join(imagesDir, imgs[0]);
        }
        items.push({
          author: fm.author || creator,
          shortcode: fm.shortcode || shortcode,
          url: fm.url || `https://www.instagram.com/p/${shortcode}/`,
          thumbnail_path: thumbnailPath,
        });
      }
    }
  }

  console.log(`${items.length} swipes encontrados.`);

  const client = await pool.connect();
  let updated = 0;
  let failed = 0;

  try {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.thumbnail_path) continue;
      try {
        const buf = fs.readFileSync(it.thumbnail_path);
        const ext = path.extname(it.thumbnail_path).toLowerCase().replace(".", "") || "jpg";
        const contentType = ext === "png" ? "image/png" : "image/jpeg";
        const blob = await put(`swipe-thumbs/${it.author}/${it.shortcode}.${ext}`, buf, {
          access: "public",
          contentType,
          addRandomSuffix: false,
          allowOverwrite: true,
          token: BLOB_TOKEN,
        });

        const r = await client.query(
          `UPDATE public.client_content_library
              SET thumbnail_url = $1
            WHERE client_id = $2
              AND content_url = $3
              AND thumbnail_url IS NULL
            RETURNING id`,
          [blob.url, MAD_ID, it.url],
        );
        if (r.rowCount && r.rowCount > 0) updated++;
      } catch (err: any) {
        console.warn(`  fail ${it.shortcode}:`, err?.message);
        failed++;
      }
      if ((i + 1) % 25 === 0) {
        console.log(`  ${i + 1}/${items.length}  updated:${updated} fail:${failed}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`\n✅ Updated thumbnail_url em ${updated} swipes (${failed} falhas).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
