/**
 * OffscreenSlideRenderer — renderiza TODOS os slides em scale=1 (1080×1350)
 * num container fora da tela. Usado pra captura PNG/PDF/ZIP em qualidade
 * Instagram-ready (não depende do scale do preview).
 */

import { useEffect } from "react";
import { TemplateSlide } from "./TemplateSlide";
import { CANVAS_H, CANVAS_W, type ViralCarousel } from "./types";

interface OffscreenSlideRendererProps {
  carousel: ViralCarousel;
  /** Recebe os refs por slideId — usados pelo exportCarousel. */
  registerRef: (slideId: string, node: HTMLDivElement | null) => void;
  /** Reescreve URL da imagem (proxy CORS opcional). Não usado pelos templates portados — eles têm `resolveImgSrc` próprio. */
  rewriteImageUrl?: (url: string) => string;
}

export function OffscreenSlideRenderer({
  carousel,
  registerRef,
}: OffscreenSlideRendererProps) {
  useEffect(() => {
    return () => {
      carousel.slides.forEach((s) => registerRef(s.id, null));
    };
  }, [carousel.slides, registerRef]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: CANVAS_W,
        height: CANVAS_H,
        transform: "translate(-100000px, -100000px)",
        pointerEvents: "none",
        opacity: 0,
        zIndex: -1,
      }}
    >
      {carousel.slides.map((slide) => (
        <div
          key={slide.id}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: CANVAS_W,
            height: CANVAS_H,
          }}
        >
          <TemplateSlide
            ref={(n) => registerRef(slide.id, n)}
            templateId={carousel.template}
            slide={slide}
            profile={carousel.profile}
            totalSlides={carousel.slides.length}
            scale={1}
            exportMode
          />
        </div>
      ))}
    </div>
  );
}
