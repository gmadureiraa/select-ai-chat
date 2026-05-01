import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AutoSyncStatusProps {
  clientId?: string;
  className?: string;
}

interface SyncRow {
  platform: string;
  status: string;
  created_at: string;
  duration_ms: number | null;
  error_message: string | null;
}

const PLATFORMS = ["instagram", "tiktok", "twitter", "linkedin", "youtube"];

export const AutoSyncStatus = ({ clientId, className }: AutoSyncStatusProps) => {
  const [rows, setRows] = useState<SyncRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("metrics_sync_runs" as any)
      .select("platform,status,created_at,duration_ms,error_message")
      .order("created_at", { ascending: false })
      .limit(50);
    if (clientId) q = q.eq("client_id", clientId);
    const { data } = await q;
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const latestPerPlatform = PLATFORMS.map((p) => {
    const last = rows.find((r) => r.platform === p);
    return { platform: p, last };
  });

  const lastAny = rows[0];

  const triggerNow = async () => {
    setRunning(true);
    toast.info("Disparando sync de métricas...");
    try {
      const { data, error } = await supabase.functions.invoke("sync-all-metrics", {
        body: { source: "manual", ...(clientId ? { clientId } : {}) },
      });
      if (error) throw error;
      toast.success(`Sync concluído: ${data?.ok || 0} ok, ${data?.failed || 0} falhas (~$${data?.estimated_cost_usd ?? 0})`);
      await load();
    } catch (e: any) {
      toast.error(`Falha no sync: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={cn("rounded-lg border border-border/40 bg-card/40 p-3", className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {loading ? (
            <span>carregando status…</span>
          ) : lastAny ? (
            <span>
              Última sync automática:{" "}
              <strong className="text-foreground">
                {formatDistanceToNow(new Date(lastAny.created_at), { addSuffix: true, locale: ptBR })}
              </strong>
              {" · "}cron diário às 06h BRT
            </span>
          ) : (
            <span>Sem sync ainda · cron diário 06h BRT</span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={triggerNow} disabled={running}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", running && "animate-spin")} />
          Sync agora
        </Button>
      </div>

      <TooltipProvider>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {latestPerPlatform.map(({ platform, last }) => {
            const ok = last?.status === "success";
            const failed = last?.status === "failed";
            const skipped = !last;
            return (
              <Tooltip key={platform}>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] uppercase tracking-wide gap-1",
                      ok && "border-emerald-500/40 text-emerald-300",
                      failed && "border-red-500/50 text-red-300",
                      skipped && "border-border/40 text-muted-foreground",
                    )}
                  >
                    {ok && <CheckCircle2 className="h-3 w-3" />}
                    {failed && <AlertTriangle className="h-3 w-3" />}
                    {platform}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {last ? (
                    <div className="text-xs space-y-0.5">
                      <div>Status: <strong>{last.status}</strong></div>
                      <div>Há {formatDistanceToNow(new Date(last.created_at), { locale: ptBR })}</div>
                      {last.duration_ms != null && <div>Duração: {(last.duration_ms / 1000).toFixed(1)}s</div>}
                      {last.error_message && <div className="text-red-300 max-w-[260px]">Erro: {last.error_message}</div>}
                    </div>
                  ) : (
                    <span className="text-xs">Sem handle configurado ou ainda não rodou</span>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
};
