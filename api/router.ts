// Catch-all router — consolida 91 handlers em 1 Vercel Function
// (Hobby plan tem limite de 12 functions; este pattern reduz pra 1+5 blob)
//
// Roteamento: /api/<nome>  →  ./_handlers/<nome>.ts (export default handler)
//             /api/<grupo>/<nome>  →  ./_handlers/<grupo>/<nome>.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handlerLoaders } from "./handler-manifest.js";
import { applyCors, handlePreflight } from "./_lib/cors.js";

const handlerCache = new Map<string, Function>();

async function loadHandler(slug: string): Promise<Function | null> {
  if (!/^[a-z0-9_/-]+$/i.test(slug)) return null;
  if (handlerCache.has(slug)) return handlerCache.get(slug)!;

  const loader = handlerLoaders[slug];
  if (!loader) return null;
  try {
    const mod = await loader();
    const fn = mod.default ?? mod.handler;
    if (typeof fn !== "function") return null;
    handlerCache.set(slug, fn);
    return fn;
  } catch (err) {
    console.error(`[router] failed to load handler '${slug}':`, err);
    return null;
  }
}

export default async function router(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  // O slug vem do query param `slug` (do rewrite) ou do path /api/<slug>
  let slug = "";
  const slugParam = req.query.slug;
  if (slugParam) {
    const slugArr = Array.isArray(slugParam) ? slugParam : [slugParam];
    slug = slugArr.filter(Boolean).join("/");
  } else if (req.url) {
    const u = new URL(req.url, `https://${req.headers.host || "localhost"}`);
    slug = u.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
  }

  if (!slug || slug === "router") {
    return res.status(404).json({ error: "Not found", hint: "/api/<handler-name>" });
  }

  // Tenta primeiro slug exato (ex: 'data/saved'), depois fallback kebab
  // (ex: 'data-saved'). Sub-apps que herdam URLs Next.js style com '/'
  // funcionam sem precisar criar subdir handlers.
  let handler = await loadHandler(slug);
  if (!handler && slug.includes("/")) {
    const kebab = slug.replace(/\//g, "-");
    handler = await loadHandler(kebab);
  }
  if (!handler) {
    return res.status(404).json({ error: `Handler '${slug}' not found` });
  }

  try {
    return await handler(req, res);
  } catch (err: any) {
    console.error(`[router] handler '${slug}' threw:`, err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message ?? "Internal error" });
    }
  }
}
