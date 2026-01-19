import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Rss, Loader2, Youtube, CheckCircle2 } from "lucide-react";

interface YouTubeRSSImporterProps {
  clientId: string;
  onImportComplete?: () => void;
}

interface RSSVideo {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
  description?: string;
}

export function YouTubeRSSImporter({ clientId, onImportComplete }: YouTubeRSSImporterProps) {
  const [channelUrl, setChannelUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResolvingHandle, setIsResolvingHandle] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load saved channel ID on mount
  useEffect(() => {
    const loadSavedChannel = async () => {
      const { data } = await supabase
        .from("clients")
        .select("social_media")
        .eq("id", clientId)
        .single();
      
      if (data?.social_media) {
        const socialMedia = data.social_media as Record<string, any>;
        if (socialMedia.youtube_channel_id) {
          setChannelUrl(socialMedia.youtube_channel_id);
        }
      }
    };
    loadSavedChannel();
  }, [clientId]);

  // Resolve @handle to channel ID via edge function
  const resolveYouTubeHandle = async (handle: string): Promise<string | null> => {
    try {
      setIsResolvingHandle(true);
      const { data, error } = await supabase.functions.invoke("resolve-youtube-channel", {
        body: { handle }
      });
      
      if (error) throw error;
      return data?.channelId || null;
    } catch (e) {
      console.error("Failed to resolve handle:", e);
      return null;
    } finally {
      setIsResolvingHandle(false);
    }
  };

  // Extract channel ID from various YouTube URL formats
  const extractChannelId = async (url: string): Promise<string | null> => {
    const trimmed = url.trim();
    
    // Already a channel ID (UCxxxxxxx format)
    if (/^UC[\w-]{22}$/.test(trimmed)) {
      return trimmed;
    }

    // RSS feed URL: youtube.com/feeds/videos.xml?channel_id=UCxxxxxxx
    const rssMatch = trimmed.match(/channel_id=(UC[\w-]{22})/);
    if (rssMatch) return rssMatch[1];

    // Channel URL: youtube.com/channel/UCxxxxxxx
    const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
    if (channelMatch) return channelMatch[1];

    // Handle URL: youtube.com/@handle
    const handleUrlMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/i);
    if (handleUrlMatch) {
      const handle = handleUrlMatch[1];
      toast({
        title: "Resolvendo canal...",
        description: `Buscando ID do canal @${handle}`,
      });
      return await resolveYouTubeHandle(handle);
    }
    
    // Handle direto sem URL (começa com @)
    if (trimmed.startsWith("@")) {
      const handle = trimmed.slice(1);
      toast({
        title: "Resolvendo canal...",
        description: `Buscando ID do canal @${handle}`,
      });
      return await resolveYouTubeHandle(handle);
    }

    return null;
  };

  const handleImport = async () => {
    const channelId = await extractChannelId(channelUrl);
    
    if (!channelId) {
      toast({
        title: "URL inválida",
        description: "Insira uma URL de canal válida, @handle ou ID do canal (começa com UC).",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setImportedCount(null);

    try {
      // Fetch RSS feed
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      
      const { data, error } = await supabase.functions.invoke("fetch-rss-feed", {
        body: { rssUrl }
      });

      if (error) throw error;

      if (!data?.items || data.items.length === 0) {
        toast({
          title: "Nenhum vídeo encontrado",
          description: "O canal não possui vídeos públicos ou o ID está incorreto.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Parse RSS items into video format
      const videos: RSSVideo[] = data.items.map((item: any) => ({
        id: item.guid?.replace("yt:video:", "") || item.link?.split("v=")[1] || "",
        title: item.title || "",
        published: item.pubDate || new Date().toISOString(),
        thumbnail: `https://i.ytimg.com/vi/${item.guid?.replace("yt:video:", "") || ""}/hqdefault.jpg`,
        description: item.description || item.content || "",
      })).filter((v: RSSVideo) => v.id && v.title);

      // Insert videos into youtube_videos table
      let insertedCount = 0;
      for (const video of videos) {
        const { error: upsertError } = await supabase
          .from("youtube_videos")
          .upsert({
            client_id: clientId,
            video_id: video.id,
            title: video.title,
            thumbnail_url: video.thumbnail,
            published_at: video.published,
            metadata: {
              description: video.description,
              source: "rss_import"
            }
          }, {
            onConflict: "client_id,video_id"
          });

        if (!upsertError) insertedCount++;
      }

      setImportedCount(insertedCount);
      
      // Save channel ID to client
      const { data: clientData } = await supabase
        .from("clients")
        .select("social_media")
        .eq("id", clientId)
        .single();

      const currentSocialMedia = (clientData?.social_media as Record<string, any>) || {};
      await supabase
        .from("clients")
        .update({
          social_media: {
            ...currentSocialMedia,
            youtube_channel_id: channelId,
          }
        })
        .eq("id", clientId);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["youtube-videos", clientId] });
      queryClient.invalidateQueries({ queryKey: ["performance-metrics", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });

      toast({
        title: "Vídeos importados!",
        description: `${insertedCount} vídeos do YouTube foram importados com sucesso.`,
      });

      // Now sync to library with transcription
      toast({
        title: "Sincronizando para biblioteca...",
        description: "Transcrições serão geradas automaticamente.",
      });

      try {
        const { data: syncResult, error: syncError } = await supabase.functions.invoke("sync-rss-to-library", {
          body: {
            clientId,
            platform: "youtube",
            channelId,
            mode: "only_missing",
            limit: 20,
          }
        });

        if (syncError) {
          console.error("Sync error:", syncError);
          toast({
            title: "Aviso",
            description: "Vídeos importados, mas houve erro ao transcrever. Tente sincronizar manualmente.",
            variant: "destructive",
          });
        } else if (syncResult?.created > 0 || syncResult?.transcribed > 0) {
          queryClient.invalidateQueries({ queryKey: ["unified-content", clientId] });
          queryClient.invalidateQueries({ queryKey: ["content-library", clientId] });
          queryClient.invalidateQueries({ queryKey: ["client-content-library", clientId] });
          toast({
            title: "Biblioteca atualizada!",
            description: `${syncResult.transcribed} vídeos transcritos e adicionados à biblioteca.`,
          });
        }
      } catch (libErr) {
        console.warn("Library sync failed:", libErr);
      }

      onImportComplete?.();
    } catch (error) {
      console.error("RSS import error:", error);
      toast({
        title: "Erro na importação",
        description: "Não foi possível importar os vídeos. Verifique a URL do canal.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2">
        <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
          <Youtube className="h-4 w-4 text-red-500" />
        </div>
        <div>
          <p className="text-sm font-medium">Importar via RSS</p>
          <p className="text-xs text-muted-foreground">
            Importe vídeos automaticamente do canal
          </p>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="channel-url" className="text-xs">
          URL do Canal, @handle ou ID
        </Label>
        <Input
          id="channel-url"
          placeholder="youtube.com/@canal, @canal ou UCxxxxxxx"
          value={channelUrl}
          onChange={(e) => setChannelUrl(e.target.value)}
          className="text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          Aceita: youtube.com/@canal, @canal, youtube.com/channel/UC... ou ID direto
        </p>
      </div>

      <Button
        onClick={handleImport}
        disabled={isLoading || isResolvingHandle || !channelUrl.trim()}
        className="w-full"
      >
        {isResolvingHandle ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Resolvendo canal...
          </>
        ) : isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Importando...
          </>
        ) : (
          <>
            <Rss className="h-4 w-4 mr-2" />
            Importar Vídeos
          </>
        )}
      </Button>

      {importedCount !== null && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-sm text-emerald-600">
            {importedCount} vídeos importados com sucesso!
          </span>
        </div>
      )}
    </div>
  );
}
