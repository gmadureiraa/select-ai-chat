// Validação manual dos fixes Performance (2026-05-16):
// 1. Instagram posts retornam `id` populado (não undefined)
// 2. Stories retornam `id` sintético (fingerprint publishedAt+businessId)
// 3. LinkedIn handler scrape responde (mesmo que Apify estoure quota)
//
// Roda contra dev server local (http://localhost:8081) usando internal bypass.
// Não substitui auth flow real (cobertura via 02-auth-flow.spec.ts).

import { test, expect } from "@playwright/test";

const CRON_SECRET = (process.env.CRON_SECRET || "").replace(/\\n/g, "").trim();
const MADUREIRA_CLIENT_ID = "14bf8576-7104-48ca-962d-014308e45a4e";
const MADUREIRA_OWNER_UUID = "5014248e-b1ac-4306-8490-2644dcd8aeb5";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8081";

function internalHeaders() {
  return {
    "content-type": "application/json",
    "x-internal-cron-secret": CRON_SECRET,
    "x-internal-user-id": MADUREIRA_OWNER_UUID,
  };
}

test.describe("Performance fix — id normalization + LinkedIn scrape", () => {
  test.skip(!CRON_SECRET, "CRON_SECRET not loaded — set in .env.production");

  test("metricool-analytics IG posts têm id populado", async ({ request }) => {
    const r = await request.post(`${BASE_URL}/api/router?slug=metricool-analytics`, {
      headers: internalHeaders(),
      data: {
        clientId: MADUREIRA_CLIENT_ID,
        mode: "posts",
        network: "instagram",
        from: "2026-04-01T00:00:00",
        to: "2026-05-16T23:59:59",
      },
    });
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.posts).toBeInstanceOf(Array);
    expect(j.posts.length).toBeGreaterThan(0);
    for (const p of j.posts) {
      expect(p.id, `IG post sem id: ${JSON.stringify(p).slice(0, 100)}`).toBeTruthy();
      expect(typeof p.id).toBe("string");
    }
    // Garante unicidade — sem isso React keys colidem
    const ids = j.posts.map((p: any) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test("metricool-analytics IG stories têm id sintético", async ({ request }) => {
    const r = await request.post(`${BASE_URL}/api/router?slug=metricool-analytics`, {
      headers: internalHeaders(),
      data: {
        clientId: MADUREIRA_CLIENT_ID,
        mode: "stories",
        network: "instagram",
        from: "2026-04-01T00:00:00",
        to: "2026-05-16T23:59:59",
      },
    });
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.stories).toBeInstanceOf(Array);
    // Stories podem ser 0 (acabam em 24h); só validamos shape quando houver.
    for (const s of j.stories || []) {
      expect(s.id, `story sem id: ${JSON.stringify(s).slice(0, 100)}`).toBeTruthy();
    }
  });

  test("metricool-analytics IG reels têm id populado", async ({ request }) => {
    const r = await request.post(`${BASE_URL}/api/router?slug=metricool-analytics`, {
      headers: internalHeaders(),
      data: {
        clientId: MADUREIRA_CLIENT_ID,
        mode: "reels",
        network: "instagram",
        from: "2026-04-01T00:00:00",
        to: "2026-05-16T23:59:59",
      },
    });
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.reels).toBeInstanceOf(Array);
    for (const r of j.reels || []) {
      expect(r.id).toBeTruthy();
    }
  });

  test("fetch-linkedin-posts-apify responde gracioso", async ({ request }) => {
    const r = await request.post(`${BASE_URL}/api/router?slug=fetch-linkedin-posts-apify`, {
      headers: internalHeaders(),
      data: { clientId: MADUREIRA_CLIENT_ID, handle: "ogmadureira" },
      timeout: 60_000,
    });
    expect(r.status()).toBe(200);
    const j = await r.json();
    // Aceita: success (com dados), success skipped (cooldown), ou apify_quota_exceeded.
    if (j.success) {
      expect(j.upserted).toBeGreaterThanOrEqual(0);
    } else {
      expect(j.error).toBeTruthy();
    }
  });
});
