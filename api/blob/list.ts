import type { VercelRequest, VercelResponse } from "@vercel/node";
import { list } from "@vercel/blob";
import { tryAuth } from "../_lib/auth.js";
import { applyCors, handlePreflight } from "../_lib/cors.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "list failed";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
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
  } catch (err) {
    console.error("[blob/list] error:", err);
    return res.status(500).json({ error: errorMessage(err) });
  }
}
