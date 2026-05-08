// Master cron: dispara todos os scrapes do Radar em paralelo via fetch interno.
// Encaixa em Hobby plan (1 cron diário) chamando os 6 scrapes individuais sob demanda.
//
// Pattern fire-and-forget: dispara as requests e retorna 200 imediato. Vercel
// continua rodando os handlers individuais em background. Se algum falhar,
// errors são logados mas master cron sempre retorna ok.
//
// 2 fases:
//   1. GLOBAL — scraper roda sem client_id (fontes globais, todos os planos consomem)
//   2. PER-CLIENT — pra cada client com plano Pro+ ativo, dispara scraper com ?client_id=<uuid>
//
// Fase E (Radar per-client) — passar client_id como query param permite que cada
// cron-scrape-* filtre apenas as fontes daquele cliente.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../_lib/db.js";

const SCRAPERS = [
  "cron-scrape-news",
  "cron-scrape-instagram",
  "cron-scrape-tiktok",
  "cron-scrape-twitter",
  "cron-scrape-threads",
  "cron-scrape-linkedin",
] as const;

interface ProClient {
  id: string;
  workspace_id: string;
}

interface TriggerResult {
  handler: string;
  scope: "global" | "client";
  client_id?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isCron =
    req.headers["x-vercel-cron"] === "1" ||
    req.headers["authorization"] === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers.host;
  const baseUrl = `${proto}://${host}`;
  const cronSecret = process.env.CRON_SECRET || "";

  // Lista clientes ativos (com Pro+ plan ativo)
  let proClients: ProClient[] = [];
  try {
    proClients = await query<ProClient>(
      `SELECT c.id, c.workspace_id
         FROM clients c
         JOIN workspace_subscriptions ws ON ws.workspace_id = c.workspace_id
         JOIN subscription_plans sp ON sp.id = ws.plan_id
        WHERE sp.type IN ('pro', 'enterprise')
          AND ws.status = 'active'
        ORDER BY c.created_at DESC
        LIMIT 100`,
    );
  } catch (err: any) {
    // Não falhar — segue só com global se a query der erro (ex: schema diff)
    console.warn("[cron-master] failed to fetch pro clients:", err?.message);
    proClients = [];
  }

  const triggered: TriggerResult[] = [];
  const errors: { handler: string; scope: string; error: string; client_id?: string }[] = [];

  async function fireScraper(handlerName: string, clientId?: string): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const url = clientId
        ? `${baseUrl}/api/${handlerName}?client_id=${encodeURIComponent(clientId)}`
        : `${baseUrl}/api/${handlerName}`;

      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronSecret}`,
        },
        signal: controller.signal,
      }).catch(() => {
        // ignora — handler pode ter levado mais de 5s, é OK
      });

      clearTimeout(timeout);
      triggered.push(
        clientId
          ? { handler: handlerName, scope: "client", client_id: clientId }
          : { handler: handlerName, scope: "global" },
      );
    } catch (err: any) {
      errors.push({
        handler: handlerName,
        scope: clientId ? "client" : "global",
        client_id: clientId,
        error: err?.message ?? "unknown",
      });
    }
  }

  // 1. Trigger global (fontes sem client_id) — todos os planos
  await Promise.allSettled(SCRAPERS.map((h) => fireScraper(h)));

  // 2. Trigger per-client pra Pro+
  for (const client of proClients) {
    await Promise.allSettled(SCRAPERS.map((h) => fireScraper(h, client.id)));
  }

  return res.status(200).json({
    ok: true,
    triggered_at: new Date().toISOString(),
    pro_clients: proClients.length,
    triggered_count: triggered.length,
    triggered,
    errors,
    note: "Scrapers continuam rodando em background. Verifique DB pra resultados.",
  });
}
