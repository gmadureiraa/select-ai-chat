/**
 * Sidebar com histórico de reels adaptados pro cliente atual.
 *
 * Estética cream/REC consistente com o resto do MainApp — não usa shadcn
 * pra não quebrar o look. É um plus do KAI (no standalone tinha página
 * dedicada `/app/meus-roteiros`).
 */

import { Trash2, History } from "lucide-react";
import type { ReelRow } from "../types";

interface Props {
  reels: ReelRow[];
  selectedId: string | null;
  onSelect: (reel: ReelRow) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

export function HistorySidebar({
  reels,
  selectedId,
  onSelect,
  onDelete,
  loading,
}: Props) {
  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        background: "var(--color-rv-cream)",
        borderRight: "1.5px solid var(--color-rv-ink)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1.5px solid var(--color-rv-ink)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <History size={14} style={{ color: "var(--color-rv-rec)" }} />
        <span
          className="rv-mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Histórico
        </span>
        <span
          className="rv-mono"
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "var(--color-rv-muted)",
            background: "var(--color-rv-soft)",
            padding: "2px 8px",
            border: "1px solid var(--color-rv-line)",
          }}
        >
          {reels.length}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {loading && (
          <div
            className="rv-mono"
            style={{
              padding: 16,
              fontSize: 11,
              color: "var(--color-rv-muted)",
              textAlign: "center",
            }}
          >
            Carregando…
          </div>
        )}
        {!loading && reels.length === 0 && (
          <div
            style={{
              padding: 16,
              fontSize: 12,
              color: "var(--color-rv-muted)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Nenhum roteiro ainda. Cole um link de Reel pra começar.
          </div>
        )}
        {reels.map((r) => {
          const active = selectedId === r.id;
          return (
            <div
              key={r.id}
              onClick={() => onSelect(r)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(r);
                }
              }}
              style={{
                padding: "10px 12px",
                marginBottom: 4,
                background: active ? "var(--color-rv-ink)" : "transparent",
                color: active ? "var(--color-rv-cream)" : "var(--color-rv-ink)",
                cursor: "pointer",
                border: active
                  ? "1.5px solid var(--color-rv-ink)"
                  : "1.5px solid transparent",
                boxShadow: active ? "3px 3px 0 0 var(--color-rv-rec)" : "none",
                position: "relative",
                transition: "all 120ms",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "var(--color-rv-soft)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      margin: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {r.script?.titulo || r.tema}
                  </p>
                  <p
                    className="rv-mono"
                    style={{
                      fontSize: 10,
                      color: active ? "rgba(245,241,232,0.65)" : "var(--color-rv-muted)",
                      marginTop: 3,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      letterSpacing: "0.04em",
                    }}
                  >
                    @{r.source_meta?.ownerUsername ?? "—"} · {r.objetivo}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Excluir este roteiro?")) onDelete(r.id);
                  }}
                  aria-label="Excluir"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: active
                      ? "rgba(245,241,232,0.5)"
                      : "var(--color-rv-muted)",
                    padding: 2,
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              {r.status !== "done" && (
                <span
                  className="rv-mono"
                  style={{
                    display: "inline-block",
                    fontSize: 8,
                    fontWeight: 800,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    marginTop: 4,
                    color:
                      r.status === "error"
                        ? "var(--color-rv-rec)"
                        : "var(--color-rv-amber)",
                  }}
                >
                  · {r.status}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
