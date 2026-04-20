/**
 * KAI Stream Protocol — helpers pra edge functions emitirem eventos SSE tipados.
 *
 * Tipos espelham `src/types/kai-stream.ts` (duplicação intencional — front e
 * edge não compartilham deps).
 *
 * Uso típico:
 *   const emit = createEmitter(controller, encoder);
 *   emit.content("texto streamado…");
 *   emit.toolRunning({ id: "call_1", name: "createContent", label: "Gerando rascunho…" });
 *   emit.actionCard({ id, type: "draft", status: "pending_approval", data: {...} });
 *   emit.done();
 */

export type KAIActionCardType =
  | "draft"
  | "published"
  | "scheduled"
  | "connect_account"
  | "metric"
  | "library_match"
  | "error";

export type KAIActionCardStatus =
  | "pending_approval"
  | "executing"
  | "done"
  | "error"
  | "cancelled";

export interface KAIDraftCardData {
  kind: "draft";
  clientId: string;
  platform: string;
  format: string;
  title?: string;
  body: string;
  hashtags?: string[];
  mediaUrls?: string[];
  briefing?: string;
}

export interface KAIPublishedCardData {
  kind: "published";
  clientId: string;
  platform: string;
  externalUrl?: string;
  publishedAt: string;
  body: string;
  mediaUrls?: string[];
}

export interface KAIScheduledCardData {
  kind: "scheduled";
  clientId: string;
  platform: string;
  scheduledFor: string;
  body: string;
  mediaUrls?: string[];
  planningItemId: string;
}

export interface KAIConnectAccountCardData {
  kind: "connect_account";
  platform: string;
  oauthUrl: string;
  reason: string;
}

export interface KAIMetricCardData {
  kind: "metric";
  clientId: string;
  platform?: string;
  period: string;
  summary: string;
  chart?: { labels: string[]; series: { name: string; values: number[] }[] };
  kpis?: { label: string; value: string; delta?: string }[];
}

export interface KAILibraryMatchCardData {
  kind: "library_match";
  clientId: string;
  matches: { id: string; title: string; snippet: string; url?: string }[];
}

export interface KAIErrorCardData {
  kind: "error";
  message: string;
  toolName?: string;
  recoverable?: boolean;
}

export type KAIActionCardData =
  | KAIDraftCardData
  | KAIPublishedCardData
  | KAIScheduledCardData
  | KAIConnectAccountCardData
  | KAIMetricCardData
  | KAILibraryMatchCardData
  | KAIErrorCardData;

export interface KAICardAction {
  id: string;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  tool_call?: { name: string; args: Record<string, unknown> };
  client_action?: "edit" | "copy" | "expand" | "cancel_undo";
}

export interface KAIActionCard {
  id: string;
  planning_item_id?: string | null;
  type: KAIActionCardType;
  status: KAIActionCardStatus;
  data: KAIActionCardData;
  created_at?: string;
  updated_at?: string;
  requires_approval?: boolean;
  available_actions?: KAICardAction[];
}

export interface KAIToolRunning {
  id: string;
  name: string;
  label?: string;
}

export interface KAIStreamDelta {
  content?: string;
  image?: string;
  tool_running?: KAIToolRunning;
  action_card?: KAIActionCard;
  error?: string;
}

export interface KAIToolResult<TData = unknown> {
  ok: boolean;
  data?: TData;
  card?: KAIActionCard;
  error?: string;
}

/** Stream emitter — encapsula o encoding SSE. */
export interface KAIStreamEmitter {
  content(text: string): void;
  image(url: string): void;
  toolRunning(running: KAIToolRunning): void;
  actionCard(card: KAIActionCard): void;
  error(message: string): void;
  done(): void;
}

/**
 * Cria um emitter vinculado a um ReadableStreamDefaultController.
 * Cada emit envia uma linha `data: {...}\n\n` no stream.
 */
export function createKAIEmitter(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder = new TextEncoder(),
): KAIStreamEmitter {
  const send = (delta: KAIStreamDelta) => {
    const chunk = {
      choices: [{ delta, index: 0 }],
    };
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
  };

  return {
    content(text: string) {
      send({ content: text });
    },
    image(url: string) {
      send({ image: url });
    },
    toolRunning(running: KAIToolRunning) {
      send({ tool_running: running });
    },
    actionCard(card: KAIActionCard) {
      send({ action_card: card });
    },
    error(message: string) {
      send({ error: message });
    },
    done() {
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
    },
  };
}

/** Helper pra gerar IDs únicos pra tool calls (sem dep externa). */
export function newToolCallId(): string {
  return `call_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** Helper pra gerar IDs únicos pra action cards. */
export function newActionCardId(): string {
  return `card_${crypto.randomUUID()}`;
}
