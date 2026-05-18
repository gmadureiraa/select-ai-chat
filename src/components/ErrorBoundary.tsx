import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isStaleChunkError } from "@/lib/lazyWithRetry";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /**
   * Quando true, renderiza fallback compacto (ideal para tabs lazy).
   * Default false = fallback "tela inteira" (ideal pra root).
   */
  compact?: boolean;
  /**
   * Texto opcional pra contextualizar o componente que crashou.
   */
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary global da app.
 *
 * Wrap em volta do <App> para evitar tela branca em qualquer crash de
 * componente, e em volta de cada tab lazy no Kai.tsx pra um tab quebrar
 * não derrubar a app inteira.
 *
 * Existe também `src/components/ui/error-boundary.tsx` (legado, com card
 * compacto). Esse aqui é o canônico — re-uso possível via `compact`.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const error = this.state.error;
    const message = error?.message ?? "Erro inesperado";
    // 2026-05-18 — detecta chunk stale (deploy novo invalidou hash do
    // chunk antigo). Mensagem específica em vez de erro genérico.
    const isStale = isStaleChunkError(error);

    if (this.props.compact) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center h-full min-h-[300px] p-6 text-center"
        >
          <div className={isStale ? "rounded-full bg-primary/10 p-3 mb-4" : "rounded-full bg-destructive/10 p-3 mb-4"}>
            {isStale ? (
              <Download aria-hidden="true" className="h-6 w-6 text-primary" />
            ) : (
              <AlertTriangle aria-hidden="true" className="h-6 w-6 text-destructive" />
            )}
          </div>
          <h3 className="text-lg font-semibold mb-1">
            {isStale ? "Versão nova disponível" : "Algo deu errado"}
          </h3>
          {this.props.context && !isStale && (
            <p className="text-xs uppercase tracking-wide text-muted-foreground/70 mb-2">
              {this.props.context}
            </p>
          )}
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            {isStale
              ? "O KAI foi atualizado enquanto você estava aqui. Recarregue a página pra pegar a versão nova (vai levar 1 segundo)."
              : message}
          </p>
          <div className="flex gap-2">
            {isStale ? (
              <Button
                onClick={this.handleReload}
                className="gap-2"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Recarregar agora
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleRetry}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Tentar novamente
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.handleReload}
                >
                  Recarregar página
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="min-h-dvh flex items-center justify-center bg-background p-6"
      >
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto rounded-full bg-destructive/10 p-4 w-fit">
            <AlertTriangle aria-hidden="true" className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Algo deu errado</h1>
            <p className="text-sm text-muted-foreground">
              Não conseguimos carregar essa parte da aplicação. Você pode
              tentar de novo ou recarregar a página.
            </p>
            {error && (
              <pre className="text-xs text-left bg-muted/40 p-3 rounded mt-3 overflow-auto max-h-40 border border-border">
                <code>{error.message}</code>
              </pre>
            )}
          </div>
          <div className="flex gap-2 justify-center pt-2">
            <Button onClick={this.handleRetry} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Tentar novamente
            </Button>
            <Button onClick={this.handleReload}>Recarregar página</Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
