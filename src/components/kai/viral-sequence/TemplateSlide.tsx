/**
 * TemplateSlide — adapter que renderiza um slide usando QUALQUER um dos
 * 8 templates portados de gmadureiraa/sequencia-viral.
 *
 * Mapeia (ViralSlide + ViralProfile + templateId) → SlideProps esperado
 * pelos componentes em ./templates.
 */

import { forwardRef } from "react";
import { TemplateRenderer } from "./templates";
import type { TemplateId } from "./templates/types";
import type { ViralProfile, ViralSlide } from "./types";

interface TemplateSlideProps {
  templateId: TemplateId;
  slide: ViralSlide;
  profile: ViralProfile;
  totalSlides: number;
  scale?: number;
  textScale?: number;
  exportMode?: boolean;
  /** Estilo (white/dark) — default white. */
  style?: "white" | "dark";
}

export const TemplateSlide = forwardRef<HTMLDivElement, TemplateSlideProps>(
  function TemplateSlide(
    { templateId, slide, profile, totalSlides, scale = 0.32, textScale = 1, exportMode = false, style = "white" },
    ref,
  ) {
    const imageUrl =
      slide.image.kind === "none" || slide.image.kind === "skip"
        ? undefined
        : slide.image.url;

    // Os templates portados aceitam heading + body separados. Nossos slides
    // novos (padrão Madureira) usam só `body`, com **bold** no início pra
    // simular heading. Detecta esse padrão e separa pra preservar tipografia.
    let heading = slide.heading?.trim() ?? "";
    let body = slide.body ?? "";
    if (!heading) {
      const m = body.match(/^\*\*([^*]+)\*\*\s*\n+([\s\S]+)$/);
      if (m) {
        heading = m[1].trim();
        body = m[2].trim();
      } else if (/^\*\*([^*]+)\*\*\s*$/.test(body.trim())) {
        heading = body.trim().replace(/^\*\*|\*\*$/g, "");
        body = "";
      }
    }

    return (
      <TemplateRenderer
        ref={ref}
        templateId={templateId}
        heading={heading}
        body={body}
        imageUrl={imageUrl}
        slideNumber={slide.order}
        totalSlides={totalSlides}
        profile={{
          name: profile.name || "Seu nome",
          handle: profile.handle || "@handle",
          photoUrl: profile.avatarUrl || "",
        }}
        style={style}
        isLastSlide={slide.order === totalSlides}
        scale={scale}
        textScale={textScale}
        exportMode={exportMode}
      />
    );
  },
);
