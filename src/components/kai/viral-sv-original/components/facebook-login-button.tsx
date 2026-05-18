
/**
 * Botao "Conectar Instagram" que usa Facebook JS SDK (apenas opt-in).
 *
 * Fluxo:
 *  1. Carrega SDK lazy no click
 *  2. Mostra dialog de permissao
 *  3. Recebe short-lived token no browser
 *  4. Manda pro server-side /api/auth/meta/exchange (que troca por long-lived,
 *     puxa IG Business + media e retorna snapshot no shape de ProfileData)
 *  5. onSuccess(profile) entrega pro onboarding
 *
 * Apify continua como fallback: se o user nao tem IG Business ou nao quer
 * conectar FB, ele pode colar o handle direto como antes.
 */

import { useState } from "react";
import { Loader2, Facebook } from "lucide-react";
import { toast } from "sonner";
import {
  loadFacebookSdk,
  loginWithFacebook,
  SV_FB_SCOPES,
  type FbLoginResponse,
} from "@sv/lib/facebook-sdk";
import { jsonWithAuth } from "@sv/lib/api-auth-headers";
import type { Session } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProfileSnapshot = any;

interface Props {
  session: Session | null;
  onSuccess: (profile: ProfileSnapshot) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export function FacebookLoginButton({
  session,
  onSuccess,
  disabled,
  className,
  label = "Conectar Instagram via Facebook",
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!session) {
      toast.error("Faça login primeiro.");
      return;
    }

    // 2026-05-18 — Vite (KAI shell) não shim'a process.env. Lê via import.meta.env.
    // Fallback pro nome antigo NEXT_PUBLIC_* preserva compat se var ainda assim setada.
    const appId =
      (import.meta.env.VITE_FACEBOOK_APP_ID as string | undefined) ??
      (import.meta.env.NEXT_PUBLIC_FACEBOOK_APP_ID as string | undefined);
    if (!appId) {
      toast.error("Integração Meta não configurada (app ID ausente).");
      return;
    }

    setLoading(true);
    try {
      await loadFacebookSdk();
      const res: FbLoginResponse = await loginWithFacebook(SV_FB_SCOPES);

      if (res.status !== "connected" || !res.authResponse) {
        toast.info("Conexão cancelada.");
        return;
      }

      // Troca token no server e pega snapshot do IG.
      const r = await fetch("/api/auth/meta/exchange", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({
          accessToken: res.authResponse.accessToken,
          userID: res.authResponse.userID,
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `exchange ${r.status}`);
      }

      const profile = await r.json();

      if (profile.partial && !profile.meta?.ig_business_id) {
        toast.message(
          "Não encontrei um Instagram Business conectado à sua Página Facebook.",
          {
            description:
              "Converta seu IG pra Business/Creator em Configurações → Conta, ou use a opção de colar o handle.",
          }
        );
      } else {
        toast.success("Instagram conectado!");
      }

      onSuccess(profile);
    } catch (err) {
      console.error("[fb-login] error:", err);
      toast.error(
        err instanceof Error ? err.message : "Falha ao conectar com Meta"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className={
        className ??
        "inline-flex items-center justify-center gap-2 rounded-md bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition"
      }
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Facebook className="w-4 h-4" />
      )}
      {loading ? "Conectando..." : label}
    </button>
  );
}
