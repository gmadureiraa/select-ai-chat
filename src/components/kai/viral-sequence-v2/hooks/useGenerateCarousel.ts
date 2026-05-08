/**
 * useGenerateCarousel — chama o handler `generate-viral-carousel` do KAI
 * pra produzir os slides via Gemini Flash.
 *
 * O handler do KAI recebe:
 *   { clientId, briefing, tone, slideCount, profile, persistAs: 'none' | 'carousel' | ... }
 *
 * Diferente do standalone (que tem /api/generate Pro com 3 variações),
 * o KAI roda single-shot por enquanto. Slides retornam só com `body` —
 * o renderer faz split heading/body via heurística **bold**.
 */

import { useCallback, useState } from "react";
import { apiInvoke } from "@/lib/apiInvoke";
import type { ViralProfile, ViralSlide } from "../types";

export interface GenerationError extends Error {
  status?: number;
  code?: string;
  retryAfterSec?: number;
}

export interface GenerateCarouselInput {
  clientId: string;
  briefing: string;
  tone?: string;
  slideCount?: number;
  profile?: ViralProfile;
  /** Tom adicional contextual (ex: "editorial, direto, em pt-br"). */
  language?: "pt-br" | "en";
}

export interface GenerateCarouselResult {
  slides: ViralSlide[];
  title: string;
  profile: ViralProfile;
}

export function useGenerateCarousel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (input: GenerateCarouselInput): Promise<GenerateCarouselResult> => {
      setError(null);
      setLoading(true);
      try {
        const { data, error: invokeErr } = await apiInvoke<{
          ok?: boolean;
          slides?: any[];
          profile?: ViralProfile;
          title?: string;
          error?: string;
        }>("generate-viral-carousel", {
          body: {
            clientId: input.clientId,
            briefing: input.briefing,
            tone: input.tone,
            slideCount: input.slideCount ?? 8,
            profile: input.profile,
            persistAs: "none", // não salva — UI controla quando salvar
            source: "manual",
          },
        });
        if (invokeErr) {
          const e = new Error(invokeErr.message) as GenerationError;
          e.status = invokeErr.status;
          throw e;
        }
        if (!data?.ok && data?.error) {
          throw new Error(data.error);
        }
        const rawSlides = (data?.slides ?? []) as any[];
        if (!rawSlides.length) throw new Error("Nenhum slide retornado");

        // Normaliza pro formato v2 (heading + body separados via **bold** heurística).
        const slides: ViralSlide[] = rawSlides.map((s, i) => {
          const body = String(s.body ?? "");
          let heading = "";
          let cleanBody = body;
          const m = body.match(/^\*\*([^*]+)\*\*\s*\n+([\s\S]+)$/);
          if (m) {
            heading = m[1].trim();
            cleanBody = m[2].trim();
          } else if (/^\*\*([^*]+)\*\*\s*$/.test(body.trim())) {
            heading = body.trim().replace(/^\*\*|\*\*$/g, "");
            cleanBody = "";
          }
          return {
            id: s.id ?? `slide_${Math.random().toString(36).slice(2, 10)}`,
            order: s.order ?? i + 1,
            heading,
            body: cleanBody,
            imageQuery: heading || cleanBody.slice(0, 60),
            image:
              s.image && s.image.kind && s.image.kind !== "none"
                ? s.image
                : { kind: "none" as const },
          };
        });

        return {
          slides,
          title: data?.title ?? input.briefing.slice(0, 60),
          profile: data?.profile ?? input.profile ?? { name: "", handle: "" },
        };
      } catch (err) {
        let msg = err instanceof Error ? err.message : "Erro ao gerar carrossel.";
        if (
          err instanceof Error &&
          (err.name === "TimeoutError" || err.name === "AbortError" || msg.toLowerCase().includes("timeout"))
        ) {
          msg = "A geração demorou demais. Tente um briefing mais curto ou aguarde alguns minutos.";
        }
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { generate, loading, error };
}
