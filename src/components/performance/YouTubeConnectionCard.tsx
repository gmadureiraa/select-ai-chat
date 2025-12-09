import { Card, CardContent } from "@/components/ui/card";
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
      <Card className="border-border/50">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-border/50 ${!isConnected ? 'border-dashed' : ''}`}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Youtube className="h-4 w-4 text-red-500" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">API YouTube</span>
              <Badge 
                variant="outline" 
                className={`text-xs ${isConnected 
                  ? "text-green-500 border-green-500/30" 
                  : "text-muted-foreground border-muted-foreground/30"
                }`}
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
              {isConnected && connection.channel_title && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {connection.channel_title}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected && connection.updated_at && (
              <span className="text-xs text-muted-foreground hidden md:inline">
                Sync {formatDistanceToNow(new Date(connection.updated_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </span>
            )}
            
            {isConnected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchAnalytics.mutate(clientId)}
                  disabled={fetchAnalytics.isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${fetchAnalytics.isPending ? 'animate-spin' : ''}`} />
                  Sincronizar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnect.mutate(clientId)}
                  disabled={disconnect.isPending}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => startOAuth.mutate(clientId)}
                disabled={startOAuth.isPending}
              >
                <Link2 className="h-3.5 w-3.5 mr-1.5" />
                Conectar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
