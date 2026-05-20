
import { forwardRef } from "react";
import TemplateTwitter from "./template-twitter";
import TemplateDefiversoImageBG from "./template-defiverso-imagebg";
import TemplateMadureiraMinimal from "./template-madureira-minimal";
import type {
  SlideProps,
  TemplateId,
  TemplateMeta,
  SlideVariantName,
} from "./types";

export type {
  SlideProps,
  TemplateId,
  TemplateMeta,
  SlideVariantName,
} from "./types";

/**
 * Orchestrator — escolhe o template certo baseado em `templateId`.
 * Repassa ref e todas as props de `SlideProps` pro componente alvo.
 *
 * 2026-05-19 — Limpeza: TODOS os templates foram arquivados em `_archive/`
 * (ver _archive/README.md / git log). Só Twitter + defiverso-imagebg ativos.
 * IDs antigos caem no default e renderizam como Twitter (retrocompat de
 * carrosseis salvos).
 *
 * TODO recovery (qual cliente usava cada template arquivado):
 *  - manifesto        → genérico (capa editorial cinemático)
 *  - futurista        → genérico (tech-lean, legado)
 *  - autoral          → genérico (zine, legado)
 *  - ambitious        → genérico (motivacional foto moody)
 *  - blank            → genérico (editorial educativo, Playfair)
 *  - bohdan           → genérico (design-forward B&W lime)
 *  - paper-mono       → MADUREIRA (tobi.the.og confessional)
 *  - serif-duelo      → MADUREIRA (tinnaloaiza auditoria)
 *  - madureira        → MADUREIRA (capa IA dominante navy/verde)
 *  - madureira-reflection → MADUREIRA (texto-puro 7 layouts)
 *  - madureira-dark   → MADUREIRA (Fraunces 55 + Geist 35) ⭐ ativo recente
 *  - dsec-dark        → DSEC (deprecated antes da limpeza)
 *  - defiverso-carrossel    → DEFIVERSO (verde profundo + cream)
 *  - defiverso-cripto-dark  → DEFIVERSO (dark + alien CTA) ⭐ ativo recente
 *
 * Templates ATIVOS:
 *  - twitter            → genérico (tweet screenshot, default)
 *  - defiverso-imagebg  → DEFIVERSO ⭐ NOVO (2026-05-19) — imagem-fundo
 *    full-bleed + Aston Serif 72 + frame cream + alien CTA
 *  - madureira-minimal  → MADUREIRA ⭐ NOVO (2026-05-19) — preto puro +
 *    frame branco polaroid + Fraunces italic 56 + Geist 21/35 +
 *    3 modos (capa emoji / texto puro / imagem)
 */
export const TemplateRenderer = forwardRef<
  HTMLDivElement,
  SlideProps & { templateId: TemplateId }
>(function TemplateRenderer({ templateId, ...rest }, ref) {
  switch (templateId) {
    case "defiverso-imagebg":
      return <TemplateDefiversoImageBG ref={ref} {...rest} />;
    case "madureira-minimal":
      return <TemplateMadureiraMinimal ref={ref} {...rest} />;
    case "twitter":
    default:
      // Todos os IDs antigos caem aqui (retrocompat).
      return <TemplateTwitter ref={ref} {...rest} />;
  }
});

/**
 * Metadados pra picker de template na UI. Twitter (genérico) +
 * defiverso-imagebg (Defiverso) aparecem pra novos carrosseis. Os antigos
 * continuam funcionando porque `TemplateRenderer` faz fallback pra Twitter.
 */
/**
 * Variações internas de cada template ATIVO. O editor (edit.tsx) lê esse mapa
 * pra renderizar o seletor "Variante do slide" com APENAS as variações que o
 * template ativo realmente sabe renderizar — em vez de uma lista genérica fixa.
 *
 * Cada `id` precisa existir em `SlideVariantName` (templates/types.ts) e ser
 * lido pelo template alvo. Hoje:
 *  - twitter            → layout único (tweet). Sem variantes de layout.
 *  - defiverso-imagebg  → cover / inner / cta (ver CoverSlide/InnerSlide/CtaSlide)
 *  - madureira-minimal  → cover / inner / cta
 *
 * `inner` é o default das páginas internas (qualquer slide do meio). Os
 * templates tratam "tudo que não for cover/cta" como inner, então passar
 * `variant: "inner"` explicitamente força o layout interno mesmo no slide 1
 * ou no último.
 */
export const TEMPLATE_VARIANTS: Record<
  TemplateId,
  { id: SlideVariantName; label: string }[]
> = {
  twitter: [{ id: "tweet", label: "Tweet" }],
  "defiverso-imagebg": [
    { id: "cover", label: "Capa" },
    { id: "inner", label: "Página" },
    { id: "cta", label: "CTA" },
  ],
  "madureira-minimal": [
    { id: "cover", label: "Capa" },
    { id: "inner", label: "Página" },
    { id: "cta", label: "CTA" },
  ],
  // IDs legados (arquivados → fallback Twitter). Layout único.
  manifesto: [{ id: "tweet", label: "Tweet" }],
  futurista: [{ id: "tweet", label: "Tweet" }],
  autoral: [{ id: "tweet", label: "Tweet" }],
  ambitious: [{ id: "tweet", label: "Tweet" }],
  blank: [{ id: "tweet", label: "Tweet" }],
  bohdan: [{ id: "tweet", label: "Tweet" }],
  "paper-mono": [{ id: "tweet", label: "Tweet" }],
  "serif-duelo": [{ id: "tweet", label: "Tweet" }],
  madureira: [{ id: "tweet", label: "Tweet" }],
  "madureira-reflection": [{ id: "tweet", label: "Tweet" }],
  "madureira-dark": [{ id: "tweet", label: "Tweet" }],
  "dsec-dark": [{ id: "tweet", label: "Tweet" }],
  "defiverso-carrossel": [{ id: "tweet", label: "Tweet" }],
  "defiverso-cripto-dark": [{ id: "tweet", label: "Tweet" }],
};

/**
 * Default de variant por POSIÇÃO no carrossel: slide 1 = capa, último = cta,
 * meio = inner. Usado quando o template tem variantes (cover/inner/cta) e o
 * slide ainda não tem variant explícito. Templates de layout único ignoram.
 */
export function defaultVariantForPosition(
  templateId: TemplateId,
  index: number,
  total: number,
): SlideVariantName {
  const opts = TEMPLATE_VARIANTS[templateId] ?? [];
  const ids = opts.map((o) => o.id);
  if (ids.length <= 1) return ids[0] ?? "tweet";
  if (index === 0 && ids.includes("cover")) return "cover";
  if (index === total - 1 && ids.includes("cta")) return "cta";
  if (ids.includes("inner")) return "inner";
  return ids[0];
}

export const TEMPLATES_META: TemplateMeta[] = [
  {
    id: "twitter",
    name: "Twitter",
    kicker: "Nº 01 · SCREENSHOT",
    palette: ["#FFFFFF", "#1D9BF0", "#0A0A0A"],
  },
  {
    id: "defiverso-imagebg",
    name: "Defiverso ImageBG",
    kicker: "Nº 02 · CRIPTO BR",
    palette: ["#0A0908", "#7CF067", "#FFFFFF"],
  },
  {
    id: "madureira-minimal",
    name: "Madureira Minimal",
    kicker: "Nº 03 · POLAROID B&W",
    palette: ["#000000", "#FFFFFF", "#FFFFFF"],
  },
];

export { TemplateTwitter, TemplateDefiversoImageBG, TemplateMadureiraMinimal };
