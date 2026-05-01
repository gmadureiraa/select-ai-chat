import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type SyncPlatform = "instagram" | "tiktok" | "twitter" | "youtube" | "linkedin";

interface PlatformSyncButtonProps {
  platform: SyncPlatform;
  clientId: string;
  className?: string;
  size?: "sm" | "default";
}

// Estimated cost per single (client × platform) sync run, in USD.
// Based on Apify per-call pricing (orchestrator constants).
const COST_PER_SYNC: Record<SyncPlatform, number> = {
  instagram: 0.03,
  tiktok: 0.01,
  twitter: 0.01,
  youtube: 0,
  linkedin: 0, // disabled
};

const FN_NAME: Record<SyncPlatform, string> = {
  instagram: "fetch-instagram-metrics",
  tiktok: "fetch-tiktok-apify",
  twitter: "fetch-twitter-apify",
  youtube: "fetch-youtube-apify",
  linkedin: "fetch-linkedin-apify",
};

const LABEL: Record<SyncPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X / Twitter",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

export const PlatformSyncButton = ({
  platform,
  clientId,
  className,
  size = "sm",
}: PlatformSyncButtonProps) => {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const queryClient = useQueryClient();

  // LinkedIn desativado por decisão de produto.
  if (platform === "linkedin") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size={size} variant="outline" disabled className={cn("gap-2 opacity-60", className)}>
              <Lock className="h-3.5 w-3.5" />
              Sync indisponível
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Sincronização automática para LinkedIn está desativada. Use upload de CSV.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const cost = COST_PER_SYNC[platform];
  const isFree = cost === 0;

  const runSync = async () => {
    setRunning(true);
    setOpen(false);
    const toastId = toast.loading(`Sincronizando ${LABEL[platform]}…`);
    try {
      const { data, error } = await supabase.functions.invoke(FN_NAME[platform], {
        body: { clientId },
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || "Sync falhou");
      }
      toast.success(
        `${LABEL[platform]} sincronizado${isFree ? "" : ` · ~$${cost.toFixed(2)}`}`,
        { id: toastId }
      );

      // Invalida queries da plataforma para recarregar UI.
      const invalidations: string[][] = [];
      if (platform === "instagram") invalidations.push(["instagram-posts", clientId], ["performance-metrics", clientId, "instagram"]);
      if (platform === "tiktok") invalidations.push(["tiktok-posts", clientId], ["performance-metrics", clientId, "tiktok"]);
      if (platform === "twitter") invalidations.push(["twitter-posts", clientId]);
      if (platform === "youtube") invalidations.push(["youtube-videos", clientId]);
      await Promise.all(invalidations.map((k) => queryClient.invalidateQueries({ queryKey: k })));
    } catch (e: any) {
      toast.error(`Erro: ${e.message || "falha desconhecida"}`, { id: toastId });
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Button
        size={size}
        variant="outline"
        onClick={() => (isFree ? runSync() : setOpen(true))}
        disabled={running}
        className={cn("gap-2", className)}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", running && "animate-spin")} />
        {running ? "Sincronizando…" : `Sincronizar ${LABEL[platform]}`}
        {!isFree && (
          <span className="text-[10px] text-muted-foreground border border-border/50 rounded px-1 py-0.5 ml-1">
            ~${cost.toFixed(2)}
          </span>
        )}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sincronizar métricas do {LABEL[platform]}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Vamos puxar dados públicos do {LABEL[platform]} via Apify para este cliente.
                </p>
                <div className="rounded-md border border-border/40 bg-muted/30 p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Custo estimado</span>
                    <strong className="text-foreground">~${cost.toFixed(2)} USD</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plataforma</span>
                    <span>{LABEL[platform]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Escopo</span>
                    <span>somente este cliente</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cobrado pelo Apify por chamada. Use sob demanda.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runSync}>Sincronizar agora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
