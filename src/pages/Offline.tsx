import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Página estática de fallback offline. Pode ser usada via SW
 * (cache) ou como rota se quisermos exibir explicitamente.
 */
export default function Offline() {
  const retry = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <main
      id="main-content"
      className="flex min-h-dvh items-center justify-center bg-background p-6"
    >
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
          <WifiOff className="size-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Você está offline
        </h1>
        <p className="text-sm text-muted-foreground">
          Não foi possível conectar ao KAI. Verifique sua conexão e tente
          novamente. Conteúdo cacheado pode continuar acessível.
        </p>
        <div className="pt-2">
          <Button onClick={retry}>
            <RefreshCw className="mr-2 size-4" aria-hidden="true" />
            Tentar novamente
          </Button>
        </div>
      </div>
    </main>
  );
}
