// DEPRECATED 2026-05-19 — upload-token era pro flow client-side do Vercel Blob
// (`@vercel/blob/client.upload`). Migramos pra Cloudflare R2 + upload server-side
// via /api/upload (multipart). Esse endpoint continua respondendo só pra não
// quebrar caches antigos do bundle browser que ainda apontam pra cá.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handlePreflight } from "../_lib/cors.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  return res.status(410).json({
    error: "Endpoint descontinuado. Use POST /api/upload (multipart/form-data).",
    redirect: "/api/upload",
  });
}
