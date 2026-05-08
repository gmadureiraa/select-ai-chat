/**
 * Indicador visual sutil do estado de auto-save dos viral tabs.
 *
 * Usado ao lado do botão "Gerar" pra mostrar status do rascunho:
 *  - 'saving'  → spinner + "Salvando..."
 *  - 'saved'   → check verde + "Salvo" (some após 2s pra não distrair)
 *  - 'error'   → cloud-off + "Erro ao salvar" (persiste)
 *  - 'idle'    → nada (não renderiza)
 *
 * Renderiza com Tailwind genérico pra funcionar dentro dos viral apps que
 * têm CSS isolado (sv-*, rv-*, rdv-*) — sem depender de tokens dos apps.
 */

import { Check, CloudOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { AutoSaveStatus } from "@/hooks/useViralAutoSave";

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  lastSavedAt?: Date | null;
  /** Variant pra ajustar contraste em backgrounds dark. */
  variant?: "light" | "dark";
  className?: string;
}

export function AutoSaveIndicator({
  status,
  lastSavedAt,
  variant = "light",
  className = "",
}: AutoSaveIndicatorProps) {
  const [showSaved, setShowSaved] = useState(false);

  // Mostra "Salvo" por 2s depois esconde (não distrai). 'saving' e 'error'
  // ficam visíveis enquanto durarem.
  useEffect(() => {
    if (status === "saved") {
      setShowSaved(true);
      const t = window.setTimeout(() => setShowSaved(false), 2000);
      return () => window.clearTimeout(t);
    }
    setShowSaved(false);
  }, [status]);

  if (status === "idle") return null;
  if (status === "saved" && !showSaved) return null;

  const baseStyle =
    variant === "dark"
      ? { color: "rgba(245, 241, 232, 0.7)" }
      : { color: "rgba(0, 0, 0, 0.55)" };

  const lastSavedLabel = lastSavedAt
    ? lastSavedAt.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      className={`text-xs flex items-center gap-1.5 transition-opacity duration-200 ${
        className
      }`}
      style={{
        ...baseStyle,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
      role="status"
      aria-live="polite"
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Salvando...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3 w-3" style={{ color: "#16a34a" }} />
          <span>
            Salvo
            {lastSavedLabel && (
              <span className="opacity-60 ml-1">{lastSavedLabel}</span>
            )}
          </span>
        </>
      )}
      {status === "error" && (
        <>
          <CloudOff className="h-3 w-3" style={{ color: "#dc2626" }} />
          <span>Erro ao salvar</span>
        </>
      )}
    </div>
  );
}
