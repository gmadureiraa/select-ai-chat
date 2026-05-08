/**
 * LoadingPipeline — visual de progresso durante a adaptação do reel.
 * Stages avançam por timer (Apify → CDN → Gemini → ...). Última fase
 * fica em loop até a Promise resolver e o componente desmontar.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

type Stage = { label: string; duration: number | null };

const STAGES: Stage[] = [
  { label: "Puxando o reel via Apify", duration: 6_500 },
  { label: "Baixando o vídeo do CDN", duration: 4_500 },
  { label: "Subindo pro Gemini", duration: 5_000 },
  { label: "Transcrevendo o áudio", duration: 8_000 },
  { label: "Disseccando estrutura", duration: 6_000 },
  { label: "Adaptando ao seu briefing", duration: 8_000 },
  { label: "Finalizando…", duration: null },
];

export function LoadingPipeline() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (stage >= STAGES.length - 1) return;
    const dur = STAGES[stage].duration;
    if (dur === null) return;
    const t = setTimeout(() => setStage((s) => s + 1), dur);
    return () => clearTimeout(t);
  }, [stage]);

  return (
    <div className="rounded-lg border border-border bg-card p-6 md:p-8">
      <div className="flex items-center gap-2 mb-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-xs font-mono uppercase tracking-wider font-bold text-primary">
          REC · Gerando roteiro
        </span>
      </div>

      <h2 className="text-2xl md:text-3xl font-semibold leading-tight mb-6">
        Disseccando o reel{" "}
        <em className="text-muted-foreground">e remontando o seu.</em>
      </h2>

      <ul className="space-y-0">
        {STAGES.map((s, i) => {
          const done = i < stage;
          const active = i === stage;
          return (
            <li
              key={i}
              className="flex items-center gap-3 py-3 border-b border-border last:border-0"
            >
              <div
                className={`relative h-4 w-4 shrink-0 border ${
                  done
                    ? "border-foreground bg-foreground"
                    : active
                      ? "border-primary bg-primary"
                      : "border-border bg-transparent"
                }`}
              >
                {done && (
                  <svg
                    className="absolute inset-0 m-auto"
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M2 6.5 L5 9 L10 3"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="square"
                      fill="none"
                    />
                  </svg>
                )}
                {active && (
                  <motion.span
                    className="absolute inset-0 bg-primary/60"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                )}
              </div>
              <span
                className={`text-sm font-mono tracking-wide ${
                  done
                    ? "text-muted-foreground line-through"
                    : active
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Cada reel leva ~30–45s. Não fecha a aba.
      </p>
    </div>
  );
}
