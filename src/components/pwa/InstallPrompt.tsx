import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "kai-pwa-install-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const dismissedAt = Number.parseInt(raw, 10);
    if (Number.isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // ignore (private mode etc.)
  }
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Já instalado? esconde tudo
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(display-mode: standalone)").matches
    ) {
      return;
    }
    if (wasRecentlyDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    const installedHandler = () => {
      setShow(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    try {
      setInstalling(true);
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "dismissed") {
        markDismissed();
      }
    } catch (err) {
      console.warn("[InstallPrompt] prompt failed", err);
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
      setShow(false);
    }
  };

  const dismiss = () => {
    markDismissed();
    setShow(false);
  };

  if (!show || !deferredPrompt) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar KAI"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-card p-4 shadow-lg animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Download className="size-5" aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium leading-tight">
            Instalar KAI no seu device
          </p>
          <p className="text-xs text-muted-foreground">
            Acesso rápido, atalhos e funciona offline.
          </p>
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={install} disabled={installing}>
              {installing ? "Instalando..." : "Instalar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Depois
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
