import { test, expect } from "../playwright-fixture";
import AxeBuilder from "@axe-core/playwright";
import type { Result } from "axe-core";

/**
 * A11y audit usando axe-core.
 *
 * Foco: WCAG 2 nível A + AA, em rotas públicas (sem auth) — login, signup,
 * NotFound, /offline. Páginas autenticadas (Kai workspace) ficam fora do
 * escopo deste arquivo porque exigem login real e dados de workspace.
 *
 * Estes tests são "audit", não "regression". Rodam, logam violations e
 * permitem build a passar enquanto o número de violations estiver abaixo
 * de um threshold defensivo (≤ 20 por página). Reduzir esse limite à
 * medida que fixes forem aplicados.
 */

const TAGS = ["wcag2a", "wcag2aa"] as const;

function summarize(violations: Result[]): string {
	if (violations.length === 0) return "no violations";
	return violations
		.map(
			(v) =>
				`  - [${v.impact ?? "?"}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`,
		)
		.join("\n");
}

test.describe("Acessibilidade WCAG AA", () => {
	test("/login — formulário público de entrada", async ({ page }) => {
		await page.goto("/login");
		await page.waitForLoadState("networkidle");
		// Aguarda Suspense resolver (form de entrada montado)
		await page.locator('input[type="email"]').first().waitFor({ timeout: 15_000 });

		const results = await new AxeBuilder({ page })
			.withTags([...TAGS])
			.analyze();

		// eslint-disable-next-line no-console
		console.log(
			`[a11y] /login violations: ${results.violations.length}\n${summarize(results.violations)}`,
		);
		expect(results.violations.length).toBeLessThan(20);
	});

	test("/signup — formulário público de cadastro", async ({ page }) => {
		await page.goto("/signup");
		await page.waitForLoadState("networkidle");
		await page.locator('input[type="email"]').first().waitFor({ timeout: 15_000 });

		const results = await new AxeBuilder({ page })
			.withTags([...TAGS])
			.analyze();

		// eslint-disable-next-line no-console
		console.log(
			`[a11y] /signup violations: ${results.violations.length}\n${summarize(results.violations)}`,
		);
		expect(results.violations.length).toBeLessThan(20);
	});

	test("/404 — NotFound page", async ({ page }) => {
		// Rota /404 explícita garante que o NotFound (e não o redirect /:slug)
		// seja renderizado.
		await page.goto("/404");
		await page.waitForLoadState("networkidle");
		// Aguarda heading do NotFound — evita auditar o PageLoader fallback
		await page
			.getByRole("heading", { name: /não encontrad/i, level: 1 })
			.waitFor({ timeout: 15_000 });

		const results = await new AxeBuilder({ page })
			.withTags([...TAGS])
			.analyze();

		// eslint-disable-next-line no-console
		console.log(
			`[a11y] /404 violations: ${results.violations.length}\n${summarize(results.violations)}`,
		);
		expect(results.violations.length).toBeLessThan(20);
	});

	test("/offline — fallback PWA", async ({ page }) => {
		await page.goto("/offline");
		await page.waitForLoadState("networkidle");
		await page
			.getByRole("heading", { name: /offline/i, level: 1 })
			.waitFor({ timeout: 15_000 });

		const results = await new AxeBuilder({ page })
			.withTags([...TAGS])
			.analyze();

		// eslint-disable-next-line no-console
		console.log(
			`[a11y] /offline violations: ${results.violations.length}\n${summarize(results.violations)}`,
		);
		expect(results.violations.length).toBeLessThan(20);
	});
});
