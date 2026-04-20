/**
 * KAI Stream Protocol — eventos SSE tipados entre `kai-simple-chat` edge function
 * e o hook `useKAISimpleChat` no front.
 *
 * Extende o schema OpenAI-compatible (`{choices:[{delta:{...}}]}`) adicionando
 * campos novos em `delta`. Clients antigos que só lêem `delta.content` continuam
 * funcionando; clients novos interpretam os campos adicionais.
 *
 * Philosophy:
 *   - Texto streamado pelo LLM → `delta.content`
 *   - Imagens geradas pelo LLM → `delta.image`
 *   - LLM está executando uma tool (indicador leve p/ UI) → `delta.tool_running`
 *   - Tool produziu um card renderizável no chat → `delta.action_card`
 *   - Erro global irrecuperável → `delta.error`
 *   - Fim do stream → `[DONE]`
 *
 * Tools que só alimentam o LLM com contexto (getClientContext, searchLibrary,
 * getMetrics) NÃO emitem action_card — seu resultado é consumido internamente
 * pelo LLM pra continuar a resposta. Só tools com efeito visível ao usuário
 * (createContent, publishNow, scheduleFor, connectAccount) emitem cards.
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

/** Dados tipados por `type` do card (discriminated union). */
export type KAIActionCardData =
  | KAIDraftCardData
  | KAIPublishedCardData
  | KAIScheduledCardData
  | KAIConnectAccountCardData
  | KAIMetricCardData
  | KAILibraryMatchCardData
  | KAIErrorCardData;

export interface KAIDraftCardData {
  kind: "draft";
  clientId: string;
  platform: string; // instagram | twitter | linkedin | ...
  format: string; // post | carousel | reel | thread | ...
  title?: string;
  body: string; // texto principal do post
  hashtags?: string[];
  mediaUrls?: string[];
  briefing?: string; // a pergunta original do user resumida
}

export interface KAIPublishedCardData {
  kind: "published";
  clientId: string;
  platform: string;
  externalUrl?: string; // link do post na rede social
  publishedAt: string; // ISO
  body: string; // texto publicado (snapshot)
  mediaUrls?: string[];
}

export interface KAIScheduledCardData {
  kind: "scheduled";
  clientId: string;
  platform: string;
  scheduledFor: string; // ISO
  body: string;
  mediaUrls?: string[];
  planningItemId: string;
}

export interface KAIConnectAccountCardData {
  kind: "connect_account";
  platform: string;
  oauthUrl: string;
  reason: string; // mensagem human-friendly
}

export interface KAIMetricCardData {
  kind: "metric";
  clientId: string;
  platform?: string;
  period: string; // "últimos 7 dias" etc
  summary: string; // 1-2 frases
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

export interface KAIActionCard {
  id: string; // uuid do planning_item OU id temporário (client gera optimistic update)
  planning_item_id?: string | null;
  type: KAIActionCardType;
  status: KAIActionCardStatus;
  data: KAIActionCardData;
  created_at?: string;
  updated_at?: string;
  /**
   * Se `true`, o card exige confirmação humana antes da ação final.
   * Ex: DraftCard pending_approval = sim; PublishedCard done = não.
   */
  requires_approval?: boolean;
  /**
   * Ações disponíveis pro usuário neste card. O front renderiza botões a partir disso.
   * Ex: [{ id:"approve", label:"Aprovar e publicar", variant:"primary" }, ...]
   */
  available_actions?: KAICardAction[];
}

export interface KAICardAction {
  id: string;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  /** Quando clicada, o front chama de volta o edge com tool={name, args} */
  tool_call?: { name: string; args: Record<string, unknown> };
  /** Ou dispara uma ação client-side (edit mode, copy, expand…) */
  client_action?: "edit" | "copy" | "expand" | "cancel_undo";
}

/** Indicador leve "🔧 Gerando rascunho..." antes do card aparecer. */
export interface KAIToolRunning {
  id: string; // id da chamada
  name: string; // nome da tool
  label?: string; // texto human-friendly "Gerando rascunho de Instagram..."
}

/** Shape de UM evento SSE emitido pelo servidor. */
export interface KAIStreamDelta {
  /** Texto streamado do LLM (como hoje). */
  content?: string;
  /** URL de imagem gerada (como hoje). */
  image?: string;
  /** Tool em execução — UI mostra badge/spinner. */
  tool_running?: KAIToolRunning;
  /** Card renderizável no chat — cria novo OU atualiza existente (match por id). */
  action_card?: KAIActionCard;
  /** Erro irrecuperável — encerra o stream. */
  error?: string;
}

/** Envelope SSE (compatível com OpenAI). */
export interface KAIStreamChunk {
  choices: [
    {
      delta: KAIStreamDelta;
      index?: number;
      finish_reason?: "stop" | "tool_calls" | "error" | null;
    },
  ];
  /** Id da mensagem do assistant (persistente). Presente em todos chunks. */
  id?: string;
}

/** Tipo utilitário — resultado de executar uma tool no server. */
export interface KAIToolResult<TData = unknown> {
  ok: boolean;
  /** Dados retornados pro LLM usar no próximo turno. */
  data?: TData;
  /** Se a tool produziu um card renderizável, vai aqui. */
  card?: KAIActionCard;
  /** Se falhou. */
  error?: string;
}
