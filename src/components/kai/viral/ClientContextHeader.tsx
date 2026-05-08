/**
 * Banner fino "Trabalhando em <Cliente>" que aparece no topo dos 3 viral
 * tabs pra deixar explícito qual cliente está ativo.
 *
 * Versão minimalista (sem cards, sem images) pra não brigar com a estética
 * dos viral apps (que cada um tem seu próprio CSS isolado em `sv-*` /
 * `rv-*` / `rdv-*`). Usa Tailwind básico — sem tokens dos apps — pra
 * funcionar em qualquer scope.
 *
 * Fase G: adicionado avatar + badge de tom + botão "Ver contexto" que abre
 * o `ClientContextDrawer` com 4 tabs (visão/voz/refs/histórico).
 */

import { Sparkles } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { ClientContextDrawer } from "./ClientContextDrawer";
import type { ClientWorkspaceContext } from "./lib/use-client-workspace-context";

interface ClientContextHeaderProps {
  context: ClientWorkspaceContext | null | undefined;
  /** Variant determina contraste do background (light em paper, dark em ink). */
  variant?: "light" | "dark";
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ClientContextHeader({
  context,
  variant = "light",
}: ClientContextHeaderProps) {
  const client = context?.client;
  if (!client) return null;

  const isDark = variant === "dark";

  // Logo opcional via tags.logo_url no schema dos clientes.
  const logoUrl =
    (client.tags as Record<string, unknown> | null)?.["logo_url"];
  const logoSrc = typeof logoUrl === "string" ? logoUrl : undefined;

  return (
    <div
      className="px-4 py-2 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300"
      style={{
        background: isDark
          ? "rgba(255, 61, 46, 0.12)"
          : "rgba(0, 0, 0, 0.04)",
        borderBottom: isDark
          ? "1px solid rgba(245, 241, 232, 0.18)"
          : "1px solid rgba(0, 0, 0, 0.08)",
        color: isDark ? "rgba(245, 241, 232, 0.92)" : "rgba(0, 0, 0, 0.78)",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <Avatar className="h-5 w-5">
        {logoSrc && <AvatarImage src={logoSrc} alt={client.name} />}
        <AvatarFallback
          className="text-[8px] font-semibold"
          style={{
            background: isDark
              ? "rgba(245, 241, 232, 0.12)"
              : "rgba(0, 0, 0, 0.08)",
            color: "inherit",
          }}
        >
          {getInitials(client.name)}
        </AvatarFallback>
      </Avatar>
      <span className="opacity-70 hidden sm:inline">Cliente:</span>
      <strong className="font-semibold truncate max-w-[120px] sm:max-w-none">
        {client.name}
      </strong>
      {client.industry && (
        <>
          <span className="opacity-40 hidden sm:inline">·</span>
          <span className="opacity-70 hidden sm:inline">{client.industry}</span>
        </>
      )}
      {context?.tone && (
        <>
          <span className="opacity-40 hidden md:inline">·</span>
          <span
            className="text-xs items-center gap-1 hidden md:inline-flex opacity-70"
            title="Tom da marca"
          >
            <Sparkles className="h-3 w-3" />
            {context.tone}
          </span>
        </>
      )}
      <div className="ml-auto">
        <ClientContextDrawer
          context={context}
          triggerVariant={variant}
        />
      </div>
    </div>
  );
}
