/**
 * Tipos da Sequência Viral dentro do KAI.
 * Canvas Instagram 4:5 (1080 × 1350 px).
 *
 * Template Twitter padrão Madureira: layout único por slide (header + body
 * + imagem opcional abaixo). Sem variantes de capa/editorial/overlay.
 */

export const CANVAS_W = 1080;
export const CANVAS_H = 1350;

export type ViralTemplateId = "twitter"; // MVP: só twitter

export type ImageSource =
  | { kind: "none" }
  | { kind: "ai"; prompt: string; url: string }
  | { kind: "search"; query: string; url: string; attribution?: string; sourceUrl?: string }
  | { kind: "upload"; url: string; filename?: string };

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
   * heading+body separados. O loader concatena no body se encontrar.
   */
  heading?: string;
  image: ImageSource;
  /**
   * @deprecated Removido no padrão Madureira (single layout). Campos
   * antigos de carrosséis salvos serão ignorados pelo render.
   */
  imageAsCover?: boolean;
  /** @deprecated Removido — sem mais variantes de capa. */
  coverTextStyle?: unknown;
  /** @deprecated Removido — sem mais layout editorial. */
  editorial?: unknown;
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
 * Também limpa campos legados de capa.
 */
export function migrateSlide(s: ViralSlide): ViralSlide {
  let next = s;
  if (s.heading && s.heading.trim()) {
    const heading = s.heading.trim();
    const body = s.body?.trim() ?? "";
    const merged = body
      ? `**${heading.replace(/\*\*/g, "")}**\n\n${body}`
      : `**${heading.replace(/\*\*/g, "")}**`;
    next = { ...next, heading: undefined, body: merged };
  }
  // Limpa campos deprecated (sem mudar a forma do objeto persistido).
  if (next.imageAsCover || next.coverTextStyle || next.editorial) {
    next = { ...next, imageAsCover: undefined, coverTextStyle: undefined, editorial: undefined };
  }
  return next;
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
