/**
 * SlideRenderer — adapter que renderiza um slide v2 usando QUALQUER um dos
 * 8 templates portados.
 *
 * Mapeia (ViralSlide + ViralProfile + templateId) → SlideProps esperado
 * pelos componentes em ./templates.
 */

import { forwardRef } from "react";
import { TemplateRenderer } from "../templates";
import type { TemplateId } from "../templates/types";
import { getImageUrl, type ViralProfile, type ViralSlide } from "../types";

interface SlideRendererProps {
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

export const SlideRenderer = forwardRef<HTMLDivElement, SlideRendererProps>(
  function SlideRenderer(
    {
      templateId,
      slide,
      profile,
      totalSlides,
      scale = 0.32,
      textScale = 1,
      exportMode = false,
      style = "white",
    },
    ref,
  ) {
    const imageUrl = getImageUrl(slide.image);

    // Heading + body separados (formato v2). Se vier só body com **bold**
    // no início, faz o split heurístico pra preservar tipografia editorial.
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
        variant={slide.variant}
        bgColor={slide.bgColor}
        layers={slide.layers}
      />
    );
  },
);
