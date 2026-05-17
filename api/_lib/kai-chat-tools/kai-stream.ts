/**
 * KAI Stream Protocol — Node port of supabase/functions/_shared/kai-stream.ts
 *
 * Differences from Deno version:
 *   - Writes to a Vercel `res` (Node ServerResponse) directly via res.write()
 *     instead of enqueing into a ReadableStreamDefaultController.
 *   - `crypto.randomUUID()` works under Node 20+ runtime on Vercel.
 */
import type { VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';

export type KAIActionCardType =
  | 'draft'
  | 'published'
  | 'scheduled'
  | 'connect_account'
  | 'metric'
  | 'library_match'
  | 'error';

export type KAIActionCardStatus =
  | 'pending_approval'
  | 'executing'
  | 'done'
  | 'error'
  | 'cancelled';

export interface KAIDraftCardData {
  kind: 'draft';
  clientId: string;
  platform: string;
  format: string;
  title?: string;
  body: string;
  hashtags?: string[];
  mediaUrls?: string[];
  briefing?: string;
  [key: string]: unknown;
}

export interface KAIPublishedCardData {
  kind: 'published';
  clientId: string;
  platform: string;
  externalUrl?: string;
  publishedAt: string;
  body: string;
  mediaUrls?: string[];
}

export interface KAIScheduledCardData {
  kind: 'scheduled';
  clientId: string;
  platform: string;
  scheduledFor: string;
  body: string;
  mediaUrls?: string[];
  planningItemId: string;
}

export interface KAIConnectAccountCardData {
  kind: 'connect_account';
  platform: string;
  oauthUrl: string;
  reason: string;
}

export interface KAIMetricCardData {
  kind: 'metric';
  clientId: string;
  platform?: string;
  period: string;
  summary: string;
  chart?: { labels: string[]; series: { name: string; values: number[] }[] };
  kpis?: { label: string; value: string; delta?: string }[];
}

export interface KAILibraryMatchCardData {
  kind: 'library_match';
  clientId: string;
  matches: { id: string; title: string; snippet: string; url?: string }[];
}

export interface KAIErrorCardData {
  kind: 'error';
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
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  tool_call?: { name: string; args: Record<string, unknown> };
  client_action?: 'edit' | 'copy' | 'expand' | 'cancel_undo';
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

/**
 * Approval request inline (espelha api/_lib/approval-flow.ts). Mantido aqui
 * pra evitar import circular dentro do módulo de stream — qualquer mudança
 * no shape precisa ser refletida nos dois lugares (e em src/types/kai-stream.ts).
 */
export interface KAIApprovalRequest {
  requiresApproval: true;
  action: string;
  preview: {
    title: string;
    description: string;
    impactedItems?: Array<{ id: string; label: string }>;
    irreversible?: boolean;
  };
  callbackToken: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  expiresAt: string;
}

export interface KAIStreamDelta {
  content?: string;
  image?: string;
  tool_running?: KAIToolRunning;
  action_card?: KAIActionCard;
  /** Tool pediu confirmação humana antes de seguir — UI deve abrir modal. */
  approval_request?: KAIApprovalRequest;
  error?: string;
}

export interface KAIToolResult<TData = unknown> {
  ok: boolean;
  data?: TData;
  card?: KAIActionCard;
  error?: string;
}

export interface KAIStreamEmitter {
  content(text: string): void;
  image(url: string): void;
  toolRunning(running: KAIToolRunning): void;
  actionCard(card: KAIActionCard): void;
  approvalRequest(req: KAIApprovalRequest): void;
  error(message: string): void;
  done(): void;
  heartbeat(): void;
  startHeartbeat(intervalMs?: number): () => void;
}

/**
 * Cria um emitter que escreve direto no res (Vercel Node).
 * Caller é responsável por setar headers SSE antes (Content-Type, etc.).
 */
export function createKAIEmitter(res: VercelResponse): KAIStreamEmitter {
  let closed = false;
  const safeWrite = (chunk: string) => {
    if (closed || res.writableEnded) return;
    try {
      res.write(chunk);
    } catch (err) {
      closed = true;
      console.warn('[kai-stream] write falhou (cliente desconectou):', (err as Error).message);
    }
  };

  const send = (delta: KAIStreamDelta) => {
    const chunk = { choices: [{ delta, index: 0 }] };
    safeWrite(`data: ${JSON.stringify(chunk)}\n\n`);
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
    approvalRequest(req: KAIApprovalRequest) {
      send({ approval_request: req });
    },
    error(message: string) {
      send({ error: message });
    },
    done() {
      safeWrite(`data: [DONE]\n\n`);
      closed = true;
    },
    heartbeat() {
      safeWrite(`: keepalive ${Date.now()}\n\n`);
    },
    startHeartbeat(intervalMs = 10_000) {
      const id = setInterval(() => {
        if (closed || res.writableEnded) {
          clearInterval(id);
          return;
        }
        safeWrite(`: keepalive ${Date.now()}\n\n`);
      }, intervalMs);
      return () => clearInterval(id);
    },
  };
}

export function newToolCallId(): string {
  return `call_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function newActionCardId(): string {
  return `card_${randomUUID()}`;
}
