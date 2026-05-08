/**
 * useAutoImages — busca imagens stock pra todos os slides em batch.
 *
 * Estratégia: gera 2-4 keywords em inglês via Gemini Flash a partir do
 * briefing + body. Fallback: usa primeiras palavras do body. Pula slides
 * já com imagem ou marcados como "skip".
 */

import { useCallback, useState } from "react";
import { apiInvoke } from "@/lib/apiInvoke";
import { searchImages } from "../lib/imageSearch";
import type { ViralSlide } from "../types";

interface AutoImagesInput {
  briefing: string;
  title: string;
  slides: ViralSlide[];
  /** IDs dos slides a pular (ex: CTA). */
  skipIds?: string[];
}

interface AutoImagesResult {
  updates: { id: string; image: ViralSlide["image"]; query: string }[];
  ok: number;
  failed: number;
}

async function buildSearchQueries(
  briefing: string,
  title: string,
  slides: { id: string; body: string }[],
): Promise<Map<string, string>> {
  const fallback = new Map<string, string>();
  for (const s of slides) {
    const raw = (s.body || briefing || title)
      .replace(/\*\*/g, "")
      .replace(/[#@]/g, "")
      .trim();
    fallback.set(s.id, raw.split(/\s+/).slice(0, 6).join(" ").slice(0, 80));
  }
  if (slides.length === 0) return fallback;

  try {
    const prompt = `Você é um curador de stock photos. Para cada slide abaixo, retorne 2-4 palavras-chave EM INGLÊS que descrevam visualmente o tema (objetos concretos, cenas, atmosferas — NÃO conceitos abstratos). O Pexels rende muito mais resultados em inglês com termos visuais.

CONTEXTO GERAL: ${(briefing || title || "").slice(0, 300)}

SLIDES:
${slides.map((s, i) => `${i + 1}. [id=${s.id}] ${s.body.replace(/\*\*/g, "").slice(0, 200)}`).join("\n")}

Responda APENAS com JSON no formato: {"queries": [{"id": "...", "q": "..."}]}. Nada mais.`;

    const { data, error } = await apiInvoke("kai-chat-stream", {
      body: {
        messages: [{ role: "user", content: prompt }],
        mode: "general",
        stream: false,
        model: "google/gemini-2.5-flash",
      },
    });
    if (error || !data) return fallback;
    const text: string = data?.content || data?.message || data?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]) as { queries?: { id: string; q: string }[] };
    const result = new Map(fallback);
    for (const q of parsed.queries ?? []) {
      if (q.id && q.q?.trim()) result.set(q.id, q.q.trim().slice(0, 80));
    }
    return result;
  } catch (err) {
    console.warn("[useAutoImages] keyword LLM failed, using fallback:", err);
    return fallback;
  }
}

export function useAutoImages() {
  const [loading, setLoading] = useState(false);

  const fillImages = useCallback(
    async (input: AutoImagesInput): Promise<AutoImagesResult> => {
      setLoading(true);
      const skipSet = new Set(input.skipIds ?? []);
      const targets = input.slides.filter(
        (s) => s.image.kind === "none" && !skipSet.has(s.id),
      );

      if (targets.length === 0) {
        setLoading(false);
        return { updates: [], ok: 0, failed: 0 };
      }

      const usedUrls = new Set<string>(
        input.slides
          .map((s) => (s.image.kind === "none" || s.image.kind === "skip" ? null : s.image.url))
          .filter((u): u is string => !!u),
      );

      let ok = 0;
      let failed = 0;
      const updates: AutoImagesResult["updates"] = [];

      try {
        const queries = await buildSearchQueries(
          input.briefing,
          input.title,
          targets.map((s) => ({ id: s.id, body: s.body || s.heading || "" })),
        );

        for (const slide of targets) {
          const query = queries.get(slide.id) || "";
          if (!query) {
            failed += 1;
            continue;
          }
          try {
            const res = await searchImages(query, { perPage: 3, source: "pexels" });
            const item = res.items.find((i) => !usedUrls.has(i.url)) ?? res.items[0];
            if (!item) {
              failed += 1;
              continue;
            }
            usedUrls.add(item.url);
            updates.push({
              id: slide.id,
              query,
              image: {
                kind: "search",
                query,
                url: item.url,
                attribution: item.attribution,
                sourceUrl: item.sourceUrl,
              },
            });
            ok += 1;
          } catch (err) {
            console.error("[useAutoImages] slide failed:", err);
            failed += 1;
          }
        }
        return { updates, ok, failed };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { fillImages, loading };
}
