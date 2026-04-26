/**
 * Tipos da Sequência Viral dentro do KAI.
 * Canvas Instagram 4:5 (1080 × 1350 px).
 * Apenas template "Twitter" no MVP.
 */

export const CANVAS_W = 1080;
export const CANVAS_H = 1350;

export type ViralTemplateId = "twitter"; // MVP: só twitter

export type ImageSource =
  | { kind: "none" }
  | { kind: "ai"; prompt: string; url: string }
  | { kind: "search"; query: string; url: string; attribution?: string; sourceUrl?: string }
  | { kind: "upload"; url: string; filename?: string }
  /**
   * Fallback gerado: SVG/CSS gradient renderizado quando RSS não tem imagem.
   * `url` é a data-URL do SVG; `palette` é um nome legível do esquema.
   */
  | { kind: "fallback"; url: string; palette: string; seed: string };

/** Onde o texto sobreposto fica posicionado quando `imageAsCover=true`. */
export type CoverTextPosition = "top" | "center" | "bottom";

/** Tamanho relativo do texto sobreposto à capa. */
export type CoverTextSize = "sm" | "md" | "lg" | "xl";

/** Intensidade do overlay escuro/claro pra garantir contraste. */
export type CoverOverlayStrength = "soft" | "medium" | "strong";

export interface CoverTextStyle {
  size?: CoverTextSize;        // default md
  position?: CoverTextPosition; // default bottom
  spacing?: number;             // line-height multiplier (default 1.2, 1.0–1.6)
  overlay?: CoverOverlayStrength; // default medium
  /** Cor do texto. "auto" calcula baseado no overlay. */
  textColor?: "auto" | "white" | "black";
}

export interface ViralSlide {
  id: string;
  order: number;
  /**
   * Texto do slide — único bloco estilo tweet (até ~280 chars).
   * Suporta **bold** inline pra destacar trechos.
   */
  body: string;
  /**
   * @deprecated Mantido pra migração de rascunhos antigos que tinham
   * heading+body separados. Novos slides usam só `body`. O loader
   * concatena no body se encontrar.
   */
  heading?: string;
  image: ImageSource;
  /**
   * Se true, a imagem cobre o slide inteiro com gradient overlay e o
   * texto fica sobreposto em branco (estilo capa de jornal). Útil pro
   * slide 1 quando há uma imagem forte da notícia.
   */
  imageAsCover?: boolean;
  /** Estilização do texto sobreposto à capa (apenas quando imageAsCover=true). */
  coverTextStyle?: CoverTextStyle;
  /**
   * Layout editorial (capa de jornal) — usado tipicamente no slide 1.
   * Quando `editorial` está preenchido E `imageAsCover=true`, o slide
   * renderiza headline grande + subtitle + crédito ao invés do `body`.
   */
  editorial?: {
    /** Manchete principal (até ~80 chars). */
    headline: string;
    /** Subtítulo / lead da matéria (até ~140 chars). Opcional. */
    subtitle?: string;
    /** Crédito / fonte (ex: "Folha de SP", "Reuters"). Opcional. */
    credit?: string;
    /** Categoria/eyebrow (ex: "MERCADO", "TECNOLOGIA"). Opcional. */
    kicker?: string;
  };
}

export interface ViralProfile {
  name: string;
  handle: string; // inclui @
  avatarUrl?: string;
}

export type ViralCarouselStatus = "draft" | "ready" | "published";

export interface ViralCarousel {
  id: string;
  clientId: string;
  title: string;
  template: ViralTemplateId;
  slides: ViralSlide[];
  profile: ViralProfile;
  briefing?: string; // prompt original que originou a geração
  status: ViralCarouselStatus;
  createdAt: string;
  updatedAt: string;
}

export function emptySlide(order: number): ViralSlide {
  return {
    id: `slide_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`,
    order,
    body: "",
    image: { kind: "none" },
  };
}

/**
 * Migra rascunho antigo (heading + body separados) pro formato novo
 * (só body com **bold** no início). Safe pra rodar em qualquer slide.
 */
export function migrateSlide(s: ViralSlide): ViralSlide {
  if (!s.heading || !s.heading.trim()) return s;
  const heading = s.heading.trim();
  const body = s.body?.trim() ?? "";
  const merged = body
    ? `**${heading.replace(/\*\*/g, "")}**\n\n${body}`
    : `**${heading.replace(/\*\*/g, "")}**`;
  return { ...s, heading: undefined, body: merged };
}

export function emptyCarousel(clientId: string, profile: ViralProfile): ViralCarousel {
  return {
    id: `car_${crypto.randomUUID()}`,
    clientId,
    title: "Novo carrossel",
    template: "twitter",
    slides: Array.from({ length: 8 }).map((_, i) => emptySlide(i + 1)),
    profile,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
