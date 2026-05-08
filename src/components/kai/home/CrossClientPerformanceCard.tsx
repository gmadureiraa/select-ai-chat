import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Layers, Film, Hash, Users2 } from "lucide-react";
import { useWorkspaceContentAggregate } from "@/hooks/useWorkspaceContentAggregate";
import { Button } from "@/components/ui/button";

interface CrossClientPerformanceCardProps {
  onSelectClient?: (clientId: string) => void;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

export function CrossClientPerformanceCard({
  onSelectClient,
}: CrossClientPerformanceCardProps) {
  const { data, isLoading } = useWorkspaceContentAggregate();

  // Filtra clientes com pelo menos 1 item (escondendo zerados)
  const ranked = (data ?? []).filter((d) => d.items_count > 0).slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users2 className="h-4 w-4 text-primary" />
          Performance cross-cliente
          <Badge variant="secondary" className="text-[10px] ml-auto">
            workspace
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum cliente com conteúdo na biblioteca ainda.
            <br />
            <span className="text-xs">
              Importe posts ou crie carrosseis pra ver ranking aqui.
            </span>
          </p>
        ) : (
          <div className="space-y-1.5">
            {ranked.map((c, idx) => (
              <button
                key={c.client_id}
                type="button"
                onClick={() => onSelectClient?.(c.client_id)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">
                  #{idx + 1}
                </span>
                <Avatar className="h-7 w-7">
                  <AvatarImage src={c.client_avatar ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {c.client_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {c.client_name}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Layers className="h-3 w-3" /> {c.carousel_count}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Film className="h-3 w-3" /> {c.reel_count}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Hash className="h-3 w-3" /> {c.thread_count}
                    </span>
                    <span className="ml-auto">{c.items_count} itens</span>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    {formatNumber(c.total_engagement)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatNumber(c.avg_engagement)} méd
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        {(data?.length ?? 0) > ranked.length && (
          <Button variant="ghost" size="sm" className="w-full text-xs">
            Ver todos {data!.length} clientes
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
