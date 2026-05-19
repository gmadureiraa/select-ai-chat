
import { forwardRef } from "react";
import TemplateTwitter from "./template-twitter";
import TemplateDefiversoImageBG from "./template-defiverso-imagebg";
import TemplateMadureiraMinimal from "./template-madureira-minimal";
import type { SlideProps, TemplateId, TemplateMeta } from "./types";

export type { SlideProps, TemplateId, TemplateMeta } from "./types";

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
