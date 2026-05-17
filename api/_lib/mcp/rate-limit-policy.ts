/**
 * MCP rate-limit policy.
 *
 * Classifica cada tool por custo/risco e devolve `{limit, windowMs, bucket}`.
 * O bucket name compõe a key Redis junto com identidade (`auth.mode + userId`),
 * pra não misturar service-token de operador com user JWT.
 *
 * Categorias (custo crescente):
 *
 *   - `cheap`    — read-only (list*, get*, search*, query*, fetch*, view*).
 *                  60 req/min. Cobre browsing de UI / dashboards.
 *
 *   - `normal`   — write não-LLM (create*, update*, edit*, save*, add*, set*,
 *                  upload*, import*, schedule*, toggle*, send*, post*, publish*).
 *                  20 req/min. Cobre CRUD comum em planning/automations.
 *
 *   - `expensive`— LLM/generation (generate*, analyze*, transcribe*, brief*,
 *                  research*, reverse*, suggest*, summarize*, extract*,
 *                  caption*, voice*, render*). 5 req/min. Cobre Gemini/Claude
 *                  calls + embeddings.
 *
 *   - `destructive` — delete*, remove*, drop*, destroy*, purge*, clear*,
 *                     reset*, archive*. 3 req/min. Defensivo contra abuse
 *                     coordinado.
 *
 * Tools desconhecidas caem em `normal`. Pra ajustar limites globalmente, mexer
 * só nas constantes do topo.
 */

export type RateBucket = 'cheap' | 'normal' | 'expensive' | 'destructive';

export interface RatePolicy {
  bucket: RateBucket;
  limit: number;
  windowMs: number;
}

const ONE_MINUTE = 60 * 1000;

const POLICIES: Record<RateBucket, RatePolicy> = {
  cheap: { bucket: 'cheap', limit: 60, windowMs: ONE_MINUTE },
  normal: { bucket: 'normal', limit: 20, windowMs: ONE_MINUTE },
  expensive: { bucket: 'expensive', limit: 5, windowMs: ONE_MINUTE },
  destructive: { bucket: 'destructive', limit: 3, windowMs: ONE_MINUTE },
};

// Ordem importa: prefixos mais específicos primeiro. Cada regex casa contra
// `toolName.toLowerCase()`.
const DESTRUCTIVE_RX: RegExp[] = [
  /^delete/,
  /^remove/,
  /^drop/,
  /^destroy/,
  /^purge/,
  /^clear/,
  /^reset/,
  /^archive/,
  /^unlink/,
];

const EXPENSIVE_RX: RegExp[] = [
  /^generate/,
  /^analyze/,
  /^analyse/,
  /^transcribe/,
  /^extract/,
  /^embed/,
  /^research/,
  /^reverse/,
  /^suggest/,
  /^summari[sz]e/,
  /^caption/,
  /^render/,
  /^voice/,
  /^brief/,
  /^scrape/,
  /^fetchnewsletter/,
  /createviralcarousel/,
  /createcontent$/,
  /^enrich/,
  /^classify/,
  /^firecrawl/,
];

const CHEAP_RX: RegExp[] = [
  /^list/,
  /^get/,
  /^search/,
  /^query/,
  /^fetch/, // mais permissivo que expensive — ver ordem abaixo
  /^view/,
  /^read/,
  /^describe/,
  /^find/,
  /^count/,
  /^check/,
  /^ping/,
  /^echo/,
];

// Padrão "normal" (write barato, sem LLM)
const NORMAL_RX: RegExp[] = [
  /^create/,
  /^update/,
  /^edit/,
  /^save/,
  /^add/,
  /^set/,
  /^upload/,
  /^import/,
  /^schedule/,
  /^toggle/,
  /^send/,
  /^post/,
  /^publish/,
  /^assign/,
  /^attach/,
  /^link/,
  /^move/,
  /^reorder/,
  /^star/,
  /^favorite/,
  /^mark/,
  /^rate/,
  /^complete/,
  /^start/,
  /^stop/,
  /^pause/,
  /^resume/,
];

/**
 * Classifica uma tool pelo nome. Ordem:
 *  1. destructive (delete/remove/etc) — sempre vence
 *  2. expensive (LLM/IO caro)
 *  3. cheap (read-only)
 *  4. normal (write barato)
 *  5. fallback default → normal
 */
export function classifyTool(toolName: string): RatePolicy {
  const name = toolName.toLowerCase();

  if (DESTRUCTIVE_RX.some((rx) => rx.test(name))) {
    return POLICIES.destructive;
  }
  if (EXPENSIVE_RX.some((rx) => rx.test(name))) {
    return POLICIES.expensive;
  }
  if (CHEAP_RX.some((rx) => rx.test(name))) {
    return POLICIES.cheap;
  }
  if (NORMAL_RX.some((rx) => rx.test(name))) {
    return POLICIES.normal;
  }
  return POLICIES.normal;
}

/**
 * Monta a key Redis pra rate-limit MCP. Inclui:
 *  - bucket (cheap/normal/expensive/destructive)
 *  - auth mode (service vs user) — isola pools
 *  - identidade (userId quando disponível, senão "anonymous-<mode>")
 *
 * O scope prefix `mcp:<bucket>` permite cachear o limiter Upstash por bucket
 * sem explodir o cache map.
 */
export function buildRateKey(opts: {
  bucket: RateBucket;
  authMode: 'service' | 'user';
  userId: string | null;
  workspaceId?: string | null;
}): string {
  const identity = opts.userId || opts.workspaceId || `anon-${opts.authMode}`;
  return `mcp:${opts.bucket}:${opts.authMode}:${identity}`;
}
