/**
 * Sequência Viral v2 — types portados do standalone (gmadureiraa/sequencia-viral)
 * adaptados pra rodar dentro do KAI (Vite + React 18 + Supabase/Neon).
 *
 * Diferença chave do legacy `viral-sequence/types.ts`:
 *   - Suporta o fluxo completo: briefing → variações → templates → edit → preview
 *   - Mantém heading + body separados (legacy padronizou em só body com **bold**)
 *   - Suporta variantes de slide (cover/headline/photo/quote/split/cta...)
 *   - Suporta layers e bgColor por slide
 *
 * Canvas Instagram 4:5 = 1080 × 1350 px.
 */

export const CANVAS_W = 1080;
export const CANVAS_H = 1350;

/**
 * IDs dos 8 templates visuais portados.
 * Carrosséis legados sem templateId caem no default "twitter".
 */
export type ViralTemplateId =
  | "manifesto"
  | "futurista"
  | "autoral"
  | "twitter"
  | "ambitious"
  | "blank"
  | "bohdan"
  | "paper-mono";

export type SlideVariant =
  | "cover"
  | "headline"
  | "photo"
  | "quote"
  | "split"
  | "cta"
  // Novas variantes BrandsDecoded overhaul (2026-04-22)
  | "solid-brand"
  | "text-only"
  | "full-photo-bottom";

export interface SlideLayers {
  title: boolean;
  body: boolean;
  bg: boolean;
}

export type ImageSource =
  | { kind: "none" }
  | { kind: "skip" } // marcado explicitamente como "sem imagem"
  | { kind: "ai"; prompt: string; url: string }
  | { kind: "search"; query: string; url: string; attribution?: string; sourceUrl?: string }
  | { kind: "upload"; url: string; filename?: string };

export function getImageUrl(image: ImageSource): string | undefined {
  if (image.kind === "none" || image.kind === "skip") return undefined;
  return image.url;
}

export interface ViralSlide {
  id: string;
  order: number;
  /**
   * Headline curta (até ~80 chars) — usada como título visual no template.
   * Quando ausente, body inteiro vira título.
   */
  heading?: string;
  /**
   * Texto principal do slide (até ~280 chars).
   * Suporta `**bold**` inline pra destacar termos.
   */
  body: string;
  /**
   * Query de busca de imagem por slide. Usado pelo auto-fill pra puxar do Pexels.
   */
  imageQuery?: string;
  image: ImageSource;
  variant?: SlideVariant;
  /** Override de cor de fundo por slide. */
  bgColor?: string;
  /** Toggle de camadas visíveis. Default: todas true. */
  layers?: SlideLayers;
  /**
   * Marca que o auto-fill tentou N vezes gerar/buscar imagem e falhou.
   * Não persiste no DB (só runtime).
   */
  imageFailed?: boolean;
}

export interface ViralProfile {
  name: string;
  handle: string; // inclui @
  avatarUrl?: string;
}

export type ViralCarouselStatus = "draft" | "ready" | "published";

export type ViralStep =
  | "briefing"
  | "variations"
  | "templates"
  | "edit"
  | "preview";

export interface ViralCarousel {
  id: string;
  clientId: string;
  workspaceId?: string;
  title: string;
  template: ViralTemplateId;
  slides: ViralSlide[];
  profile: ViralProfile;
  briefing?: string;
  tone?: string;
  language?: "pt-br" | "en";
  caption?: string;
  status: ViralCarouselStatus;
  step?: ViralStep;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConcept {
  title: string;
  hook: string;
  style: string;
  angle: string;
}

export interface CreateVariation {
  title: string;
  style: "data" | "story" | "provocative";
  slides: ViralSlide[];
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Factories
 * ──────────────────────────────────────────────────────────────────────────── */

export function emptySlide(order: number): ViralSlide {
  return {
    id: `slide_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`,
    order,
    heading: "",
    body: "",
    image: { kind: "none" },
  };
}

export function emptyCarousel(
  clientId: string,
  profile: ViralProfile,
  slideCount = 8,
): ViralCarousel {
  const count = Math.max(1, Math.min(20, slideCount));
  const now = new Date().toISOString();
  return {
    id: `car_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
    clientId,
    title: count === 1 ? "Novo post" : "Novo carrossel",
    template: "twitter",
    slides: Array.from({ length: count }).map((_, i) => emptySlide(i + 1)),
    profile,
    status: "draft",
    step: "briefing",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Migra rascunho antigo (heading-only ou body-only) pro formato novo.
 * Safe pra rodar em qualquer slide.
 */
export function migrateSlide(s: ViralSlide): ViralSlide {
  let next: ViralSlide = { ...s };
  if (!next.heading) next.heading = "";
  if (!next.body) next.body = "";
  // Remove camadas legacy se presentes mas inválidas
  if ((next as any).imageAsCover) delete (next as any).imageAsCover;
  if ((next as any).coverTextStyle) delete (next as any).coverTextStyle;
  if ((next as any).editorial) delete (next as any).editorial;
  return next;
}
