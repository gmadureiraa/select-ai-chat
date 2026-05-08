/**
 * useReelAnalysis — orquestra a chamada `apiInvoke('adapt-viral-reel', ...)`
 * e mantém estado de loading + erro. Retorna um helper `runAdapt` que recebe
 * o brief completo e dispara a geração.
 *
 * O handler do KAI (`api/_handlers/adapt-viral-reel.ts`) já persiste em
 * `viral_reels` e devolve `{ ok, reelId, analysis, script, sourceMeta }`.
 * O hook não toca DB direto — quem refresca a lista é `useReelHistory`.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { apiInvoke } from "@/lib/apiInvoke";
import type { AdaptBrief, AdaptResponse } from "../types";
import { isValidInstagramUrl } from "../lib/utils";

export interface AdaptRunInput extends AdaptBrief {
  clientId: string;
}

export type AdaptStep = "idle" | "loading" | "result" | "error";

export function useReelAnalysis() {
  const [step, setStep] = useState<AdaptStep>("idle");
  const [result, setResult] = useState<AdaptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAdapt = useCallback(async (input: AdaptRunInput) => {
    if (!isValidInstagramUrl(input.sourceUrl)) {
      const msg = "Cola um link de Reel/post Instagram válido";
      toast.error(msg);
      setError(msg);
      return null;
    }
    if ((input.tema?.trim().length ?? 0) < 3) {
      const msg = "Descreve o tema do TEU vídeo (mínimo 3 chars)";
      toast.error(msg);
      setError(msg);
      return null;
    }
    if ((input.cta?.trim().length ?? 0) < 2) {
      const msg = "Define o CTA — o que o user vai fazer?";
      toast.error(msg);
      setError(msg);
      return null;
    }

    setStep("loading");
    setError(null);
    setResult(null);

    try {
      const { data, error: invokeError } = await apiInvoke<AdaptResponse>(
        "adapt-viral-reel",
        {
          body: {
            clientId: input.clientId,
            sourceUrl: input.sourceUrl.trim(),
            tema: input.tema.trim(),
            objetivo: input.objetivo,
            cta: input.cta.trim(),
            persona: input.persona?.trim() || undefined,
            nicho: input.nicho?.trim() || undefined,
          },
        },
      );

      if (invokeError) throw new Error(invokeError.message);
      if (!data?.ok) throw new Error((data as any)?.error ?? "Falha desconhecida");

      setResult(data);
      setStep("result");
      toast.success("Roteiro gerado!");
      return data;
    } catch (err: any) {
      const msg = err?.message ?? "Erro ao gerar roteiro";
      toast.error(msg);
      setError(msg);
      setStep("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStep("idle");
    setResult(null);
    setError(null);
  }, []);

  return { step, result, error, runAdapt, reset, setResult, setStep };
}
