import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, Download, Check, X } from "lucide-react";
import { getManualMetricsForPlatform, getAutomaticMetricsForPlatform } from "@/hooks/useLateAnalyticsSync";

interface CSVImportExplanationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: string;
  onProceed: () => void;
}

const metricLabels: Record<string, string> = {
  likes: "Curtidas",
  comments: "Comentários",
  shares: "Compartilhamentos",
  impressions: "Impressões",
  reach: "Alcance",
  engagement_rate: "Taxa de Engajamento",
  saves: "Salvamentos",
  link_clicks: "Cliques no Link",
  profile_visits: "Visitas ao Perfil",
  website_taps: "Toques no Site",
  retweets: "Retweets",
  replies: "Respostas",
  bookmarks: "Favoritos",
  clicks: "Cliques",
  video_views: "Views de Vídeo",
  follows: "Novos Seguidores",
};

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
};

export function CSVImportExplanationModal({ 
  open, 
  onOpenChange, 
  platform, 
  onProceed 
}: CSVImportExplanationModalProps) {
  const automaticMetrics = getAutomaticMetricsForPlatform(platform);
  const manualMetrics = getManualMetricsForPlatform(platform);
  const platformLabel = platformLabels[platform] || platform;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            Importar CSV do {platformLabel}
          </DialogTitle>
          <DialogDescription>
            Algumas métricas são puxadas automaticamente, outras precisam de CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Automatic Metrics */}
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <h4 className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2 mb-2">
              <Check className="h-4 w-4" />
              Métricas Automáticas (via Late API)
            </h4>
            <div className="flex flex-wrap gap-2">
              {automaticMetrics.map(metric => (
                <span 
                  key={metric}
                  className="px-2 py-1 rounded-full bg-green-500/20 text-green-700 dark:text-green-300 text-xs"
                >
                  {metricLabels[metric] || metric}
                </span>
              ))}
            </div>
          </div>

          {/* Manual Metrics */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <h4 className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-2">
              <X className="h-4 w-4" />
              Métricas do CSV (não disponíveis via API)
            </h4>
            <div className="flex flex-wrap gap-2">
              {manualMetrics.map(metric => (
                <span 
                  key={metric}
                  className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs"
                >
                  {metricLabels[metric] || metric}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Baixe o CSV do {platformLabel} para ter acesso a essas métricas.
            </p>
          </div>

          {/* Tips */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>💡 <strong>Dica:</strong> Use o botão "Sincronizar" regularmente para manter as métricas automáticas atualizadas.</p>
            <p>✏️ Você também pode editar métricas manualmente clicando no post.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => { onProceed(); onOpenChange(false); }}>
            <Download className="h-4 w-4 mr-2" />
            Continuar com Importação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
