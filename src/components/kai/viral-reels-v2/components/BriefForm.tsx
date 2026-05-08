/**
 * BriefForm — form completo do briefing de adaptação de reel.
 * URL + tema + objetivo + CTA + persona + nicho. Usado por `index.tsx`.
 *
 * Visual: shadcn (Input/Textarea/Button/Select) + grid responsivo.
 */

import { Loader2, Sparkles, Target, TrendingUp, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Objetivo } from "../types";
import { URLInput } from "./URLInput";

const OBJETIVOS: Array<{
  id: Objetivo;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "leads", label: "Gerar leads", icon: <Target className="h-3.5 w-3.5" /> },
  { id: "produto", label: "Vender produto", icon: <Zap className="h-3.5 w-3.5" /> },
  {
    id: "seguidores",
    label: "Crescer seguidores",
    icon: <Users className="h-3.5 w-3.5" />,
  },
  {
    id: "engajamento",
    label: "Engajamento",
    icon: <TrendingUp className="h-3.5 w-3.5" />,
  },
];

export interface BriefFormState {
  sourceUrl: string;
  tema: string;
  objetivo: Objetivo;
  cta: string;
  persona: string;
  nicho: string;
}

interface Props {
  value: BriefFormState;
  onChange: (next: BriefFormState) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function BriefForm({ value, onChange, onSubmit, loading }: Props) {
  function patch(p: Partial<BriefFormState>) {
    onChange({ ...value, ...p });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!loading) onSubmit();
      }}
      className="rounded-lg border border-border bg-card p-5 space-y-5"
    >
      <URLInput
        value={value.sourceUrl}
        onChange={(v) => patch({ sourceUrl: v })}
        disabled={loading}
      />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <div>
          <Label className="text-xs">Tema do seu reel</Label>
          <Textarea
            value={value.tema}
            onChange={(e) => patch({ tema: e.target.value })}
            placeholder="Ex: ferramenta IA pra editar fotos / consultoria fitness pra mães / newsletter de cripto..."
            className="mt-1 h-20 resize-none"
            disabled={loading}
          />
        </div>
        <div>
          <Label className="text-xs">CTA final</Label>
          <Textarea
            value={value.cta}
            onChange={(e) => patch({ cta: e.target.value })}
            placeholder="Ex: comenta APP que mando o link / clica no link da bio / manda DM..."
            className="mt-1 h-20 resize-none"
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Objetivo principal</Label>
        <div className="mt-2 grid gap-2 grid-cols-2 md:grid-cols-4">
          {OBJETIVOS.map((o) => {
            const active = value.objetivo === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => patch({ objetivo: o.id })}
                disabled={loading}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-xs font-medium transition-all",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-foreground hover:bg-accent",
                  loading && "opacity-50 cursor-not-allowed",
                )}
              >
                {o.icon}
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <div>
          <Label className="text-xs">
            Persona <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            value={value.persona}
            onChange={(e) => patch({ persona: e.target.value })}
            placeholder="Ex: criadores iniciantes 18-25 anos"
            className="mt-1"
            disabled={loading}
          />
        </div>
        <div>
          <Label className="text-xs">
            Nicho <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            value={value.nicho}
            onChange={(e) => patch({ nicho: e.target.value })}
            placeholder="Ex: marketing digital, finanças, fitness..."
            className="mt-1"
            disabled={loading}
          />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Adaptando reel… (~30–60s)
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Adaptar reel
          </>
        )}
      </Button>
    </form>
  );
}
