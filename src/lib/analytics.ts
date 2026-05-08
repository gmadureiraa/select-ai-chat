import { track } from "@vercel/analytics";

/**
 * Eventos de produto que faz sentido medir no Vercel Analytics.
 * Mantenha a lista enxuta — só eventos que indicam:
 *   1. Ativação (cliente criado, push subscribed)
 *   2. Uso de feature core (carrossel, reel, radar)
 *   3. Receita (subscription started/changed)
 *   4. Colaboração (member invited)
 *   5. Engagement (kai chat)
 *
 * Não tracke navegação genérica ou cliques de UI sem semântica de produto.
 */
export type EventName =
  | "client_created"
  | "carrossel_generated"
  | "reel_analyzed"
  | "radar_brief_opened"
  | "subscription_started"
  | "subscription_changed"
  | "workspace_member_invited"
  | "push_subscribed"
  | "kai_chat_message_sent"
  | "planning_item_created";

type EventProps = Record<string, string | number | boolean>;

/**
 * Wrapper seguro em volta do `track()` do Vercel Analytics.
 *
 * - Falha silenciosa em dev / quando o script não carregou (ex: AdBlock)
 * - Loga warning em dev pra facilitar debug
 * - Sem deps externas além de `@vercel/analytics` (já no bundle)
 */
export function trackEvent(name: EventName, props?: EventProps): void {
  try {
    track(name, props);
  } catch (err) {
    // Analytics indisponível (dev sem domínio Vercel, AdBlock, etc.)
    if (import.meta.env.DEV) {
      console.warn(`[analytics] failed to track "${name}"`, err);
    }
  }
}
