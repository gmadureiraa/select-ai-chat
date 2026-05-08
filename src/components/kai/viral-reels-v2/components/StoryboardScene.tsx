/**
 * StoryboardScene — card individual de uma cena no storyboard.
 * Mostra número, tempo, papel narrativo, visual + copy + b-roll.
 */

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Scene, ScenePapel } from "../types";

const PAPEL_LABELS: Record<ScenePapel, string> = {
  hook: "HOOK",
  promessa: "PROMESSA",
  demo: "DEMO",
  prova: "PROVA",
  transicao: "TRANSIÇÃO",
  cta: "CTA",
};

const PAPEL_VARIANTS: Record<ScenePapel, "default" | "secondary" | "destructive" | "outline"> = {
  hook: "destructive",
  promessa: "default",
  demo: "secondary",
  prova: "secondary",
  transicao: "outline",
  cta: "destructive",
};

export function StoryboardScene({ scene }: { scene: Scene }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(scene.copy);
    setCopied(true);
    toast.success(`Cena ${scene.n} copiada`);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid gap-0 grid-cols-[60px_1fr] rounded-md border border-border bg-card overflow-hidden">
      {/* Número da cena */}
      <div className="flex flex-col items-center justify-center bg-muted py-4 border-r border-border">
        <div className="text-2xl font-semibold italic leading-none">
          {String(scene.n).padStart(2, "0")}
        </div>
        <div className="text-[8px] font-mono font-bold tracking-wider opacity-70 mt-1.5">
          CENA
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono">
              {scene.tempo}
            </Badge>
            <Badge variant={PAPEL_VARIANTS[scene.papel]} className="text-[10px] font-mono">
              {PAPEL_LABELS[scene.papel]}
            </Badge>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 text-[10px]"
          >
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Copiado" : "Copiar copy"}
          </Button>
        </div>

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground font-bold mb-1">
              Visual
            </div>
            <p className="text-xs leading-relaxed">{scene.visual}</p>
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-wider text-primary font-bold mb-1">
              Copy · O que você fala
            </div>
            <p className="text-sm italic leading-snug font-medium">"{scene.copy}"</p>
          </div>
        </div>

        {scene.broll && (
          <div className="mt-3 pt-3 border-t border-border">
            <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
              B-roll ·{" "}
            </span>
            <span className="text-xs text-muted-foreground">{scene.broll}</span>
          </div>
        )}
      </div>
    </div>
  );
}
