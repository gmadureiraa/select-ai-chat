import type { VercelRequest, VercelResponse } from "@vercel/node";
import { list } from "@vercel/blob";
import { tryAuth } from "../_lib/auth.js";
import { applyCors, handlePreflight } from "../_lib/cors.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await tryAuth(req);
    if (!user) return res.status(401).json({ error: "Unauthenticated" });

    const { prefix, limit, cursor } = (req.body ?? {}) as {
      prefix?: string;
      limit?: number;
      cursor?: string;
    };

    const result = await list({ prefix, limit, cursor });
    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[blob/list] error:", err);
    return res.status(500).json({ error: err.message ?? "list failed" });
  }
}
