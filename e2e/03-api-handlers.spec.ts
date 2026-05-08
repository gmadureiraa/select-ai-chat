import { test, expect } from "../playwright-fixture";

test.describe("API handlers (smoke + auth gates)", () => {
	test("GET /api/mcp-reader → 200 com tools array OU 401 sem token", async ({ request }) => {
		const response = await request.get("/api/mcp-reader");
		const status = response.status();
		expect([200, 401]).toContain(status);

		const body = await response.json();
		if (status === 200) {
			expect(Array.isArray(body.tools)).toBe(true);
			expect(body.tools.length).toBeGreaterThan(0);
		} else {
			expect(body.error).toBeTruthy();
		}
	});

	test("POST /api/scrape-website sem auth → 401", async ({ request }) => {
		const response = await request.post("/api/scrape-website", {
			data: { url: "https://example.com" },
			headers: { "content-type": "application/json" },
		});
		expect(response.status()).toBe(401);
		const body = await response.json();
		expect(body.error).toBeTruthy();
	});

	test("POST /api/extract-instagram sem auth → 401", async ({ request }) => {
		const response = await request.post("/api/extract-instagram", {
			data: { url: "https://instagram.com/p/test" },
			headers: { "content-type": "application/json" },
		});
		expect(response.status()).toBe(401);
		const body = await response.json();
		expect(body.error).toBeTruthy();
	});

	test("POST /api/blob/upload-token sem auth → 401", async ({ request }) => {
		const response = await request.post("/api/blob/upload-token", {
			data: { filename: "test.png" },
			headers: { "content-type": "application/json" },
		});
		expect(response.status()).toBe(401);
		const body = await response.json();
		// Pode ser { error: "Unauthenticated" } ou { error: ... }
		expect(body.error).toBeTruthy();
	});

	test("POST /api/stripe-webhook sem body válido → 400/503 (não 200)", async ({
		request,
	}) => {
		const response = await request.post("/api/stripe-webhook", {
			data: {},
			headers: { "content-type": "application/json" },
		});
		const status = response.status();

		// 503: STRIPE_SECRET_KEY/WEBHOOK_SECRET não configurados (env missing)
		// 400: signature inválida (env presente mas body sem stripe-signature)
		// 401/403: variantes de auth/security
		expect([400, 401, 403, 503]).toContain(status);
	});

	test("POST /api/nonexistent-handler → 404", async ({ request }) => {
		const response = await request.post("/api/nonexistent-handler-xyz-12345", {
			data: {},
			headers: { "content-type": "application/json" },
		});
		expect(response.status()).toBe(404);
	});

	test("GET /api/nonexistent-handler → 404", async ({ request }) => {
		const response = await request.get("/api/nonexistent-handler-xyz-12345");
		expect(response.status()).toBe(404);
	});

	test("/api/get-vapid-public-key responde (handler público)", async ({ request }) => {
		const response = await request.get("/api/get-vapid-public-key");
		// Pode ser 200 (env presente), 405 (só POST), ou 503 (env missing).
		// Importante: não deve ser 404 (handler existe).
		expect(response.status()).not.toBe(404);
	});
});
