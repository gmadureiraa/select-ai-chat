import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Rss, Save, ExternalLink, RefreshCw } from "lucide-react";

interface RSSConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  platform: "newsletter" | "youtube";
  onSave?: () => void;
}

export function RSSConfigDialog({ open, onOpenChange, clientId, platform, onSave }: RSSConfigDialogProps) {
  const [rssUrl, setRssUrl] = useState("");
  const [autoSync, setAutoSync] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const platformLabels = {
    newsletter: {
      title: "Configurar RSS da Newsletter",
      description: "Configure o feed RSS para importar automaticamente novas edições.",
      placeholder: "https://feed.beehiiv.com/xxx ou URL do feed RSS",
      fieldLabel: "URL do Feed RSS",
      fieldKey: "newsletter_rss",
    },
    youtube: {
      title: "Configurar Canal do YouTube",
      description: "Configure o canal para importar automaticamente novos vídeos.",
      placeholder: "youtube.com/channel/UC... ou ID do canal",
      fieldLabel: "URL ou ID do Canal",
      fieldKey: "youtube_channel_id",
    },
  };

  const config = platformLabels[platform];

  // Fetch existing RSS config
  useEffect(() => {
    if (open && clientId) {
      setIsFetching(true);
      supabase
        .from("clients")
        .select("social_media")
        .eq("id", clientId)
        .single()
        .then(({ data, error }) => {
          if (!error && data?.social_media) {
            const socialMedia = data.social_media as Record<string, any>;
            setRssUrl(socialMedia[config.fieldKey] || "");
            setAutoSync(socialMedia[`${config.fieldKey}_auto_sync`] !== false);
          }
          setIsFetching(false);
        });
    }
  }, [open, clientId, config.fieldKey]);

  // Sync newsletter to library using the new edge function
  const syncToLibrary = async (feedUrl: string) => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-rss-to-library", {
        body: { 
          clientId,
          platform: "newsletter",
          rssUrl: feedUrl,
          mode: "only_missing",
          limit: 50
        }
      });

      if (error) throw error;

      if (data?.created > 0 || data?.updated > 0) {
        toast.success(`${data.created} novas edições importadas, ${data.updated} atualizadas`);
        queryClient.invalidateQueries({ queryKey: ["newsletter-posts", clientId] });
        queryClient.invalidateQueries({ queryKey: ["platform-metrics", clientId] });
        queryClient.invalidateQueries({ queryKey: ["unified-content", clientId] });
        queryClient.invalidateQueries({ queryKey: ["content-library", clientId] });
        queryClient.invalidateQueries({ queryKey: ["client-content-library", clientId] });
      } else if (data?.total > 0) {
        toast.info("Todas as edições já estão sincronizadas");
      } else {
        toast.info("Nenhuma edição encontrada no feed");
      }
    } catch (error) {
      console.error("Error syncing newsletter RSS:", error);
      toast.error("Erro ao sincronizar newsletter");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncNow = async () => {
    if (!rssUrl.trim()) {
      toast.error("Configure a URL do RSS primeiro");
      return;
    }
    await syncToLibrary(rssUrl.trim());
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Get current social_media
      const { data: clientData } = await supabase
        .from("clients")
        .select("social_media")
        .eq("id", clientId)
        .single();

      const currentSocialMedia = (clientData?.social_media as Record<string, any>) || {};
      
      // Update with new RSS config
      const updatedSocialMedia = {
        ...currentSocialMedia,
        [config.fieldKey]: rssUrl.trim(),
        [`${config.fieldKey}_auto_sync`]: autoSync,
      };

      const { error } = await supabase
        .from("clients")
        .update({ social_media: updatedSocialMedia })
        .eq("id", clientId);

      if (error) throw error;

      // If auto-sync is enabled and we have a URL, sync to library now
      if (autoSync && rssUrl.trim() && platform === "newsletter") {
        await syncToLibrary(rssUrl.trim());
      }

      toast.success("Configuração RSS salva!");
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      onSave?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving RSS config:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Rss className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle>{config.title}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {config.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isFetching ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="rss-url">{config.fieldLabel}</Label>
                <Input
                  id="rss-url"
                  placeholder={config.placeholder}
                  value={rssUrl}
                  onChange={(e) => setRssUrl(e.target.value)}
                />
                {platform === "newsletter" && (
                  <p className="text-xs text-muted-foreground">
                    Beehiiv, Substack, ConvertKit e outros feeds RSS são suportados.
                  </p>
                )}
                {platform === "youtube" && (
                  <p className="text-xs text-muted-foreground">
                    Use o ID do canal (começa com UC) ou a URL completa do canal.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync" className="font-normal">
                    Sincronização automática
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Importar novos conteúdos automaticamente
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={autoSync}
                  onCheckedChange={setAutoSync}
                />
              </div>

              {rssUrl && (
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-muted/50 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ExternalLink className="h-3 w-3" />
                      <span>Feed configurado:</span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] break-all">{rssUrl}</p>
                  </div>
                  
                  {platform === "newsletter" && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={handleSyncNow}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sincronizar Agora
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading || isFetching}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
