// Delete objects no R2.
// 2026-05-19: migrado de Vercel Blob (suspenso) pra R2.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { tryAuth } from "../_lib/auth.js";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { deleteObjects } from "../_lib/r2.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "delete failed";
}

/** Converte URL pública R2 → key. Aceita key crua também. */
function urlOrKeyToKey(input: string, publicBase: string): string {
  if (input.startsWith(publicBase)) {
    return input.slice(publicBase.length).replace(/^\/+/, "");
  }
  return input.replace(/^\/+/, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await tryAuth(req);
    if (!user) return res.status(401).json({ error: "Unauthenticated" });

    const { paths } = req.body as { paths: string[] };
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: "paths array required" });
    }

    const publicBase = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
    const keys = paths.map((p) => urlOrKeyToKey(p, publicBase));

    await deleteObjects(keys);
    return res.status(200).json({ ok: true, deleted: keys.length });
  } catch (err) {
    console.error("[blob/delete] error:", err);
    return res.status(500).json({ error: errorMessage(err) });
  }
}
