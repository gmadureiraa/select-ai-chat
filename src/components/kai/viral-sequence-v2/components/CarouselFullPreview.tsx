/**
 * CarouselFullPreview — modal full-screen com navegação slide-a-slide.
 *
 * Atalhos: ← → pra navegar, Esc pra fechar.
 */

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SlideRenderer } from "./SlideRenderer";
import type { ViralCarousel } from "../types";

interface CarouselFullPreviewProps {
  carousel: ViralCarousel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CarouselFullPreview({ carousel, open, onOpenChange }: CarouselFullPreviewProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(carousel.slides.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, carousel.slides.length]);

  const current = carousel.slides[index];
  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[820px] p-0 gap-0 bg-neutral-950 border-neutral-800 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-neutral-800">
          <div className="text-sm text-neutral-300 font-mono">
            Preview · {index + 1}/{carousel.slides.length}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-neutral-300 hover:bg-neutral-800"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative flex items-center justify-center p-6 bg-neutral-900 min-h-[600px]">
          <Button
            variant="ghost"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 p-0 rounded-full bg-neutral-800/80 text-white hover:bg-neutral-700"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <SlideRenderer
            templateId={carousel.template}
            slide={current}
            profile={carousel.profile}
            totalSlides={carousel.slides.length}
            scale={0.5}
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 p-0 rounded-full bg-neutral-800/80 text-white hover:bg-neutral-700"
            disabled={index === carousel.slides.length - 1}
            onClick={() => setIndex((i) => Math.min(carousel.slides.length - 1, i + 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 p-3 border-t border-neutral-800">
          {carousel.slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-sky-400" : "w-2 bg-neutral-600 hover:bg-neutral-500"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
