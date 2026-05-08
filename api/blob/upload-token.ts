// Issues client tokens for direct browser uploads to Vercel Blob.
// Used by @vercel/blob/client `upload()`.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { tryAuth } from "../_lib/auth.js";
import { applyCors, handlePreflight } from "../_lib/cors.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Authenticate via Neon Auth JWT
    const user = await tryAuth(req);
    if (!user) return res.status(401).json({ error: "Unauthenticated" });

    const body = req.body as HandleUploadBody;
    const json = await handleUpload({
      body,
      request: req as unknown as Request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // clientPayload pode trazer { bucket, contentType }
        let parsed: { bucket?: string; contentType?: string } = {};
        try {
          if (clientPayload) parsed = JSON.parse(clientPayload);
        } catch {}

        return {
          allowedContentTypes: parsed.contentType
            ? [parsed.contentType]
            : ["image/*", "video/*", "application/pdf", "application/*"],
          tokenPayload: JSON.stringify({
            userId: user.id,
            bucket: parsed.bucket || "client-files",
            pathname,
          }),
        };
      },
      onUploadCompleted: async () => {
        // Hook opcional pra registrar upload no DB
      },
    });

    return res.status(200).json(json);
  } catch (err: any) {
    console.error("[blob/upload-token] error:", err);
    return res.status(500).json({ error: err.message ?? "upload-token failed" });
  }
}
