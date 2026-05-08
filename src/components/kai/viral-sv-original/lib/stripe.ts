/**
 * Stub: Stripe é só servidor. No KAI integrado, billing fica fora do
 * viral-sv-original. Reexportamos pricing.ts (constantes públicas) pra
 * que `import { PLANS } from "@sv/lib/stripe"` continue funcionando.
 *
 * `stripe` exportado é null — qualquer caller server-side já está em
 * `api/_handlers/` que tem seu próprio client.
 */
export * from "./pricing";

export const stripe = null as unknown as {
  // shape mínimo pra typecheck — fields tipados como any pq stub server-only.
  customers: any;
  subscriptions: any;
  checkout: any;
  webhooks: any;
};
