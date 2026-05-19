// List objects no R2 por prefix.
// 2026-05-19: migrado de Vercel Blob (suspenso) pra R2.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { tryAuth } from "../_lib/auth.js";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { listObjects } from "../_lib/r2.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "list failed";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await tryAuth(req);
    if (!user) return res.status(401).json({ error: "Unauthenticated" });

    const { prefix, limit } = (req.body ?? {}) as {
      prefix?: string;
      limit?: number;
    };

    const items = await listObjects(prefix ?? "", limit ?? 100);
    const publicBase = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
    return res.status(200).json({
      blobs: items.map((it) => ({
        name: it.name,
        url: `${publicBase}/${it.name}`,
        size: it.size,
        uploadedAt: it.lastModified,
      })),
    });
  } catch (err) {
    console.error("[blob/list] error:", err);
    return res.status(500).json({ error: errorMessage(err) });
  }
}
