import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Indicador discreto que aparece quando o navegador detecta
 * perda de conexão. Some sozinho quando volta online.
 *
 * Não substitui o fallback offline servido pelo Service Worker;
 * só dá feedback visual ao usuário em sessões já carregadas.
 */
export function OfflineIndicator() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full border bg-card/95 px-3 py-1.5 shadow-md backdrop-blur"
    >
      <span className="flex items-center gap-2 text-xs font-medium text-foreground">
        <WifiOff className="size-3.5 text-amber-500" aria-hidden="true" />
        Sem conexão. Tentando reconectar...
      </span>
    </div>
  );
}
