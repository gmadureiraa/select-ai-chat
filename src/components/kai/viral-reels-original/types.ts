/**
 * Schema canônico de um roteiro adaptado pelo Reels Viral.
 *
 * Port literal de code/reels-viral/lib/types.ts.
 *
 * Fluxo: Apify → metadata + videoUrl → Gemini transcreve + analisa →
 * gera novo roteiro adaptado ao briefing do user → retorna esse JSON.
 */

export type Objetivo = "leads" | "produto" | "seguidores" | "engajamento";

export interface AdaptBrief {
  /** URL do Reel viral de referência (Instagram). */
  sourceUrl: string;
  /**
   * Tema do vídeo do USER. Ex: "ferramenta de IA pra design", "newsletter
   * de cripto", "consultoria fitness". Diferença narrativa principal.
   */
  tema: string;
  objetivo: Objetivo;
  /**
   * CTA do user. Ex: "comenta APP", "clica no link da bio", "manda DM".
   */
  cta: string;
  /** Persona (opcional) — quem é o público alvo. */
  persona?: string;
  /** Nicho do user — ajuda na adaptação. */
  nicho?: string;
}

export interface SourceMeta {
  shortCode?: string;
  url?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  caption?: string;
  videoDuration?: number;
  views?: number;
  plays?: number;
  likes?: number;
  comments?: number;
  videoPlayCount?: number;
  likesCount?: number;
  commentsCount?: number;
  publishedAt?: string;
  timestamp?: string;
  videoUrl?: string;
  displayUrl?: string;
  /**
   * Transcrição literal do áudio falado do reel ORIGINAL (PT-BR ou idioma
   * da fala). Vazio quando o reel é só visual/musical. Stash dentro de
   * source_meta pra não exigir migration de schema.
   */
  originalTranscript?: string | null;
}

export interface SourceAnalysis {
  /** Resumo de 1 linha do conteúdo do reel original. */
  resumo: string;
  /** Por que isso viralizou — 2-3 razões concretas. */
  porQueViralizou: string[];
  /** Estrutura desmontada do roteiro original. */
  estrutura: {
    hook: { texto: string; tempo: string };
    promessa: { texto: string; tempo: string };
    demonstracao: { texto: string; tempo: string };
    provaSocial: { texto: string; tempo: string };
    cta: { texto: string; tempo: string };
  };
  /** Padrões transferíveis pra qualquer nicho. */
  padroesTransferiveis: string[];
}

export type ScenePapel =
  | "hook"
  | "promessa"
  | "demo"
  | "prova"
  | "transicao"
  | "cta";

export interface Scene {
  /** Número da cena (1-indexed). */
  n: number;
  /** Range temporal da cena no roteiro adaptado, ex: "00:00–00:03". */
  tempo: string;
  /** Função narrativa: hook, promessa, demo, prova, transição, cta. */
  papel: ScenePapel;
  /** Visual: o que aparece em tela. */
  visual: string;
  /** Copy: texto falado / overlay text. */
  copy: string;
  /** B-roll necessário pra gravar essa cena. */
  broll?: string;
}

export interface AdaptedScript {
  /** Título sugerido pro novo Reel (sem hashtags). */
  titulo: string;
  /** Hook completo (0-3s) — o que o user fala primeiro. */
  hook: string;
  /** Roteiro completo em texto corrido pra leitura/colar. */
  roteiroCompleto: string;
  /** Storyboard cena por cena. */
  scenes: Scene[];
  /** Caption sugerida pro post. */
  captionSugerida: string;
  /** Notas de produção: dicas pra gravar bem. */
  notasProducao: string[];
}

export interface AdaptResponse {
  ok?: boolean;
  reelId?: string;
  /** Source standalone usa `source` direto. KAI handler retorna `sourceMeta`.
   *  MainApp consome ambos via fallback. */
  source?: SourceMeta;
  sourceMeta?: SourceMeta;
  analysis: SourceAnalysis;
  script: AdaptedScript;
  /** Transcrição literal do áudio do reel ORIGINAL (referência). */
  originalTranscript?: string | null;
  /** Tempo total da geração em ms. */
  durationMs?: number;
  /** ID do script persistido (DB) — opcional. */
  scriptId?: string | null;
  /** Quando true, o handler reaproveitou um reel já analisado <24h. */
  cached?: boolean;
}

/**
 * Linha viva da tabela `viral_reels` — o que vem do supabase quando
 * carregamos o histórico.
 */
export interface ReelRow {
  id: string;
  source_url: string;
  source_short_code: string | null;
  tema: string;
  objetivo: string;
  cta: string;
  persona: string | null;
  nicho: string | null;
  source_meta: SourceMeta | null;
  analysis: SourceAnalysis | null;
  script: AdaptedScript | null;
  status: "pending" | "processing" | "done" | "error";
  error_message: string | null;
  created_at: string;
}
