import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Youtube, Link2, Unlink, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useYouTubeConnection, useStartYouTubeOAuth, useFetchYouTubeAnalytics, useDisconnectYouTube } from "@/hooks/useYouTubeOAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface YouTubeConnectionCardProps {
  clientId: string;
}

export function YouTubeConnectionCard({ clientId }: YouTubeConnectionCardProps) {
  const { data: connection, isLoading } = useYouTubeConnection(clientId);
  const startOAuth = useStartYouTubeOAuth();
  const fetchAnalytics = useFetchYouTubeAnalytics();
  const disconnect = useDisconnectYouTube();

  const isConnected = !!connection;

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-48 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <Youtube className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-base">YouTube Analytics</CardTitle>
              <CardDescription className="text-sm">
                {isConnected 
                  ? `Conectado: ${connection.channel_title || 'Canal'}` 
                  : 'Conecte sua conta para métricas automáticas'
                }
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={isConnected 
              ? "text-green-500 border-green-500/30" 
              : "text-muted-foreground border-muted-foreground/30"
            }
          >
            {isConnected ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Conectado
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Desconectado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && connection.updated_at && (
          <p className="text-xs text-muted-foreground">
            Última sincronização: {formatDistanceToNow(new Date(connection.updated_at), { 
              addSuffix: true, 
              locale: ptBR 
            })}
          </p>
        )}

        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchAnalytics.mutate(clientId)}
                disabled={fetchAnalytics.isPending}
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${fetchAnalytics.isPending ? 'animate-spin' : ''}`} />
                Sincronizar Métricas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnect.mutate(clientId)}
                disabled={disconnect.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Unlink className="h-4 w-4 mr-2" />
                Desconectar
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => startOAuth.mutate(clientId)}
              disabled={startOAuth.isPending}
              className="w-full"
            >
              <Link2 className="h-4 w-4 mr-2" />
              Conectar com Google
            </Button>
          )}
        </div>

        {!isConnected && (
          <p className="text-xs text-muted-foreground">
            Ao conectar, você autoriza acesso de leitura às métricas do seu canal YouTube.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
