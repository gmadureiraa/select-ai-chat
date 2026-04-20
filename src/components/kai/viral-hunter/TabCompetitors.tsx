/**
 * Tab Concorrentes — CRUD de concorrentes do cliente (@handles + URLs).
 * Scraping real virá via edge function (Apify). Por ora, só gerencia a lista.
 */

import { useState } from "react";
import { useViralHunterConfig } from "./useViralHunterConfig";
import {
  Plus,
  Trash2,
  ExternalLink,
  Users,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  Globe,
  Music,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CompetitorEntry } from "./types";

const platformIcon: Record<CompetitorEntry["platform"], React.ElementType> = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music,
  website: Globe,
};

const platformLabels: Record<CompetitorEntry["platform"], string> = {
  instagram: "Instagram",
  twitter: "X / Twitter",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  website: "Site",
};

function handleUrl(entry: CompetitorEntry): string {
  const h = entry.handle.replace(/^@/, "");
  switch (entry.platform) {
    case "instagram": return `https://instagram.com/${h}`;
    case "twitter": return `https://x.com/${h}`;
    case "linkedin": return h.startsWith("http") ? h : `https://linkedin.com/in/${h}`;
    case "youtube": return h.startsWith("UC") ? `https://youtube.com/channel/${h}` : `https://youtube.com/@${h}`;
    case "tiktok": return `https://tiktok.com/@${h}`;
    case "website": return h.startsWith("http") ? h : `https://${h}`;
  }
}

interface TabCompetitorsProps {
  clientId: string;
  onUseAsInspiration: (prompt: string) => void;
}

export function TabCompetitors({ clientId, onUseAsInspiration }: TabCompetitorsProps) {
  const { config, save, isSaving } = useViralHunterConfig(clientId);
  const [newHandle, setNewHandle] = useState("");
  const [newPlatform, setNewPlatform] = useState<CompetitorEntry["platform"]>("instagram");
  const [newNotes, setNewNotes] = useState("");

  const addCompetitor = async () => {
    const h = newHandle.trim();
    if (!h) return;
    const entry: CompetitorEntry = {
      platform: newPlatform,
      handle: h,
      notes: newNotes.trim() || undefined,
      addedAt: new Date().toISOString(),
    };
    await save({
      ...config,
      competitors: [...config.competitors, entry],
    });
    setNewHandle("");
    setNewNotes("");
    toast.success("Concorrente adicionado.");
  };

  const removeCompetitor = async (index: number) => {
    await save({
      ...config,
      competitors: config.competitors.filter((_, i) => i !== index),
    });
  };

  const analyzeWithKai = (c: CompetitorEntry) => {
    const prompt = [
      `Analise o concorrente "${c.handle}" no ${platformLabels[c.platform]}.`,
      c.notes ? `\nObservações: ${c.notes}` : "",
      `\nPerfil público: ${handleUrl(c)}`,
      `\nO que esse concorrente está fazendo bem? Que lacunas existem que meu cliente pode explorar? Me dê 3 insights acionáveis e 2 ideias de conteúdo inspiradas (mas não cópias).`,
    ].join("");
    onUseAsInspiration(prompt);
    toast.success("Análise competitiva enviada pro KAI.");
  };

  return (
    <div className="space-y-4">
      {/* Form adicionar */}
      <div className="bg-card border border-border/30 rounded-xl p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Adicionar concorrente
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-2">
          <Select
            value={newPlatform}
            onValueChange={(v) => setNewPlatform(v as CompetitorEntry["platform"])}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(platformLabels) as CompetitorEntry["platform"][]).map((p) => (
                <SelectItem key={p} value={p}>
                  {platformLabels[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            placeholder="@handle ou URL"
            className="h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCompetitor();
              }
            }}
          />
          <Button
            size="sm"
            onClick={addCompetitor}
            disabled={!newHandle.trim() || isSaving}
            className="h-9 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>
        <Input
          value={newNotes}
          onChange={(e) => setNewNotes(e.target.value)}
          placeholder="Observações (opcional) — por que é relevante monitorar?"
          className="h-8 text-xs"
        />
      </div>

      {/* Lista */}
      {config.competitors.length === 0 ? (
        <div className="text-center py-16 max-w-md mx-auto">
          <div className="p-3 rounded-full bg-muted inline-flex mb-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">Nenhum concorrente ainda</h3>
          <p className="text-sm text-muted-foreground">
            Adicione perfis do nicho pra análise competitiva com o KAI.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {config.competitors.map((c, i) => {
            const Icon = platformIcon[c.platform];
            return (
              <div
                key={`${c.platform}-${c.handle}-${i}`}
                className="bg-card border border-border/40 rounded-lg p-3 space-y-2 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-2">
                  <div className={cn("p-1.5 rounded-md shrink-0", platformBg(c.platform))}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{c.handle}</p>
                    <p className="text-[10px] text-muted-foreground">{platformLabels[c.platform]}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCompetitor(i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {c.notes && <p className="text-xs text-muted-foreground line-clamp-2">{c.notes}</p>}
                <div className="flex items-center gap-1.5 pt-1">
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => analyzeWithKai(c)}
                  >
                    <Sparkles className="h-3 w-3" />
                    Analisar no KAI
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    onClick={() => window.open(handleUrl(c), "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-muted/30 border border-dashed border-border rounded-lg p-3 text-xs text-muted-foreground">
        <strong>Próximo passo:</strong> scraping automático dos posts recentes dos concorrentes
        (via Apify) — chega na F2 junto das tools de publicação. Por ora a análise usa o que o KAI
        consegue inferir pela URL.
      </div>
    </div>
  );
}

function platformBg(p: CompetitorEntry["platform"]): string {
  return {
    instagram: "bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400",
    twitter: "bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400",
    linkedin: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    youtube: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    tiktok: "bg-neutral-100 text-neutral-700 dark:bg-neutral-900/20 dark:text-neutral-400",
    website: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  }[p];
}
