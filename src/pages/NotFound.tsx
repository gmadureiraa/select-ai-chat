import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Compass,
  Home,
  ArrowLeft,
  LayoutDashboard,
  Mail,
} from "lucide-react";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

const REDIRECT_SECONDS = 10;

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [paused, setPaused] = useState(false);

  // Auto-redirect pra home depois de N segundos (cancela em qualquer interação).
  useEffect(() => {
    if (paused) return;
    if (countdown <= 0) {
      navigate("/", { replace: true });
      return;
    }
    const timer = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, paused, navigate]);

  // Pausa o auto-redirect se o user mexer no mouse/teclado
  useEffect(() => {
    const cancel = () => setPaused(true);
    window.addEventListener("keydown", cancel, { once: true });
    window.addEventListener("mousemove", cancel, { once: true });
    return () => {
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("mousemove", cancel);
    };
  }, []);

  const reportSubject = encodeURIComponent("Erro 404 no KAI");
  const reportBody = encodeURIComponent(
    `Olá! Encontrei um link quebrado em:\n\n${window.location.href}\n\nVeio de: ${document.referrer || "—"}\n\n`
  );

  return (
    <main
      id="main-content"
      className="min-h-[100dvh] bg-background flex items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-lg space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5">
          <img src={kaleidosLogo} alt="" aria-hidden="true" className="h-7 w-7" />
          <span className="text-xl font-semibold tracking-tight">
            <span className="sr-only">KAI - </span>
            k<span className="text-primary">AI</span>
          </span>
        </div>

        {/* Hero icon + número 404 */}
        <div className="relative flex items-center justify-center py-4">
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="text-[180px] sm:text-[220px] font-black leading-none text-primary/[0.06] select-none tabular-nums">
              404
            </span>
          </div>
          <div className="relative">
            <div className="rounded-full bg-primary/10 p-6 sm:p-8 ring-1 ring-primary/20">
              <Compass
                aria-hidden="true"
                className="h-14 w-14 sm:h-16 sm:w-16 text-primary animate-[spin_8s_linear_infinite]"
                strokeWidth={1.5}
              />
            </div>
          </div>
        </div>

        {/* Texto */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Página não encontrada
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
            O caminho{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted text-foreground/80 text-xs font-mono break-all">
              {location.pathname}
            </code>{" "}
            não existe ou foi movido. Vamos te levar de volta?
          </p>
        </div>

        {/* CTAs primárias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-2 h-11"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar
          </Button>
          <Button
            onClick={() => navigate("/", { replace: true })}
            className="gap-2 h-11"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Ir pra home
          </Button>
        </div>

        <Button
          variant="ghost"
          onClick={() => navigate("/kaleidos", { replace: true })}
          className="w-full gap-2 h-11 text-muted-foreground hover:text-foreground"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          Abrir Workspace
        </Button>

        {/* Footer: auto-redirect + reportar */}
        <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          {paused || countdown <= 0 ? (
            <span>Você ficou. A gente respeita.</span>
          ) : (
            <span className="tabular-nums">
              Redirecionando pra home em{" "}
              <strong className="text-foreground">{countdown}s</strong>
            </span>
          )}
          <a
            href={`mailto:contato@kaleidos.com.br?subject=${reportSubject}&body=${reportBody}`}
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            Reportar este erro
          </a>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
