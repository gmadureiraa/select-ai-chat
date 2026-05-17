import { ReactNode } from "react";
import { Clock, LogOut, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface PendingAccessOverlayProps {
  children: ReactNode;
  workspaceName?: string;
  requestStatus?: string;
}

// Placeholder honesto que substitui o ex-dashboard mockado.
//
// 2026-05-16 — audit/frontend-ux-mobile.md Inc-1: o overlay antes renderizava
// um dashboard de Performance com KPIs inventados ("124.5K seguidores",
// "+12.3%") + barras hardcoded + lista de "Top Conteúdos" fictícios.
// Com blur leve dava pra ler os textos, passando impressão errada de que tinha
// dados reais ali. Substituído por skeleton geométrico neutro (sem números,
// sem títulos editorial), só pra dar contexto visual de "tem um app por trás".
const PendingAccessSkeleton = () => {
  return (
    <div className="p-6 space-y-6" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted/60 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-9 bg-muted/60 rounded-md" />
          <div className="h-9 w-9 bg-muted/60 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-lg bg-card border border-border/50 space-y-3"
          >
            <div className="h-9 w-9 bg-muted rounded-lg" />
            <div className="h-3 w-20 bg-muted/60 rounded" />
            <div className="h-6 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-lg bg-card border border-border/50 space-y-4">
          <div className="h-5 w-44 bg-muted rounded" />
          <div className="h-48 bg-muted/40 rounded" />
        </div>
        <div className="p-6 rounded-lg bg-card border border-border/50 space-y-4">
          <div className="h-5 w-40 bg-muted rounded" />
          <div className="h-48 bg-muted/40 rounded flex items-center justify-center">
            <div className="h-32 w-32 rounded-full border-8 border-muted" />
          </div>
        </div>
      </div>

      <div className="p-6 rounded-lg bg-card border border-border/50 space-y-4">
        <div className="h-5 w-36 bg-muted rounded" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
            >
              <div className="h-4 w-2/3 bg-muted/60 rounded" />
              <div className="h-4 w-16 bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PendingAccessOverlay = ({
  workspaceName,
  requestStatus = "pending",
}: PendingAccessOverlayProps) => {
  const { signOut } = useAuth();

  const isRejected = requestStatus === "rejected";

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Skeleton de UI por trás — sem números/títulos inventados, só shapes
          pra indicar "tem um produto aqui". */}
      <div className="blur-[2px] pointer-events-none select-none opacity-60">
        <div className="flex h-dvh">
          <div className="w-60 border-r border-border bg-sidebar p-4 space-y-4" aria-hidden="true">
            <div className="h-8 w-24 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
            <div className="space-y-2 mt-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-8 bg-muted/50 rounded" />
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-background">
            <PendingAccessSkeleton />
          </div>
        </div>
      </div>

      {/* Overlay centralizado */}
      <div className="absolute inset-0 flex items-center justify-center z-50 bg-background/40">
        <div className="text-center space-y-6 p-10 rounded-2xl bg-card border border-border/50 shadow-2xl max-w-md mx-4">
          <div
            className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
              isRejected ? "bg-destructive/10" : "bg-primary/10"
            }`}
          >
            {isRejected ? (
              <XCircle className="w-8 h-8 text-destructive" />
            ) : (
              <Clock className="w-8 h-8 text-primary" />
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              {isRejected ? "Acesso Negado" : "Aguardando aprovação"}
            </h2>
            {workspaceName && (
              <p className="text-lg font-medium text-primary">{workspaceName}</p>
            )}
            <p className="text-muted-foreground">
              {isRejected
                ? "Seu pedido de acesso foi recusado pelo administrador."
                : "Seu pedido de acesso está sendo analisado pelo administrador da equipe."}
            </p>
          </div>

          <Button variant="outline" onClick={signOut} className="mt-4">
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
};
