import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const CHUNK_LOAD_FAILURE_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|error loading dynamically imported module/i;

function isChunkLoadFailure(error: unknown) {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message)
          : "";

  return CHUNK_LOAD_FAILURE_RE.test(message);
}

function recoverFromStaleChunk() {
  const storageKey = "kai:stale-chunk-reload-at";
  const now = Date.now();
  const lastReload = Number(window.sessionStorage.getItem(storageKey) || 0);

  if (now - lastReload < 30_000) return;

  window.sessionStorage.setItem(storageKey, String(now));

  const reload = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("__kai_refresh", String(now));
    window.location.replace(url.toString());
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.update())))
      .catch((error) => {
        console.warn("[App] Failed to update Service Worker after chunk error:", error);
      })
      .finally(reload);
    return;
  }

  reload();
}

window.addEventListener("unhandledrejection", (event) => {
  if (!isChunkLoadFailure(event.reason)) return;

  event.preventDefault();
  recoverFromStaleChunk();
});

window.addEventListener(
  "error",
  (event) => {
    if (!isChunkLoadFailure(event.error || event.message)) return;

    event.preventDefault();
    recoverFromStaleChunk();
  },
  true,
);

const shouldNormalizeLocalhost =
  import.meta.env.DEV && window.location.hostname === "127.0.0.1";

if (shouldNormalizeLocalhost) {
  const url = new URL(window.location.href);
  url.hostname = "localhost";
  window.location.replace(url.toString());
} else {
  // Service Worker
  // - DEV: proactively unregister (prevents stale cached chunks causing React duplicate-instance hook crashes)
  // - PROD: register with safe update flow
  if ("serviceWorker" in navigator) {
    if (import.meta.env.DEV) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .then(() => {
          // No reload here to avoid loops; user refresh will be enough.
          console.log("[App] Service Worker unregistered in DEV");
        })
        .catch((error) => {
          console.warn("[App] Failed to unregister Service Worker in DEV:", error);
        });
    }

    if (import.meta.env.PROD) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[App] Service Worker registered:", registration.scope);

            // Ensure updates apply quickly (avoids mixed old/new JS chunks)
            registration.update?.();

            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing;
              if (!newWorker) return;

              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // Tell waiting SW to activate now
                  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
                }
              });
            });

            // Reload once the new SW takes control
            navigator.serviceWorker.addEventListener("controllerchange", () => {
              window.location.reload();
            });
          })
          .catch((error) => {
            console.error("[App] Service Worker registration failed:", error);
          });
      });
    }
  }

  createRoot(document.getElementById("root")!).render(<App />);
}
