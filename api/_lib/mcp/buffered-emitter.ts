/**
 * Buffered KAIStreamEmitter — capta tudo que uma tool emitiria via SSE e
 * armazena em memória, pra ser retornado num response HTTP request/response
 * (MCP `tools/call`).
 *
 * Tools do KAI Chat geralmente retornam `card` no result e o runner SSE emite
 * pra UI. Mas algumas tools chamam emit.content/emit.actionCard direto
 * (notavelmente o runner; tools individuais quase nunca). Pra ser safe, este
 * emitter implementa toda a interface.
 */
import type {
  KAIActionCard,
  KAIApprovalRequest,
  KAIStreamEmitter,
  KAIToolRunning,
} from '../kai-chat-tools/kai-stream.js';

export interface BufferedEvents {
  content: string[];
  images: string[];
  toolsRunning: KAIToolRunning[];
  actionCards: KAIActionCard[];
  approvalRequests: KAIApprovalRequest[];
  errors: string[];
}

export interface BufferedEmitter extends KAIStreamEmitter {
  events: BufferedEvents;
}

export function createBufferedEmitter(): BufferedEmitter {
  const events: BufferedEvents = {
    content: [],
    images: [],
    toolsRunning: [],
    actionCards: [],
    approvalRequests: [],
    errors: [],
  };

  return {
    events,
    content(text: string) {
      events.content.push(text);
    },
    image(url: string) {
      events.images.push(url);
    },
    toolRunning(running: KAIToolRunning) {
      events.toolsRunning.push(running);
    },
    actionCard(card: KAIActionCard) {
      events.actionCards.push(card);
    },
    approvalRequest(req: KAIApprovalRequest) {
      events.approvalRequests.push(req);
    },
    error(message: string) {
      events.errors.push(message);
    },
    done() {
      /* no-op — buffer is finalized when caller reads events */
    },
    heartbeat() {
      /* no-op */
    },
    startHeartbeat() {
      return () => {
        /* no-op */
      };
    },
  };
}
