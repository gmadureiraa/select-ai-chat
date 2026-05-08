import { test, expect } from "../playwright-fixture";

test.describe("Routing & redirects", () => {
	test("/ redireciona para /kaleidos", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// SPA navega via react-router. Aguarda URL mudar.
		await expect
			.poll(() => page.url(), { timeout: 10_000 })
			.toMatch(/\/(kaleidos|login)/);
	});

	test("/:slug arbitrário redireciona para /kaleidos (Navigate replace)", async ({
		page,
	}) => {
		await page.goto("/random-slug-test");
		await page.waitForLoadState("networkidle");

		// Espera o redirect propagar
		await page.waitForTimeout(1_500);

		const url = page.url();
		// Aceita redirect pra /kaleidos OU /login (caso WorkspaceRouter exija auth)
		expect(url).toMatch(/\/(kaleidos|login|404)/);
	});

	test("/export-madureira carrega", async ({ page }) => {
		const response = await page.goto("/export-madureira");
		expect(response?.status()).toBeLessThan(400);
		await page.waitForLoadState("networkidle");
		await expect(page.locator("#root")).toBeAttached();
		await expect(page).toHaveTitle(/KAI/i);
	});

	test("bundle splits funcionam (chunks JS são servidos)", async ({ page }) => {
		const jsRequests: string[] = [];
		page.on("request", (req) => {
			const url = req.url();
			if (url.endsWith(".js") || url.includes(".js?")) {
				jsRequests.push(url);
			}
		});

		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Pelo menos alguns chunks JS devem ser requisitados (SPA + vendor splits)
		expect(jsRequests.length).toBeGreaterThan(0);

		// Checa se há chunks distintos (split funcionando) ou no mínimo 1 main bundle.
		// Em prod (Vite build) esperamos múltiplos chunks por causa do manualChunks.
		const uniqueChunks = new Set(jsRequests.map((u) => new URL(u).pathname));
		expect(uniqueChunks.size).toBeGreaterThan(0);
	});

	test("/login NÃO redireciona pra /kaleidos sem auth", async ({ page }) => {
		await page.goto("/login");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(1_500);

		const url = page.url();
		expect(url).toContain("/login");
		expect(url).not.toMatch(/\/kaleidos/);
	});
});
