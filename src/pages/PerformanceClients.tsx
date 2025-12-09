import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useClientDataSummary } from "@/hooks/useChannelDataStatus";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PerformanceClients() {
  const navigate = useNavigate();
  const { clients, isLoading: clientsLoading } = useClients();
  const { data: dataSummary, isLoading: summaryLoading } = useClientDataSummary();

  const isLoading = clientsLoading || summaryLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const getClientSummary = (clientId: string) => {
    return dataSummary?.find(s => s.clientId === clientId);
  };

  const getStatusBadge = (summary: ReturnType<typeof getClientSummary>) => {
    if (!summary || summary.platformsWithData.length === 0) {
      return (
        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 gap-1">
          <AlertCircle className="h-3 w-3" />
          Sem dados
        </Badge>
      );
    }

    const isStale = summary.lastUpdate && 
      new Date(summary.lastUpdate) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (isStale) {
      return (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 gap-1">
          <Clock className="h-3 w-3" />
          Desatualizado
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-green-500 border-green-500/30 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {summary.platformsWithData.length} {summary.platformsWithData.length === 1 ? 'canal' : 'canais'}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Análise de Performance</h1>
        <p className="text-muted-foreground">
          Escolha um cliente para visualizar métricas e insights de performance
        </p>
      </div>

      {/* Client Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {clients?.map((client) => {
          const summary = getClientSummary(client.id);
          
          return (
            <Card
              key={client.id}
              className={`p-6 border-border/50 bg-card/50 hover:border-border transition-all cursor-pointer group ${
                !summary?.platformsWithData.length ? 'border-dashed' : ''
              }`}
              onClick={() => navigate(`/client/${client.id}/performance`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <BarChart3 className="h-5 w-5 text-foreground mt-0.5" />
                  <h3 className="font-semibold text-lg">{client.name}</h3>
                </div>
                {getStatusBadge(summary)}
              </div>
              
              {client.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {client.description}
                </p>
              )}

              {summary && summary.platformsWithData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {summary.platformsWithData.map(platform => (
                      <Badge 
                        key={platform} 
                        variant="secondary" 
                        className="text-xs capitalize"
                      >
                        {platform === 'newsletter' ? 'Newsletter' : platform}
                      </Badge>
                    ))}
                  </div>
                  {summary.lastUpdate && (
                    <p className="text-xs text-muted-foreground">
                      Atualizado {formatDistanceToNow(new Date(summary.lastUpdate), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </p>
                  )}
                </div>
              )}

              {(!summary || summary.platformsWithData.length === 0) && (
                <p className="text-xs text-muted-foreground">
                  Clique para configurar coleta de métricas
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
