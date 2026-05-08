/**
 * Migra os 158 swipes de `client_content_library` (CONTEÚDO próprio) →
 * `client_reference_library` (REFs externas) com:
 *   - reference_type = 'inspiration'
 *   - thumbnail_url = primeira imagem do post
 *   - metadata.format detectado: carousel | static | reel | tweet | article | newsletter | email
 *   - metadata.images[] com TODAS as imagens (não só thumb) já no Vercel Blob
 *   - metadata.source_handle, hook, tags, slides_count, posted_at, metrics
 *
 * Idempotente: se já existir entry em client_reference_library com mesmo
 * source_url, faz UPDATE pra preencher images[] novas. Após sucesso, DELETE
 * os swipes de client_content_library.
 *
 * Run:
 *   set -a && source .env && source .env.local.tmp 2>/dev/null && set +a
 *   bunx tsx scripts/migrate-swipes-to-references.ts
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

interface SwipeMeta {
  author: string;
  shortcode: string;
  url: string;
  slidesCount: number;
  posted_at: string | null;
  likes: number | null;
  comments: number | null;
  caption: string;
  hook: string | null;
  imagePaths: string[];
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

function extractCaption(text: string): string {
  const m = text.match(/## Caption\s*\n```\n([\s\S]*?)\n```/);
  return m ? m[1].trim() : "";
}

function extractHook(text: string): string | null {
  const m = text.match(/### Slide \d+\n[\s\S]*?\n```\n([\s\S]*?)\n```/);
  if (!m) return null;
  const first = m[1].trim().split("\n")[0];
  return first.length > 0 && first.length < 200 ? first : null;
}

/**
 * Detecta formato canônico do conteúdo a partir da URL + contagem de slides.
 *  - URL contém /reel/                            → reel
 *  - slides > 1                                   → carousel
 *  - slides === 1 + URL /p/                       → static (post único)
 *  - twitter.com / x.com                          → tweet
 *  - newsletter / substack / beehiiv              → newsletter
 *  - linkedin.com/pulse                           → article
 */
function detectFormat(url: string, slidesCount: number): string {
  const u = url.toLowerCase();
  if (/\/reel\//.test(u)) return "reel";
  if (slidesCount > 1) return "carousel";
  if (/(twitter\.com|x\.com)/.test(u)) return "tweet";
  if (/(substack\.com|beehiiv\.com|news\.|newsletter)/.test(u)) return "newsletter";
  if (/linkedin\.com\/pulse/.test(u)) return "article";
  return "static";
}

async function uploadImage(localPath: string, blobPath: string): Promise<string | null> {
  try {
    const buf = fs.readFileSync(localPath);
    const ext = path.extname(localPath).toLowerCase().replace(".", "") || "jpg";
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const blob = await put(blobPath, buf, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      token: BLOB_TOKEN!,
    });
    return blob.url;
  } catch (err: any) {
    console.warn(`  upload fail ${blobPath}:`, err?.message);
    return null;
  }
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  // 1. Coleta swipes do filesystem
  const swipes: SwipeMeta[] = [];
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
        const hook = extractHook(content);

        // Lista TODAS as imagens (não só primeira)
        const imagesDir = path.join(postDir, "images");
        const imagePaths: string[] = [];
        if (fs.existsSync(imagesDir)) {
          imagePaths.push(
            ...fs
              .readdirSync(imagesDir)
              .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
              .sort() // mantém ordem 01.jpg, 02.jpg, ...
              .map((f) => path.join(imagesDir, f)),
          );
        }

        swipes.push({
          author: fm.author || creator,
          shortcode: fm.shortcode || shortcode,
          url: fm.url || `https://www.instagram.com/p/${shortcode}/`,
          slidesCount: imagePaths.length || (fm.slides ? parseInt(fm.slides, 10) : 1),
          posted_at: fm.posted_at || null,
          likes: fm.likes ? parseInt(fm.likes, 10) : null,
          comments: fm.comments ? parseInt(fm.comments, 10) : null,
          caption,
          hook,
          imagePaths,
        });
      }
    }
  }

  console.log(`📦 ${swipes.length} swipes coletados do filesystem.`);
  const totalImages = swipes.reduce((acc, s) => acc + s.imagePaths.length, 0);
  console.log(`🖼️  ${totalImages} imagens totais a subir.`);

  // 2. Pra cada swipe: upload TODAS as imagens + INSERT em client_reference_library
  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;
  let imagesUploaded = 0;
  let skippedNoImages = 0;

  try {
    for (let i = 0; i < swipes.length; i++) {
      const s = swipes[i];
      if (s.imagePaths.length === 0) {
        skippedNoImages++;
        continue;
      }

      // Upload todas imagens
      const imageUrls: string[] = [];
      for (let n = 0; n < s.imagePaths.length; n++) {
        const localPath = s.imagePaths[n];
        const ext = path.extname(localPath).toLowerCase().replace(".", "") || "jpg";
        const blobPath = `swipe-thumbs/${s.author}/${s.shortcode}-${String(n + 1).padStart(2, "0")}.${ext}`;
        const url = await uploadImage(localPath, blobPath);
        if (url) {
          imageUrls.push(url);
          imagesUploaded++;
        }
      }

      if (imageUrls.length === 0) continue;

      const format = detectFormat(s.url, s.slidesCount);
      const title = (s.caption.split("\n")[0] || `${s.author} ${s.shortcode}`)
        .slice(0, 200)
        .trim() || `${s.author} — ${s.shortcode}`;

      const metadata = {
        format,
        source: "swipe-file",
        source_handle: s.author,
        platform: "instagram",
        shortcode: s.shortcode,
        hook: s.hook,
        slides_count: s.slidesCount,
        posted_at: s.posted_at,
        metrics: { likes: s.likes, comments: s.comments },
        images: imageUrls,
        tags: ["swipe", format, "inspiration"],
      };

      // UPSERT por (client_id, source_url)
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM client_reference_library
          WHERE client_id = $1 AND source_url = $2 LIMIT 1`,
        [MAD_ID, s.url],
      );

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE client_reference_library
              SET title = $1,
                  reference_type = 'inspiration',
                  content = $2,
                  thumbnail_url = $3,
                  metadata = $4::jsonb,
                  updated_at = now()
            WHERE id = $5`,
          [title, s.caption.slice(0, 4000), imageUrls[0], JSON.stringify(metadata), existing.rows[0].id],
        );
        updated++;
      } else {
        await client.query(
          `INSERT INTO client_reference_library
             (client_id, title, reference_type, content, source_url, thumbnail_url, metadata)
           VALUES ($1, $2, 'inspiration', $3, $4, $5, $6::jsonb)`,
          [MAD_ID, title, s.caption.slice(0, 4000), s.url, imageUrls[0], JSON.stringify(metadata)],
        );
        inserted++;
      }

      if ((i + 1) % 25 === 0) {
        console.log(
          `  ${i + 1}/${swipes.length}  inserted:${inserted} updated:${updated} images:${imagesUploaded}`,
        );
      }
    }

    // 3. Cleanup: deleta os 158 swipes que ficaram em client_content_library
    const del = await client.query(
      `DELETE FROM client_content_library
        WHERE client_id = $1
          AND metadata->>'source' = 'swipe-file'
        RETURNING id`,
      [MAD_ID],
    );
    console.log(`\n🧹 Removidos ${del.rowCount} swipes de client_content_library`);

    // 4. Final stats
    const final = await client.query(
      `SELECT
         (SELECT count(*)::int FROM client_reference_library
            WHERE client_id = $1 AND metadata->>'source' = 'swipe-file') AS refs,
         (SELECT count(*)::int FROM client_content_library
            WHERE client_id = $1) AS content`,
      [MAD_ID],
    );
    console.log("\n========================================");
    console.log(`📚 Refs swipes:           ${final.rows[0].refs}`);
    console.log(`📄 Content (cliente):     ${final.rows[0].content}`);
    console.log(`✅ Inserted:              ${inserted}`);
    console.log(`🔄 Updated:               ${updated}`);
    console.log(`🖼️  Imagens uploaded:      ${imagesUploaded}`);
    console.log(`⚠️  Skipped (no images):  ${skippedNoImages}`);
    console.log("========================================");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
