// Proxy de download: busca da Vercel Blob URL e retorna bytes
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { head } from "@vercel/blob";
import { applyCors, handlePreflight } from "../_lib/cors.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "download failed";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const path = (req.query.path as string) || "";
    if (!path) return res.status(400).json({ error: "path required" });

    const blob = await head(path);
    const upstream = await fetch(blob.url);
    if (!upstream.ok) {
      return res.status(upstream.status).send(await upstream.text());
    }

    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    const cl = upstream.headers.get("content-length");
    res.setHeader("Content-Type", ct);
    if (cl) res.setHeader("Content-Length", cl);
    res.setHeader("Cache-Control", "private, max-age=300");

    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.status(200).send(buf);
  } catch (err) {
    console.error("[blob/download] error:", err);
    return res.status(500).json({ error: errorMessage(err) });
  }
}
