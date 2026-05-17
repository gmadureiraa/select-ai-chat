import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

/**
 * PageLoader — fallback genérico de Suspense pra páginas/rotas inteiras.
 * Mostra um esqueleto vagamente parecido com a estrutura sidebar + main do app
 * pra evitar layout shift quando o chunk lazy chega.
 */
export function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando página"
      className="flex h-dvh w-full bg-background"
    >
      {/* Sidebar skeleton */}
      <div
        aria-hidden="true"
        className="hidden md:flex flex-col w-60 border-r border-border/50 p-3 gap-2"
      >
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-full mt-2" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-full mt-auto" />
      </div>
      {/* Main skeleton */}
      <main id="main-content" className="flex-1 flex items-center justify-center">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">Carregando…</span>
      </main>
    </div>
  );
}

/**
 * TabLoader — fallback compacto para Suspense de tabs internas dentro do Kai.
 * Não tenta imitar sidebar (já está renderizada eager).
 */
export function TabLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando seção"
      className="flex items-center justify-center h-full w-full"
    >
      <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-primary" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
