/**
 * TemplatePicker — grid horizontal com os 8 templates visuais portados
 * de gmadureiraa/sequencia-viral. Cada item mostra o nome, kicker e a
 * paleta de cores em chips. Selecionar troca o `template` do carrossel,
 * que é repassado pra todos os slides via TemplateSlide.
 */

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEMPLATES_META } from "./templates";
import type { TemplateId } from "./templates/types";
import type { ViralTemplateId } from "./types";

interface TemplatePickerProps {
  value: ViralTemplateId;
  onChange: (id: ViralTemplateId) => void;
}

export function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  return (
    <div className="mb-5 rounded-lg border border-border/40 bg-card/40 p-3">
      <div className="flex items-center justify-between mb-2.5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Template visual
          </div>
          <div className="text-[11px] text-muted-foreground/80 mt-0.5">
            Aplica ao carrossel inteiro · troca a tipografia, paleta e layout
          </div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/70">
          {TEMPLATES_META.find((t) => t.id === value)?.kicker ?? ""}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TEMPLATES_META.map((tpl: { id: TemplateId; name: string; kicker: string; palette: [string, string, string] }) => {
          const active = tpl.id === value;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onChange(tpl.id as ViralTemplateId)}
              className={cn(
                "shrink-0 relative flex flex-col gap-1.5 rounded-md border p-2.5 transition-all min-w-[140px] text-left",
                active
                  ? "border-sky-500 ring-1 ring-sky-500/40 bg-sky-500/5"
                  : "border-border/50 hover:border-border bg-background hover:bg-muted/30",
              )}
            >
              <div className="flex items-center gap-1">
                {tpl.palette.map((c, i) => (
                  <span
                    key={i}
                    className="h-3.5 w-3.5 rounded-sm border border-black/10"
                    style={{ background: c }}
                  />
                ))}
                {active && (
                  <Check className="ml-auto h-3.5 w-3.5 text-sky-500" />
                )}
              </div>
              <div className="text-[12px] font-semibold text-foreground leading-tight">
                {tpl.name}
              </div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                {tpl.kicker}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
