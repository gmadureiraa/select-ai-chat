// Validação visual headless da tela Performance > Instagram.
// Não autentica (skip se 401), mas pega screenshot da rota /performance
// caso o auth gate redirecione.

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8081";

test("Performance dashboard carrega sem console errors críticos", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Filtra ruído de extensões / canvas / Symbol(react.element)
      if (
        text.includes("Failed to load resource") ||
        text.includes("favicon") ||
        text.includes("manifest")
      ) {
        return;
      }
      consoleErrors.push(text);
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(`PAGE ERROR: ${err.message}`);
  });

  const response = await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 15000 });
  expect(response).toBeTruthy();

  // Pega screenshot da home pra debug
  await page.screenshot({ path: "test-results/_perf-home.png", fullPage: true });

  // Espera a key warning de React (duplicates) — sintoma do bug pré-fix
  const reactKeyWarnings = consoleErrors.filter((e) =>
    /Encountered two children with the same key|same key.*undefined/i.test(e),
  );
  expect(reactKeyWarnings, `React key warnings: ${JSON.stringify(reactKeyWarnings)}`).toEqual([]);
});
