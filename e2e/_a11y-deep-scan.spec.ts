/**
 * Deep scan local — usado pra coletar todas violations (incl. best-practice
 * e wcag2aaa) na auditoria inicial. NÃO roda em CI por padrão.
 *
 * Uso:
 *   bunx vite preview --port 4173 &
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 \
 *     bunx playwright test e2e/_a11y-deep-scan.spec.ts --reporter=list
 *
 * O underscore-prefix protege de rodar acidentalmente em CI quando
 * existe glob/regex que pega apenas `e2e/<num>-*.spec.ts`.
 */
import { test } from "../playwright-fixture";
import AxeBuilder from "@axe-core/playwright";
import type { Result } from "axe-core";

const TAGS = [
	"wcag2a",
	"wcag2aa",
	"wcag21a",
	"wcag21aa",
	"best-practice",
] as const;

function format(violations: Result[]): string {
	return violations
		.map((v) => {
			const head = `[${v.impact ?? "?"}] ${v.id} (${v.nodes.length} nodes)\n  ${v.help}\n  ${v.helpUrl}`;
			const samples = v.nodes
				.slice(0, 2)
				.map(
					(n) =>
						`    target: ${n.target.join(" ")}\n    html: ${n.html.slice(0, 240)}`,
				)
				.join("\n");
			return `${head}\n${samples}`;
		})
		.join("\n\n");
}

const ROUTES = ["/login", "/signup", "/random-nonexistent-xyz", "/offline"];

for (const route of ROUTES) {
	test(`deep-scan ${route}`, async ({ page }) => {
		await page.goto(route);
		await page.waitForLoadState("networkidle");

		const results = await new AxeBuilder({ page })
			.withTags([...TAGS])
			.analyze();

		// eslint-disable-next-line no-console
		console.log(
			`\n========== ${route} ==========\nTotal violations: ${results.violations.length}\n${format(results.violations)}\n`,
		);
	});
}
