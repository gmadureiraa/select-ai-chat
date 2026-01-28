import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
