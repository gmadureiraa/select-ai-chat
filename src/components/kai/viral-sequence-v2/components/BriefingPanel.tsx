/**
 * BriefingPanel — input principal pra começar um carrossel novo.
 *
 * Inspirado em `app/app/create/new/page.tsx` do standalone, mas simplificado:
 *   - Textarea principal (briefing/tema/link)
 *   - Tom (cycler: Editorial / Informal / Direto / Provocativo)
 *   - Língua (cycler: PT-BR / EN)
 *   - Slide count (1, 6, 8, 10, 12)
 *   - 4 atalhos clicáveis (tutorial / hot take / youtube / remix)
 *   - Botão "Gerar carrossel" (Sparkles)
 */

import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type Tone = "editorial" | "informal" | "direto" | "provocativo";
export type Lang = "pt-br" | "en";

const TONE_OPTS: { id: Tone; label: string }[] = [
  { id: "editorial", label: "Editorial" },
  { id: "informal", label: "Informal" },
  { id: "direto", label: "Direto" },
  { id: "provocativo", label: "Provocativo" },
];
const LANG_OPTS: { id: Lang; label: string }[] = [
  { id: "pt-br", label: "PT-BR" },
  { id: "en", label: "EN" },
];
const SLIDE_OPTS: number[] = [1, 6, 8, 10, 12];

const SHORTCUTS: { kicker: string; label: string; seed: string }[] = [
  {
    kicker: "Nº 01 · TUTORIAL",
    label: "Como fazer X",
    seed: "Como [ação específica] em [N passos / contexto]. Ex: como ganhar os primeiros 1.000 seguidores sem ads.",
  },
  {
    kicker: "Nº 02 · HOT TAKE",
    label: "Opinião forte",
    seed: "Por que [crença popular] está errada e o que você deveria fazer no lugar.",
  },
  {
    kicker: "Nº 03 · YOUTUBE",
    label: "Resumir vídeo",
    seed: "Faça um carrossel com base nesse vídeo: https://youtube.com/watch?v=...",
  },
  {
    kicker: "Nº 04 · REMIX",
    label: "Remixar carrossel",
    seed: "Use esse carrossel como referência mas foca em [ângulo novo]: https://www.instagram.com/p/...",
  },
];

interface BriefingPanelProps {
  briefing: string;
  onBriefingChange: (b: string) => void;
  tone: Tone;
  onToneChange: (t: Tone) => void;
  language: Lang;
  onLanguageChange: (l: Lang) => void;
  slideCount: number;
  onSlideCountChange: (n: number) => void;
  loading: boolean;
  onGenerate: () => void;
  /** Compact = quando já tem slide gerado (form encolhe). */
  compact?: boolean;
}

export function BriefingPanel({
  briefing,
  onBriefingChange,
  tone,
  onToneChange,
  language,
  onLanguageChange,
  slideCount,
  onSlideCountChange,
  loading,
  onGenerate,
  compact = false,
}: BriefingPanelProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border max-w-3xl mx-auto w-full transition-all",
        compact
          ? "bg-card border-border/30 p-4"
          : "bg-gradient-to-br from-sky-50/60 via-background to-background dark:from-sky-950/30 border-sky-200/40 dark:border-sky-800/30 p-6",
      )}
    >
      {!compact && (
        <>
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-sky-200/30 to-transparent dark:from-sky-700/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-2 mb-3">
            <Wand2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
              Novo carrossel
            </span>
          </div>
        </>
      )}

      <div className="relative space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Briefing
          </label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tema, ângulo, link de YouTube/Instagram. Quanto mais específico, melhor a saída.
          </p>
        </div>
        <Textarea
          value={briefing}
          onChange={(e) => onBriefingChange(e.target.value)}
          placeholder='Ex: "Por que a maioria dos iniciantes em Bitcoin perde dinheiro nos primeiros 6 meses — traz 5 erros comuns + 1 hack que ninguém fala sobre self-custody."'
          rows={compact ? 2 : 4}
          className={cn(
            "text-sm resize-none transition-all bg-background",
            !compact && "border-border/40 shadow-sm",
          )}
          disabled={loading}
        />

        {/* Cyclers */}
        <div className="grid grid-cols-3 gap-2">
          <Cycler
            label="Tom"
            value={tone}
            options={TONE_OPTS.map((o) => o.id)}
            display={(v) => TONE_OPTS.find((o) => o.id === v)?.label ?? v}
            onChange={onToneChange}
          />
          <Cycler
            label="Língua"
            value={language}
            options={LANG_OPTS.map((o) => o.id)}
            display={(v) => LANG_OPTS.find((o) => o.id === v)?.label ?? v}
            onChange={onLanguageChange}
          />
          <Cycler
            label="Slides"
            value={slideCount}
            options={SLIDE_OPTS}
            display={(v) => String(v)}
            onChange={onSlideCountChange}
          />
        </div>

        {/* Shortcut chips (only in expanded mode) */}
        {!compact && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {SHORTCUTS.map((s) => (
              <button
                key={s.kicker}
                type="button"
                onClick={() => onBriefingChange(s.seed)}
                className="text-left rounded-md border border-border/40 bg-background/60 hover:bg-muted/40 hover:border-border p-2.5 transition-colors"
                disabled={loading}
              >
                <div className="text-[9px] font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">
                  {s.kicker}
                </div>
                <div className="text-xs font-semibold leading-tight">{s.label}</div>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end pt-2">
          <Button
            onClick={onGenerate}
            disabled={loading || !briefing.trim()}
            className="h-10 gap-2 bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/30 px-5"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Gerando..." : compact ? "Re-gerar" : "Gerar carrossel"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Cycler<T extends string | number>({
  label,
  value,
  options,
  display,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  display: (v: T) => string;
  onChange: (v: T) => void;
}) {
  const idx = options.indexOf(value);
  const next = () => {
    const ni = (idx + 1) % options.length;
    onChange(options[ni]);
  };
  return (
    <button
      type="button"
      onClick={next}
      className="flex items-center justify-between rounded-md border border-border/50 bg-background hover:bg-muted/50 transition-colors px-3 py-2 text-left"
    >
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xs font-semibold">{display(value)}</span>
    </button>
  );
}
