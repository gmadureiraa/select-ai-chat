import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Library, 
  Loader2, 
  Check, 
  Rss, 
  ExternalLink 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface NewsletterSyncBadgeProps {
  postId: string;
  clientId: string;
  contentLibraryId?: string | null;
  subject?: string;
  metricDate?: string;
  metadata?: Record<string, unknown>;
  rssUrl?: string | null;
}

export function NewsletterSyncBadge({
  postId,
  clientId,
  contentLibraryId,
  subject,
  metricDate,
  metadata,
  rssUrl: initialRssUrl,
}: NewsletterSyncBadgeProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [showRssDialog, setShowRssDialog] = useState(false);
  const [rssUrl, setRssUrl] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSync = async () => {
    if (isSyncing || contentLibraryId || justSynced) return;

    // Check if we have RSS URL saved for this client
    const { data: client } = await supabase
      .from("clients")
      .select("social_media")
      .eq("id", clientId)
      .single();

    const savedRssUrl = (client?.social_media as any)?.newsletter_rss;

    if (savedRssUrl) {
      await syncWithRss(savedRssUrl);
    } else {
      // Show dialog to get RSS URL
      setShowRssDialog(true);
    }
  };

  const syncWithRss = async (feedUrl: string) => {
    setIsSyncing(true);
    try {
      // Fetch RSS feed
      const { data: rssData, error: rssError } = await supabase.functions.invoke(
        "fetch-rss-feed",
        {
          body: { rssUrl: feedUrl, limit: 50 },
        }
      );

      if (rssError) throw rssError;

      // Find matching item by date or subject
      let matchingItem = null;
      const items = rssData?.items || [];

      for (const item of items) {
        // Try to match by date
        if (metricDate && item.pubDate) {
          const itemDate = new Date(item.pubDate).toISOString().split("T")[0];
          if (itemDate === metricDate) {
            matchingItem = item;
            break;
          }
        }

        // Or match by subject similarity
        if (subject && item.title) {
          const subjectLower = subject.toLowerCase();
          const titleLower = item.title.toLowerCase();
          if (
            titleLower.includes(subjectLower.slice(0, 20)) ||
            subjectLower.includes(titleLower.slice(0, 20))
          ) {
            matchingItem = item;
            break;
          }
        }
      }

      let content = "";
      let contentUrl = "";

      if (matchingItem) {
        content = matchingItem.content || matchingItem.description || "";
        contentUrl = matchingItem.link || "";
      } else {
        // Use basic content
        content = `Edição da newsletter do dia ${metricDate}`;
      }

      // Extract first image from content as thumbnail
      const imageMatch = content.match(/!\[.*?\]\((.*?)\)/);
      const thumbnailUrl = matchingItem?.imageUrl || (imageMatch ? imageMatch[1] : null);

      // Create entry in content library with thumbnail
      const { data: libraryEntry, error: insertError } = await supabase
        .from("client_content_library")
        .insert({
          client_id: clientId,
          title: subject || matchingItem?.title || `Newsletter de ${metricDate}`,
          content: content,
          content_type: "newsletter",
          content_url: contentUrl,
          thumbnail_url: thumbnailUrl,
          metadata: {
            ...metadata,
            synced_from_metrics: true,
            metric_date: metricDate,
            platform_metric_id: postId,
            rss_synced: !!matchingItem,
            rss_url: feedUrl,
            all_images: matchingItem?.allImages || [],
          },
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Update platform_metrics with content_library_id
      const { error: updateError } = await supabase
        .from("platform_metrics")
        .update({ content_library_id: libraryEntry.id })
        .eq("id", postId);

      if (updateError) throw updateError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["platform-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-posts"] });
      queryClient.invalidateQueries({ queryKey: ["client-content-library"] });

      setJustSynced(true);
      toast({
        title: "Newsletter sincronizada",
        description: matchingItem
          ? "Conteúdo real importado do RSS."
          : "Conteúdo adicionado à biblioteca.",
      });
    } catch (error) {
      console.error("Error syncing to library:", error);
      toast({
        title: "Erro ao sincronizar",
        description: "Não foi possível adicionar à biblioteca.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveRssAndSync = async () => {
    if (!rssUrl.trim()) {
      toast({
        title: "URL inválida",
        description: "Digite a URL do RSS da newsletter.",
        variant: "destructive",
      });
      return;
    }

    setIsFetching(true);
    try {
      // Test the RSS URL
      const { data: testData, error: testError } = await supabase.functions.invoke(
        "fetch-rss-feed",
        {
          body: { rssUrl: rssUrl.trim(), limit: 5 },
        }
      );

      if (testError) throw testError;

      if (!testData?.items?.length) {
        toast({
          title: "RSS inválido",
          description: "Não foi possível encontrar itens no feed RSS.",
          variant: "destructive",
        });
        return;
      }

      // Save RSS URL to client
      const { data: client } = await supabase
        .from("clients")
        .select("social_media")
        .eq("id", clientId)
        .single();

      const currentSocialMedia = (client?.social_media as any) || {};

      const { error: updateClientError } = await supabase
        .from("clients")
        .update({
          social_media: {
            ...currentSocialMedia,
            newsletter_rss: rssUrl.trim(),
          },
        })
        .eq("id", clientId);

      if (updateClientError) throw updateClientError;

      toast({
        title: "RSS salvo!",
        description: "O feed RSS foi salvo e será usado para futuras sincronizações.",
      });

      setShowRssDialog(false);

      // Now sync with the RSS
      await syncWithRss(rssUrl.trim());
    } catch (error) {
      console.error("Error saving RSS:", error);
      toast({
        title: "Erro ao salvar RSS",
        description: "Verifique se a URL está correta e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  if (contentLibraryId || justSynced) {
    return (
      <Badge
        variant="outline"
        className="bg-green-500/10 text-green-600 border-green-500/30 gap-1 text-[10px] h-5"
      >
        <Library className="h-3 w-3" />
        Sincronizado
      </Badge>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSync}
        disabled={isSyncing}
        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        {isSyncing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <Rss className="h-3 w-3 mr-1" />
            Sincronizar
          </>
        )}
      </Button>

      <Dialog open={showRssDialog} onOpenChange={setShowRssDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rss className="h-5 w-5" />
              Configurar RSS da Newsletter
            </DialogTitle>
            <DialogDescription>
              Informe a URL do feed RSS da sua newsletter para sincronizar o
              conteúdo automaticamente. Será salvo para uso futuro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rss-url">URL do Feed RSS</Label>
              <Input
                id="rss-url"
                placeholder="https://newsletter.beehiiv.com/feed"
                value={rssUrl}
                onChange={(e) => setRssUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Geralmente encontrado em: /feed, /rss ou nas configurações da
                plataforma (Beehiiv, Substack, etc.)
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
              <p className="font-medium">Onde encontrar o RSS:</p>
              <p>• Beehiiv: https://sua-newsletter.beehiiv.com/feed</p>
              <p>• Substack: https://sua-newsletter.substack.com/feed</p>
              <p>• ConvertKit: Nas configurações do broadcast</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRssDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRssAndSync} disabled={isFetching}>
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Salvar e Sincronizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
