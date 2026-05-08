import { test, expect } from "../playwright-fixture";

test.describe("Public pages", () => {
	test("home (/) responde 200 e SPA mounta", async ({ page }) => {
		const response = await page.goto("/");
		expect(response?.status()).toBeLessThan(400);

		// SPA tem div#root e <title> contendo "KAI"
		await expect(page).toHaveTitle(/KAI/i);
		await expect(page.locator("#root")).toBeAttached();
	});

	test("/login carrega com formulário", async ({ page }) => {
		const response = await page.goto("/login");
		expect(response?.status()).toBeLessThan(400);
		await expect(page).toHaveTitle(/KAI/i);

		// Espera a página de login mountar (form ou pelo menos input de email)
		await page.waitForLoadState("networkidle");
		const emailInput = page.locator(
			'input[type="email"], input[name="email"], input[placeholder*="email" i]',
		);
		const passwordInput = page.locator(
			'input[type="password"], input[name="password"]',
		);

		await expect(emailInput.first()).toBeVisible({ timeout: 15_000 });
		await expect(passwordInput.first()).toBeVisible({ timeout: 15_000 });
	});

	test("/signup carrega", async ({ page }) => {
		const response = await page.goto("/signup");
		expect(response?.status()).toBeLessThan(400);
		await expect(page).toHaveTitle(/KAI/i);
		await page.waitForLoadState("networkidle");
		await expect(page.locator("#root")).toBeAttached();
	});

	test("/404 mostra NotFound", async ({ page }) => {
		const response = await page.goto("/404");
		// Pode ser 200 (SPA) com conteúdo NotFound
		expect(response?.status()).toBeLessThan(500);
		await page.waitForLoadState("networkidle");

		const body = await page.textContent("body");
		expect(body?.toLowerCase()).toMatch(/404|not.?found|não encontrad|nao encontrad/);
	});

	test("rota inexistente cai no NotFound (catch-all)", async ({ page }) => {
		const response = await page.goto("/this-page-does-not-exist-xyz-12345");
		expect(response?.status()).toBeLessThan(500);
		await page.waitForLoadState("networkidle");

		const body = await page.textContent("body");
		// Aceita NotFound OU redirect pra /kaleidos (Route /:slug -> Navigate)
		const url = page.url();
		const isNotFound = /404|not.?found|não encontrad|nao encontrad/i.test(
			body || "",
		);
		const redirectedToKaleidos = /\/kaleidos/.test(url);
		expect(isNotFound || redirectedToKaleidos).toBe(true);
	});

	test("/api/mcp-reader retorna JSON (catalog ou 401 unauth)", async ({ request }) => {
		const response = await request.get("/api/mcp-reader");
		const status = response.status();

		// Endpoint requer MCP_ACCESS_TOKEN bearer; sem token devolve 401.
		// Se MCP_ACCESS_TOKEN não estiver setado em prod, retorna catalog 200.
		expect([200, 401]).toContain(status);

		const contentType = response.headers()["content-type"] || "";
		expect(contentType).toMatch(/application\/json/i);

		const body = await response.json();
		if (status === 200) {
			expect(body).toHaveProperty("tools");
			expect(Array.isArray(body.tools)).toBe(true);
			expect(body.tools.length).toBeGreaterThan(0);
		} else {
			// 401 deve trazer mensagem
			expect(body).toHaveProperty("error");
		}
	});
});
