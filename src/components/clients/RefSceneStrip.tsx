/**
 * RefSceneStrip — renderiza cenas-chave de uma ref de Reel/vídeo igual ao
 * estilo Reels Viral standalone:
 *   [HOOK] [PROMESSA] [DEMONSTRAÇÃO] [PROVA SOCIAL] [CTA]
 *   thumbnails verticais com label superior + timestamp inferior
 *
 * Plus: section "Estrutura" com beat-by-beat (cada cena com label + timestamp + texto)
 * mantendo paridade com `viral-reels-original/components/result-view.tsx`.
 *
 * Aceita 2 shapes de scenes (compat com adapt-viral-reel script.scenes):
 *   - { label, timestamp_start, timestamp_end, screenshot_url, text }
 *   - { papel, tempo, copy, visual, broll }   ← shape Gemini do adapt-viral-reel
 */
import { Badge } from "@/components/ui/badge";

export interface RefScene {
  label?: string;
  papel?: string;
  timestamp_start?: string;
  timestamp_end?: string;
  tempo?: string;
  screenshot_url?: string;
  thumbnail_url?: string;
  text?: string;
  copy?: string;
  visual?: string;
  broll?: string;
}

interface Props {
  scenes: RefScene[];
  className?: string;
}

const PAPEL_TO_LABEL: Record<string, string> = {
  hook: "HOOK",
  promessa: "PROMESSA",
  demo: "DEMONSTRAÇÃO",
  demonstracao: "DEMONSTRAÇÃO",
  demonstração: "DEMONSTRAÇÃO",
  prova: "PROVA SOCIAL",
  prova_social: "PROVA SOCIAL",
  transicao: "TRANSIÇÃO",
  transição: "TRANSIÇÃO",
  cta: "CTA",
};

function getLabel(s: RefScene): string {
  const raw = (s.label ?? s.papel ?? "").toLowerCase().trim();
  return PAPEL_TO_LABEL[raw] ?? (s.label ?? s.papel ?? "CENA").toUpperCase();
}

function getTimestamp(s: RefScene): string {
  if (s.timestamp_start && s.timestamp_end) {
    return `${s.timestamp_start}-${s.timestamp_end}`;
  }
  return s.tempo ?? "";
}

function getThumbnail(s: RefScene): string | null {
  return s.screenshot_url ?? s.thumbnail_url ?? null;
}

function getText(s: RefScene): string {
  return s.text ?? s.copy ?? "";
}

function getVisual(s: RefScene): string | undefined {
  return s.visual;
}

function getBroll(s: RefScene): string | undefined {
  return s.broll;
}

export function RefSceneStrip({ scenes, className = "" }: Props) {
  if (!scenes || scenes.length === 0) return null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Cenas-chave: grid horizontal de thumbnails 9:16 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Cenas-chave
          </span>
        </div>
        <div className="grid grid-flow-col auto-cols-fr gap-2 overflow-x-auto pb-2">
          {scenes.map((scene, idx) => {
            const thumb = getThumbnail(scene);
            const label = getLabel(scene);
            const ts = getTimestamp(scene);
            return (
              <div
                key={idx}
                className="relative rounded-md overflow-hidden bg-muted aspect-[9/16] min-w-[110px] border"
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={label}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/40 to-muted/80">
                    <span className="text-xs font-bold text-muted-foreground/60">
                      {idx + 1}
                    </span>
                  </div>
                )}
                {/* Label superior */}
                <div className="absolute top-1.5 left-1.5">
                  <span className="bg-black/85 text-white text-[8px] font-mono font-bold tracking-[0.15em] px-1.5 py-0.5 rounded-sm">
                    {label}
                  </span>
                </div>
                {/* Timestamp inferior */}
                {ts && (
                  <div className="absolute bottom-1.5 left-1.5 right-1.5">
                    <div className="bg-black/85 text-white text-[8px] font-mono font-bold tracking-wider text-center py-0.5 rounded-sm">
                      {ts}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground/70 italic mt-2">
          {scenes.length} {scenes.length === 1 ? "cena extraída" : "cenas extraídas"}{" "}
          {scenes.some(getThumbnail) ? "do vídeo nos timestamps" : "do roteiro"}
        </p>
      </div>

      {/* Estrutura: beat-by-beat */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Estrutura
          </span>
        </div>
        <div className="space-y-3">
          {scenes.map((scene, idx) => {
            const label = getLabel(scene);
            const ts = getTimestamp(scene);
            const text = getText(scene);
            const visual = getVisual(scene);
            const broll = getBroll(scene);
            return (
              <div
                key={idx}
                className="relative pl-4 pr-4 py-3 bg-muted/20 border border-border rounded-md border-l-4 border-l-rose-500"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold border-rose-500/40"
                  >
                    {label}
                  </Badge>
                  {ts && (
                    <span className="text-[10px] font-mono text-muted-foreground tracking-wider">
                      {ts}
                    </span>
                  )}
                </div>
                {text && (
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {text}
                  </p>
                )}
                {(visual || broll) && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {visual && (
                      <div>
                        <span className="font-mono uppercase text-[9px] tracking-wider mr-1">
                          Visual:
                        </span>
                        {visual}
                      </div>
                    )}
                    {broll && (
                      <div>
                        <span className="font-mono uppercase text-[9px] tracking-wider mr-1">
                          B-roll:
                        </span>
                        {broll}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
