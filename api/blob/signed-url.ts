// R2 signed URL. Pra bucket público devolve URL pública direta; pra privado
// (default da R2) gera presigned GET com expiração.
// 2026-05-19: migrado de Vercel Blob (suspenso) pra R2.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { tryAuth } from "../_lib/auth.js";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { presignGet } from "../_lib/r2.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "signed-url failed";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await tryAuth(req);
    if (!user) return res.status(401).json({ error: "Unauthenticated" });

    const { path, expiresIn } = req.body as {
      path: string;
      expiresIn?: number;
    };
    if (!path) return res.status(400).json({ error: "path required" });

    const publicBase = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
    // Normaliza: se path já é URL pública, devolve direto.
    if (path.startsWith("http")) {
      return res.status(200).json({ signedUrl: path, expiresAt: null });
    }
    // Se publicBase tá configurado (Public Access habilitado), prefere URL pública
    // — não tem expiração e é cacheável via CDN.
    if (publicBase) {
      return res.status(200).json({
        signedUrl: `${publicBase}/${path.replace(/^\/+/, "")}`,
        expiresAt: null,
      });
    }

    // Fallback: gera presigned GET (1h default)
    const ttl = expiresIn ?? 3600;
    const url = await presignGet(path, ttl);
    return res.status(200).json({
      signedUrl: url,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    });
  } catch (err) {
    console.error("[blob/signed-url] error:", err);
    return res.status(500).json({ error: errorMessage(err) });
  }
}
