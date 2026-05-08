/**
 * Plans page (KAI integration override).
 *
 * O standalone Sequencia Viral tinha tela propria de planos com checkout
 * Stripe direto. No KAI integrado, billing e centralizado em
 * `src/components/billing/BillingTab.tsx` (4 tiers Free/Starter/Pro/Enterprise).
 *
 * Em vez de duplicar UI ou disparar Stripe daqui, redirecionamos pra tab
 * `?tab=billing` do shell do KAI. Mantemos a rota `#/plans` viva (links
 * antigos como dashboard.tsx -> "/app/plans" ainda funcionam) — so que o
 * destino real e o BillingTab.
 *
 * UX: mostra um card cream + REC com loader curto antes do redirect, pra
 * que a transicao nao seja brusca. Nao usa Suspense/lazy aqui — pagina
 * leve, ja esta no chunk principal do MainApp.
 */

import { useEffect } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@sv/lib/auth-context";

function navigateToKaiBilling() {
  if (typeof window === "undefined") return;
  // Atualiza search param `tab=billing` mantendo `client=` se houver.
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "billing");
  // Limpa hash do mini-router pra nao re-renderizar dentro do tab errado.
  url.hash = "";
  window.history.pushState({}, "", url.toString());
  // Dispara popstate manual pra acordar o useSearchParams do Kai.tsx.
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function PlansPage() {
  const { profile } = useAuth();
  const currentPlan = profile?.plan ?? "free";

  useEffect(() => {
    // Redireciona automaticamente apos 600ms (deixa o card aparecer).
    const t = window.setTimeout(navigateToKaiBilling, 600);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto max-w-2xl py-16">
      <span className="sv-eyebrow mb-6">
        <span className="sv-dot" />
        Planos · Edição nº 04
      </span>
      <h1
        className="sv-display mt-6"
        style={{
          fontSize: "clamp(36px, 6vw, 64px)",
          lineHeight: 0.98,
          letterSpacing: "-0.02em",
        }}
      >
        Cobrança ficou no <em>KAI</em>.
      </h1>
      <p
        className="mt-5"
        style={{
          fontFamily: "var(--sv-sans)",
          fontSize: 16,
          color: "var(--sv-muted)",
          maxWidth: 540,
          lineHeight: 1.55,
        }}
      >
        A gestão de planos agora vive na aba <strong>Billing</strong> do KAI —
        mesmo lugar onde você gerencia tokens, membros e workspace. Vamos te
        levar pra lá em um instante.
      </p>

      <div
        className="sv-card mt-10 flex items-center justify-between gap-4"
        style={{ padding: 24 }}
      >
        <div className="flex items-center gap-3">
          <Loader2
            size={18}
            className="animate-spin"
            style={{ color: "var(--sv-ink)" }}
          />
          <div>
            <div
              className="sv-kicker"
              style={{ color: "var(--sv-muted)", fontSize: 9.5 }}
            >
              Plano atual · {currentPlan}
            </div>
            <div
              style={{
                fontFamily: "var(--sv-sans)",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--sv-ink)",
                marginTop: 2,
              }}
            >
              Redirecionando pra cobrança KAI...
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={navigateToKaiBilling}
          className="sv-btn-primary"
          style={{ minWidth: 180, justifyContent: "center" }}
        >
          Ir agora
          <ArrowRight size={13} />
        </button>
      </div>

      <p
        className="mt-6"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 11,
          letterSpacing: "0.08em",
          color: "var(--sv-muted)",
        }}
      >
        Se nada acontecer em 2s, clica no botão acima.
      </p>
    </div>
  );
}
