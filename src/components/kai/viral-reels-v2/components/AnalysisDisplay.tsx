/**
 * AnalysisDisplay — mostra a análise estrutural do reel original:
 * resumo, "por que viralizou", esqueleto de 5 blocos (hook/promessa/demo/
 * provaSocial/cta) e padrões transferíveis.
 */

import { ExternalLink, Eye, Heart, MessageCircle, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SourceAnalysis, SourceMeta } from "../types";
import { formatDuration, formatNumber } from "../lib/utils";

interface Props {
  analysis: SourceAnalysis;
  source?: SourceMeta;
  scenesCount?: number;
}

const BLOCK_LABELS = {
  hook: "HOOK · 0–3s",
  promessa: "PROMESSA",
  demonstracao: "DEMONSTRAÇÃO",
  provaSocial: "PROVA SOCIAL",
  cta: "CTA",
} as const;

export function AnalysisDisplay({ analysis, source, scenesCount }: Props) {
  const plays = source?.plays ?? source?.videoPlayCount;
  const views = source?.views ?? source?.videoPlayCount;
  const likes = source?.likes ?? source?.likesCount;
  const comments = source?.comments ?? source?.commentsCount;
  const sourceUrl = source?.url ?? source?.videoUrl;

  return (
    <div className="space-y-6">
      {/* Source + analysis hero */}
      {source && (
        <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
          {/* Source card */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold mb-2">
              ✦ Reel original
            </div>
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-2xl md:text-3xl font-semibold leading-tight inline-flex items-center gap-2 hover:text-primary transition-colors"
              >
                @{source.ownerUsername ?? "—"}
                <ExternalLink className="h-4 w-4 opacity-50" />
              </a>
            ) : (
              <div className="text-2xl md:text-3xl font-semibold leading-tight">
                @{source.ownerUsername ?? "—"}
              </div>
            )}
            {source.ownerFullName && (
              <p className="mt-1 text-xs font-mono text-muted-foreground tracking-wide">
                {source.ownerFullName}
              </p>
            )}
            {source.caption && (
              <p className="mt-4 pt-4 text-sm leading-relaxed text-muted-foreground border-t border-border whitespace-pre-line">
                {source.caption.slice(0, 220)}
                {source.caption.length > 220 ? "…" : ""}
              </p>
            )}
            <div className="mt-4 pt-4 grid grid-cols-2 gap-3 border-t border-border">
              <Stat icon={<Play className="h-3 w-3" />} label="Plays" value={formatNumber(plays)} />
              <Stat icon={<Eye className="h-3 w-3" />} label="Views" value={formatNumber(views)} />
              <Stat icon={<Heart className="h-3 w-3" />} label="Likes" value={formatNumber(likes)} />
              <Stat
                icon={<MessageCircle className="h-3 w-3" />}
                label="Comments"
                value={formatNumber(comments)}
              />
              <Stat label="Duração" value={formatDuration(source.videoDuration)} />
              {scenesCount !== undefined && (
                <Stat label="Cenas geradas" value={String(scenesCount)} />
              )}
            </div>
          </div>

          {/* Analysis card */}
          <div className="rounded-lg border border-border bg-foreground p-5 text-background">
            <div className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold mb-2">
              ✦ Análise estrutural
            </div>
            <p className="text-lg md:text-xl italic font-medium leading-snug mb-5">
              "{analysis.resumo}"
            </p>
            <div className="text-[10px] font-mono uppercase tracking-wider opacity-80 mb-2">
              Por que viralizou
            </div>
            <ul className="space-y-2">
              {analysis.porQueViralizou.map((razao, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm leading-relaxed opacity-90"
                >
                  <span className="text-primary font-bold pt-px shrink-0">→</span>
                  {razao}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Estrutura desmontada */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Estrutura do reel original · 5 blocos
          </h3>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {(["hook", "promessa", "demonstracao", "provaSocial", "cta"] as const).map(
            (key) => {
              const block = analysis.estrutura?.[key];
              if (!block) return null;
              return (
                <div
                  key={key}
                  className="rounded-md border border-border bg-card p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-primary">
                      {BLOCK_LABELS[key]}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {block.tempo}
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed">{block.texto}</p>
                </div>
              );
            },
          )}
        </div>
      </div>

      {/* Padrões transferíveis */}
      {analysis.padroesTransferiveis?.length > 0 && (
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider font-bold mb-2">
            Padrões transferíveis
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {analysis.padroesTransferiveis.map((p, i) => (
              <div key={i} className="text-xs leading-relaxed pl-4 relative">
                <span className="absolute left-0 top-0 text-primary font-bold">+</span>
                {p}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
        {icon}
        {label}
      </div>
      <div className="font-mono font-bold text-base mt-0.5">{value}</div>
    </div>
  );
}
