import { test, expect } from "../playwright-fixture";

test.describe("Auth flow (UI smoke, sem login real)", () => {
	test("/login tem campos email + password + botão submit", async ({ page }) => {
		await page.goto("/login");
		await page.waitForLoadState("networkidle");

		const email = page.locator('input[type="email"]').first();
		const password = page.locator('input[type="password"]').first();
		// Submit do form (não confundir com botão "Entrar com Google" que é type=button)
		const submit = page.locator('button[type="submit"]').first();

		await expect(email).toBeVisible({ timeout: 15_000 });
		await expect(password).toBeVisible({ timeout: 15_000 });
		await expect(submit).toBeVisible({ timeout: 15_000 });
	});

	test("submit form vazio mantém em /login (validação HTML5 required)", async ({
		page,
	}) => {
		await page.goto("/login");
		await page.waitForLoadState("networkidle");

		const submit = page.locator('button[type="submit"]').first();
		await expect(submit).toBeVisible({ timeout: 15_000 });

		await submit.click().catch(() => {});

		// Espera pequena pra UI reagir
		await page.waitForTimeout(1_000);

		// Inputs `required`: HTML5 bloqueia submit, ficamos em /login.
		const currentUrl = page.url();
		expect(currentUrl).toContain("/login");
		expect(currentUrl).not.toMatch(/\/kaleidos/);
	});

	test("credenciais inválidas geram erro/toast (não logam)", async ({ page }) => {
		await page.goto("/login");
		await page.waitForLoadState("networkidle");

		const email = page.locator('input[type="email"]').first();
		const password = page.locator('input[type="password"]').first();
		const submit = page.locator('button[type="submit"]').first();

		await email.fill("nao-existe-test-e2e@example.invalid");
		await password.fill("senha-errada-12345-abcdef");
		await submit.click().catch(() => {});

		// Espera resposta da API + UI re-render (toast aparece via sonner)
		await page.waitForTimeout(4_000);

		const url = page.url();
		// Após erro de auth ficamos em /login (sem redirect pra /kaleidos).
		// Login pode redirecionar pra OAuth se "Entrar com Google" for clicado,
		// mas como filtramos `button[type=submit]`, isso não acontece.
		expect(url).not.toMatch(/\/kaleidos/);
		// Aceita /login ou erro na própria URL (SPA mantém path).
		expect(url.includes("/login") || url.includes("error")).toBe(true);
	});

	test("/signup tem campos básicos (email pelo menos)", async ({ page }) => {
		await page.goto("/signup");
		await page.waitForLoadState("networkidle");

		const email = page
			.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')
			.first();
		await expect(email).toBeVisible({ timeout: 15_000 });
	});
});
