// Vercel Blob has no native signed URLs (public access by default).
// This endpoint returns the blob's public URL directly. For private buckets,
// proxy via /api/blob/download.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { head } from "@vercel/blob";
import { tryAuth } from "../_lib/auth.js";
import { applyCors, handlePreflight } from "../_lib/cors.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "signed-url failed";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await tryAuth(req);
    if (!user) return res.status(401).json({ error: "Unauthenticated" });

    const { path } = req.body as { path: string };
    if (!path) return res.status(400).json({ error: "path required" });

    // Tenta head pra obter URL canônica
    try {
      const blob = await head(path);
      return res.status(200).json({ signedUrl: blob.url, expiresAt: null });
    } catch {
      // Fallback: proxy via /api/blob/download
      const proto = req.headers["x-forwarded-proto"] ?? "https";
      const host = req.headers.host;
      const proxy = `${proto}://${host}/api/blob/download?path=${encodeURIComponent(path)}`;
      return res.status(200).json({ signedUrl: proxy, expiresAt: null });
    }
  } catch (err) {
    console.error("[blob/signed-url] error:", err);
    return res.status(500).json({ error: errorMessage(err) });
  }
}
