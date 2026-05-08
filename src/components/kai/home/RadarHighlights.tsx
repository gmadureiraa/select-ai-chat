import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Radar, ArrowRight, Flame, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useClients } from "@/hooks/useClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RadarHighlightsProps {
  onNavigate: (tab: string) => void;
}

interface RadarBriefRow {
  id: string;
  brief_date: string;
  niche: string;
  status: string;
  client_id: string;
  hot_topics: any[] | null;
  carousel_ideas: any[] | null;
  created_at: string;
}

export function RadarHighlights({ onNavigate }: RadarHighlightsProps) {
  const { workspace } = useWorkspaceContext();
  const { clients } = useClients();
  const workspaceId = workspace?.id;

  // Pega briefs recentes — viral_radar_briefs não tem workspace_id, então filtramos
  // por client_id pertencente ao workspace.
  const clientIds = (clients || []).map((c) => c.id);

  const { data: briefs, isLoading } = useQuery({
    queryKey: ["home-radar-briefs", workspaceId, clientIds.join(",")],
    queryFn: async () => {
      if (!clientIds.length) return [];
      const { data } = await supabase
        .from("viral_radar_briefs")
        .select(
          "id, brief_date, niche, status, client_id, hot_topics, carousel_ideas, created_at"
        )
        .in("client_id", clientIds)
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(5);
      return (data || []) as RadarBriefRow[];
    },
    enabled: !!workspaceId && clientIds.length > 0,
    staleTime: 60_000,
  });

  const getClientName = (clientId: string) =>
    clients?.find((c) => c.id === clientId)?.name || "—";

  const totalIdeas = (briefs || []).reduce(
    (sum, b) =>
      sum +
      ((b.hot_topics?.length ?? 0) + (b.carousel_ideas?.length ?? 0)),
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary" />
            Radar viral
            {totalIdeas > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 ml-1">
                {totalIdeas} ideias
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onNavigate("viral-radar-page")}
          >
            Abrir radar <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : !briefs || briefs.length === 0 ? (
            <div className="py-8 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum briefing de radar ainda
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5 mb-3">
                Gere ideias virais a partir do radar do seu cliente
              </p>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => onNavigate("viral-radar-page")}
              >
                <Radar className="h-3 w-3 mr-1.5" />
                Abrir radar
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {briefs.map((brief) => {
                const ideaCount =
                  (brief.hot_topics?.length ?? 0) +
                  (brief.carousel_ideas?.length ?? 0);
                const firstHook =
                  brief.hot_topics?.[0]?.topic ||
                  brief.hot_topics?.[0]?.title ||
                  brief.carousel_ideas?.[0]?.hook ||
                  brief.niche;
                return (
                  <div
                    key={brief.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => onNavigate("viral-radar-page")}
                  >
                    <div className="h-8 w-8 rounded-md bg-orange-500/10 flex items-center justify-center shrink-0">
                      <Flame className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate font-medium group-hover:text-foreground transition-colors">
                        {firstHook}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {getClientName(brief.client_id)}
                        </span>
                        <span className="text-[11px] text-muted-foreground/60">
                          ·{" "}
                          {formatDistanceToNow(new Date(brief.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                    {ideaCount > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5 shrink-0 bg-orange-500/8 text-orange-400 border-orange-500/20"
                      >
                        {ideaCount} ideias
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
