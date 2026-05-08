/**
 * OffscreenSlideRenderer — renderiza todos os slides em scale=1 (1080×1350)
 * fora da tela. Usado APENAS pra captura de PNG/PDF/ZIP em qualidade
 * Instagram, sem afetar layout visível.
 */

import { useEffect } from "react";
import { CANVAS_W, CANVAS_H, type ViralCarousel } from "../types";
import { SlideRenderer } from "./SlideRenderer";

interface OffscreenSlideRendererProps {
  carousel: ViralCarousel;
  registerRef: (slideId: string, node: HTMLDivElement | null) => void;
}

export function OffscreenSlideRenderer({ carousel, registerRef }: OffscreenSlideRendererProps) {
  // Cleanup refs on unmount
  useEffect(() => {
    return () => {
      for (const s of carousel.slides) registerRef(s.id, null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: CANVAS_W,
        height: CANVAS_H,
        opacity: 0,
        pointerEvents: "none",
        zIndex: -1,
      }}
      aria-hidden="true"
    >
      {carousel.slides.map((slide) => (
        <div
          key={slide.id}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <SlideRenderer
            ref={(n: HTMLDivElement | null) => registerRef(slide.id, n)}
            templateId={carousel.template}
            slide={slide}
            profile={carousel.profile}
            totalSlides={carousel.slides.length}
            scale={1}
            exportMode={true}
          />
        </div>
      ))}
    </div>
  );
}
