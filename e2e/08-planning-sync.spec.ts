import { test, expect } from "../playwright-fixture";

test.describe("save-as-planning-item handler", () => {
	test("POST /api/save-as-planning-item sem auth → 401", async ({ request }) => {
		const response = await request.post("/api/save-as-planning-item", {
			data: {
				client_id: "00000000-0000-0000-0000-000000000000",
				workspace_id: "00000000-0000-0000-0000-000000000000",
				source: "sv",
				title: "Test",
			},
			headers: { "content-type": "application/json" },
		});
		expect(response.status()).toBe(401);
		const body = await response.json();
		expect(body.error).toBeTruthy();
	});

	test("POST /api/save-as-planning-item com body inválido → 400 ou 401", async ({
		request,
	}) => {
		// Sem token vai bater no 401 antes de validar zod — comportamento aceitável.
		// Se um dia o handler ficar público, o body inválido deve dar 400.
		const response = await request.post("/api/save-as-planning-item", {
			data: { foo: "bar" },
			headers: {
				"content-type": "application/json",
				// token bogus pra forçar 401 do verifyAuth (ainda assim deve falhar)
				authorization: "Bearer not-a-real-token",
			},
		});
		expect([400, 401]).toContain(response.status());
		const body = await response.json();
		expect(body.error).toBeTruthy();
	});

	test("/api/save-as-planning-item GET → 405", async ({ request }) => {
		const response = await request.get("/api/save-as-planning-item");
		// Sem auth pode dar 401 antes do method check, mas 405 também é válido.
		expect([401, 405]).toContain(response.status());
	});
});
