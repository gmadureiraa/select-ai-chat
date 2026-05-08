import { test, expect } from "../playwright-fixture";

test.describe("Performance smoke", () => {
	test("TTFB de / < 3s (margem pra cold start)", async ({ request }) => {
		const start = Date.now();
		const response = await request.get("/");
		const elapsed = Date.now() - start;

		expect(response.status()).toBeLessThan(400);
		// 3s é folgado pra cold start de serverless. Em warm <300ms.
		expect(elapsed).toBeLessThan(3_000);
	});

	test("HTML inicial é leve (< 50KB)", async ({ request }) => {
		const response = await request.get("/");
		const body = await response.body();
		// index.html sem SSR é pequeno (KAI: ~2KB original)
		expect(body.length).toBeLessThan(50_000);
	});

	test("Bundle JS inicial é code-split e abaixo do limite (baseline)", async ({
		page,
	}) => {
		let totalJsBytes = 0;
		const jsResources: { url: string; size: number }[] = [];

		page.on("response", async (response) => {
			const url = response.url();
			const ct = response.headers()["content-type"] || "";
			if (
				(ct.includes("javascript") || url.endsWith(".js")) &&
				response.status() === 200
			) {
				try {
					const body = await response.body();
					totalJsBytes += body.length;
					jsResources.push({ url, size: body.length });
				} catch {
					// alguns chunks podem ser servidos como streams; ignora
				}
			}
		});

		await page.goto("/", { waitUntil: "networkidle" });

		console.log(`Total JS bytes (descomprimido): ${totalJsBytes}`);
		console.log(`Chunks carregados: ${jsResources.length}`);
		console.log(
			`Top 5 chunks:`,
			jsResources
				.sort((a, b) => b.size - a.size)
				.slice(0, 5)
				.map((r) => `${r.size} bytes — ${r.url.split("/").pop()}`),
		);

		// Baseline atual KAI 2.0 (mai/2026): ~4.8MB descomprimido total.
		// Limite de 8MB pra alarmar regressões mas aceitar build atual.
		// Code-splitting funciona se há > 5 chunks distintos.
		expect(totalJsBytes).toBeGreaterThan(0);
		expect(totalJsBytes).toBeLessThan(8_000_000);
		expect(jsResources.length).toBeGreaterThan(3);
	});

	test("DOMContentLoaded < 5s", async ({ page }) => {
		await page.goto("/");

		const timings = await page.evaluate(() => {
			const nav = performance.getEntriesByType(
				"navigation",
			)[0] as PerformanceNavigationTiming;
			return {
				domContentLoaded:
					nav.domContentLoadedEventEnd - nav.fetchStart,
				loadComplete: nav.loadEventEnd - nav.fetchStart,
			};
		});

		console.log(`DOMContentLoaded: ${timings.domContentLoaded}ms`);
		console.log(`Load complete: ${timings.loadComplete}ms`);

		// Margem confortável pra rede + cold start.
		expect(timings.domContentLoaded).toBeLessThan(5_000);
	});

	test("Sem console errors críticos no carregamento de /", async ({ page }) => {
		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(err.message));
		page.on("console", (msg) => {
			if (msg.type() === "error") {
				const text = msg.text();
				// Ignora erros de network esperados (auth, third-party, etc)
				if (
					!/401|403|favicon|fetch.*failed|ResizeObserver/.test(text)
				) {
					errors.push(text);
				}
			}
		});

		await page.goto("/", { waitUntil: "networkidle" });
		await page.waitForTimeout(2_000);

		// Falha apenas em erros realmente quebrantes (TypeError, ReferenceError)
		const critical = errors.filter((e) =>
			/TypeError|ReferenceError|SyntaxError|Cannot read|is not a function/.test(
				e,
			),
		);
		expect(critical, `Erros críticos: ${critical.join("\n")}`).toHaveLength(0);
	});
});
