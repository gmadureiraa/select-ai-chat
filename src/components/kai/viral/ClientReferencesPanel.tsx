/**
 * Painel compacto que mostra refs do cliente (visuais + top library +
 * concorrentes + sites + docs) durante a criação de carrossel/reel.
 *
 * Não-intrusivo: só aparece se houver dados; renderiza com Tailwind genérico
 * pra funcionar dentro de qualquer scope CSS dos viral apps.
 *
 * Fase G: expandido pra incluir sites + documentos + scores de engagement
 * em "Top conteúdos" + botão "Ver tudo" que abre o `ClientContextDrawer`.
 * Animação sutil de entrada via `animate-in fade-in`.
 */

import {
  ExternalLink,
  FileText,
  Globe,
  ImageOff,
  Trophy,
  Users,
} from "lucide-react";

import { ClientContextDrawer } from "./ClientContextDrawer";
import type { ClientWorkspaceContext } from "./lib/use-client-workspace-context";

interface ClientReferencesPanelProps {
  context: ClientWorkspaceContext | null | undefined;
  /** Header dark/light pra ajustar contraste. */
  variant?: "light" | "dark";
  /** Quantos thumbs visuais mostrar (default 3). */
  visualLimit?: number;
  /** Quantos itens de library (default 3). */
  libraryLimit?: number;
  /** Esconde o botão "Ver tudo" (default false — drawer é uma feature útil). */
  hideDrawerTrigger?: boolean;
}

export function ClientReferencesPanel({
  context,
  variant = "light",
  visualLimit = 3,
  libraryLimit = 3,
  hideDrawerTrigger = false,
}: ClientReferencesPanelProps) {
  if (!context?.client) return null;

  const isDark = variant === "dark";
  const visuals = context.visualReferences.slice(0, visualLimit);
  const library = context.contentLibrary.slice(0, libraryLimit);
  const competitors = context.competitors.slice(0, 4);
  const websites = context.websites.slice(0, 3);
  const documents = context.documents.slice(0, 3);

  if (
    visuals.length === 0 &&
    library.length === 0 &&
    competitors.length === 0 &&
    websites.length === 0 &&
    documents.length === 0
  ) {
    return null;
  }

  return (
    <div
      className="rounded-md border p-3 space-y-3 animate-in fade-in duration-300"
      style={{
        background: isDark ? "rgba(245, 241, 232, 0.04)" : "rgba(0, 0, 0, 0.02)",
        borderColor: isDark
          ? "rgba(245, 241, 232, 0.16)"
          : "rgba(0, 0, 0, 0.08)",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        color: isDark ? "rgba(245, 241, 232, 0.92)" : "rgba(0, 0, 0, 0.85)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider opacity-60">
          Referências do cliente
        </div>
        {!hideDrawerTrigger && (
          <ClientContextDrawer context={context} triggerVariant={variant} />
        )}
      </div>

      {visuals.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-50 mb-1.5">
            Refs visuais
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {visuals.map((ref) => {
              const src = ref.image_url;
              return (
                <div
                  key={ref.id}
                  className="aspect-square overflow-hidden rounded border flex items-center justify-center transition-transform hover:scale-105"
                  style={{
                    borderColor: isDark
                      ? "rgba(245, 241, 232, 0.18)"
                      : "rgba(0, 0, 0, 0.1)",
                    background: isDark
                      ? "rgba(245, 241, 232, 0.05)"
                      : "rgba(0, 0, 0, 0.04)",
                  }}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={ref.title ?? "ref"}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageOff className="h-4 w-4 opacity-40" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {library.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-50 mb-1.5 flex items-center gap-1">
            <Trophy className="h-3 w-3" />
            Top conteúdos
          </div>
          <ul className="space-y-1.5">
            {library.map((item) => {
              const rawScore = item.metrics?.["engagement_score"];
              const score = typeof rawScore === "number" ? rawScore : null;
              return (
                <li
                  key={item.id}
                  className="text-xs leading-snug truncate flex items-center gap-1.5"
                  title={item.title ?? undefined}
                >
                  <span className="opacity-50 mr-1 text-[10px] uppercase shrink-0">
                    {item.content_type ?? "—"}
                  </span>
                  <span className="truncate flex-1">
                    {item.title ?? "(sem título)"}
                  </span>
                  {score !== null && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        background: isDark
                          ? "rgba(245, 241, 232, 0.1)"
                          : "rgba(0, 0, 0, 0.06)",
                      }}
                      title="Engagement score"
                    >
                      {Math.round(score)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {competitors.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-50 mb-1.5 flex items-center gap-1">
            <Users className="h-3 w-3" />
            Concorrentes
          </div>
          <div className="flex flex-wrap gap-1.5">
            {competitors.map((comp) => (
              <span
                key={comp.id}
                className="text-[10px] px-2 py-0.5 rounded-full border"
                style={{
                  borderColor: isDark
                    ? "rgba(245, 241, 232, 0.22)"
                    : "rgba(0, 0, 0, 0.12)",
                  background: isDark
                    ? "rgba(245, 241, 232, 0.06)"
                    : "rgba(0, 0, 0, 0.04)",
                }}
                title={comp.notes ?? undefined}
              >
                @{comp.handle ?? "—"}
                {comp.platform ? ` · ${comp.platform}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {websites.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-50 mb-1.5 flex items-center gap-1">
            <Globe className="h-3 w-3" />
            Sites
          </div>
          <ul className="space-y-1">
            {websites.map((w) => (
              <li
                key={w.id}
                className="text-[11px] truncate flex items-center gap-1"
              >
                <a
                  href={w.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline truncate inline-flex items-center gap-1"
                  style={{ color: "inherit" }}
                >
                  <span className="truncate">{w.url}</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-50 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {documents.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-50 mb-1.5 flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Documentos
          </div>
          <ul className="space-y-1">
            {documents.map((d) => (
              <li
                key={d.id}
                className="text-[11px] truncate flex items-center gap-1.5 opacity-80"
                title={d.name}
              >
                <FileText className="h-2.5 w-2.5 opacity-60 shrink-0" />
                <span className="truncate">{d.name}</span>
                {d.file_type && (
                  <span className="text-[9px] uppercase opacity-50 shrink-0">
                    {d.file_type}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
