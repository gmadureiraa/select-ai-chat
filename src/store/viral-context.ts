/**
 * Cross-app bridge store entre os 3 viral apps (Sequência Viral / Reels Viral
 * / Radar Viral) que vivem como tabs independentes dentro do KAI shell.
 *
 * Use cases:
 *  - User no Radar clica "→ Carrossel" num card de notícia. O card chama
 *    `setPendingBriefing({ source: 'radar', topic, briefing, url })` e
 *    navega `?tab=viral-carrossel`. O SV monta, lê `consumePendingBriefing()`
 *    no useEffect inicial, popula o textarea e exibe toast "Briefing trazido
 *    do Radar".
 *  - Mesmo fluxo de Reels para SV (após análise → "Virar Carrossel").
 *  - "Salvar como ideia" continua sendo handled pelo CrossAppActions com toast
 *    e (Fase C) cria planning_item.
 *
 * Por que Zustand e não query params: o SV usa hash routing interno
 * (`#/dashboard`, `#/create`) — não dá pra confiar 100% em search params
 * sobreviverem aos navigates internos. Estado in-memory + consume-once é
 * mais confiável e não vaza briefing no histórico do navegador.
 */

import { create } from "zustand";

export type ViralBridgeSource =
  | "radar"
  | "reels"
  | "sv"
  | "manual"
  | "library"
  | "kai-chat";

export interface PendingBriefingPayload {
  source: ViralBridgeSource;
  /** Título / tema curto do conteúdo de origem. */
  topic?: string;
  /** Texto completo do briefing (resumo, script, caption). */
  briefing?: string;
  /** URL canônica da fonte (artigo, post IG, reel, etc). */
  url?: string;
  /**
   * Bag livre pra o consumer pegar campos específicos sem alargar a interface
   * (platform pré-selecionada no SV, reel_id pra link-back, source_id pra
   * analytics, etc).
   */
  metadata?: Record<string, unknown>;
}

export type PendingBriefing = PendingBriefingPayload | null;

interface ViralContextState {
  pendingBriefing: PendingBriefing;
  setPendingBriefing: (b: PendingBriefing) => void;
  /**
   * Lê e zera. Idempotent: chamadas subsequentes retornam null. O target
   * (SV, Reels) chama isso uma vez no mount e ignora o resultado se for
   * `source === 'sv'` (ou outra mesma origem) pra evitar loops.
   */
  consumePendingBriefing: () => PendingBriefing;
}

export const useViralContext = create<ViralContextState>((set, get) => ({
  pendingBriefing: null,
  setPendingBriefing: (b) => set({ pendingBriefing: b }),
  consumePendingBriefing: () => {
    const b = get().pendingBriefing;
    if (b) set({ pendingBriefing: null });
    return b;
  },
}));
