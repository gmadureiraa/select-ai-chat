import type { VercelRequest, VercelResponse } from "@vercel/node";
import { del } from "@vercel/blob";
import { tryAuth } from "../_lib/auth.js";
import { applyCors, handlePreflight } from "../_lib/cors.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "delete failed";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await tryAuth(req);
    if (!user) return res.status(401).json({ error: "Unauthenticated" });

    const { paths } = req.body as { paths: string[] };
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: "paths array required" });
    }

    await del(paths);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[blob/delete] error:", err);
    return res.status(500).json({ error: errorMessage(err) });
  }
}
