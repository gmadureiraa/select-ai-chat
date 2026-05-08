/**
 * ScriptCard — bloco principal do roteiro adaptado:
 *   - Título
 *   - Hook destacado (com botão copiar)
 *   - Roteiro completo em texto corrido (com teleprompter)
 *   - Storyboard cena por cena
 *   - Caption sugerida
 *   - Notas de produção
 */

import { useState } from "react";
import { Check, Copy, Play, Quote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AdaptedScript } from "../types";
import { StoryboardScene } from "./StoryboardScene";
import { Teleprompter } from "./Teleprompter";

interface Props {
  script: AdaptedScript;
}

export function ScriptCard({ script }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);

  function handleCopy(label: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copiado`);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Título + Hook */}
      <div className="rounded-lg border border-border bg-card p-6 md:p-8">
        <div className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold mb-3">
          ✦ Seu novo reel · roteiro adaptado
        </div>
        <h2 className="text-3xl md:text-4xl font-semibold leading-tight mb-6">
          {script.titulo}
        </h2>

        {/* Hook destacado */}
        <div className="rounded-md border border-border bg-foreground text-background p-5 flex items-start gap-3">
          <Quote className="h-6 w-6 shrink-0 text-primary mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-mono uppercase tracking-wider text-primary font-bold mb-1.5">
              Hook · 0–3s · O que você fala no primeiro segundo
            </div>
            <p className="text-xl md:text-2xl italic font-semibold leading-snug">
              "{script.hook}"
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handleCopy("Hook", script.hook)}
            className="shrink-0 h-8 text-[10px]"
          >
            {copied === "Hook" ? (
              <Check className="h-3 w-3 mr-1" />
            ) : (
              <Copy className="h-3 w-3 mr-1" />
            )}
            {copied === "Hook" ? "Copiado" : "Copiar"}
          </Button>
        </div>

        {/* Roteiro completo */}
        <div className="mt-6">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
              Roteiro completo · texto corrido
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setTeleprompterOpen(true)}
                className="h-8 text-[10px]"
              >
                <Play className="h-3 w-3 mr-1" />
                Teleprompter
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopy("Roteiro", script.roteiroCompleto)}
                className="h-8 text-[10px]"
              >
                {copied === "Roteiro" ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                {copied === "Roteiro" ? "Copiado" : "Copiar tudo"}
              </Button>
            </div>
          </div>
          <pre className="rounded-md border border-border bg-background p-4 text-sm leading-relaxed whitespace-pre-wrap break-words m-0 font-sans">
            {script.roteiroCompleto}
          </pre>
        </div>
      </div>

      {/* Storyboard */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold">
              Storyboard · {script.scenes.length} cenas
            </div>
            <h3 className="text-xl md:text-2xl font-semibold leading-tight mt-1">
              Cena por <em>cena</em>. Pra gravar direto.
            </h3>
          </div>
        </div>
        <div className="space-y-3">
          {script.scenes.map((scene) => (
            <StoryboardScene key={scene.n} scene={scene} />
          ))}
        </div>
      </div>

      {/* Caption + Notas */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
              ✦ Caption sugerida
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopy("Caption", script.captionSugerida)}
              className="h-7 text-[10px]"
            >
              {copied === "Caption" ? (
                <Check className="h-3 w-3 mr-1" />
              ) : (
                <Copy className="h-3 w-3 mr-1" />
              )}
              {copied === "Caption" ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-line m-0">
            {script.captionSugerida}
          </p>
        </div>

        {script.notasProducao?.length > 0 && (
          <div className="rounded-md border border-border bg-muted/30 p-5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold mb-3">
              Notas de produção
            </div>
            <ul className="space-y-3">
              {script.notasProducao.map((nota, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed">
                  <span className="text-[10px] font-mono font-bold text-primary shrink-0 pt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {nota}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Teleprompter
        text={script.roteiroCompleto}
        open={teleprompterOpen}
        onClose={() => setTeleprompterOpen(false)}
      />
    </div>
  );
}
