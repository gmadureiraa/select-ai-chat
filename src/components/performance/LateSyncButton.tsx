import { useState } from "react";
import { RefreshCw, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useLateAnalyticsSync, useLastSyncTime } from "@/hooks/useLateAnalyticsSync";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LateSyncButtonProps {
  clientId: string;
  platform?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  showLastSync?: boolean;
}

export function LateSyncButton({ 
  clientId, 
  platform, 
  variant = "outline",
  size = "sm",
  showLastSync = true,
}: LateSyncButtonProps) {
  const syncMutation = useLateAnalyticsSync();
  const { data: syncTimes } = useLastSyncTime(clientId, platform);
  
  const lastSync = platform && syncTimes ? syncTimes[platform] : null;

  const handleSync = () => {
    syncMutation.mutate({ clientId, platform, daysBack: 30 });
  };

  const formatLastSync = () => {
    if (!lastSync) return "Nunca sincronizado";
    try {
      return `Última sync: ${formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: ptBR })}`;
    } catch {
      return "Sincronizado";
    }
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              onClick={handleSync}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${size !== "icon" ? "mr-2" : ""} ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {size !== "icon" && (syncMutation.isPending ? "Sincronizando..." : "Sincronizar")}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Puxar métricas automaticamente via Late API</p>
            {lastSync && <p className="text-xs text-muted-foreground">{formatLastSync()}</p>}
          </TooltipContent>
        </Tooltip>

        {showLastSync && lastSync && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatLastSync()}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
