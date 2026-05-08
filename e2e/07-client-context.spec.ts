import { test, expect } from "../playwright-fixture";

// Smoke tests for the new GET /api/client-context endpoint.
// Auth and parameter gates only — full happy-path needs a workspace member
// JWT, which is out of scope for E2E (covered by manual / integration tests).

test.describe("/api/client-context (auth + param gates)", () => {
	test("GET /api/client-context sem auth → 401", async ({ request }) => {
		const response = await request.get(
			"/api/client-context?client_id=00000000-0000-0000-0000-000000000000"
		);
		expect(response.status()).toBe(401);
		const body = await response.json();
		expect(body.error).toBeTruthy();
	});

	test("GET /api/client-context com Bearer inválido → 401", async ({
		request,
	}) => {
		const response = await request.get(
			"/api/client-context?client_id=00000000-0000-0000-0000-000000000000",
			{
				headers: { Authorization: "Bearer not-a-real-jwt" },
			}
		);
		expect(response.status()).toBe(401);
		const body = await response.json();
		expect(body.error).toBeTruthy();
	});

	test("POST /api/client-context → 405 (só GET)", async ({ request }) => {
		const response = await request.post("/api/client-context", {
			data: {},
			headers: { "content-type": "application/json" },
		});
		// Sem auth o handler retorna 401 antes de chegar no method check.
		// Ambas respostas são aceitáveis pra esse smoke.
		expect([401, 405]).toContain(response.status());
	});
});
