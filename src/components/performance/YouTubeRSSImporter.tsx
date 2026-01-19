import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Rss, Loader2, Youtube, CheckCircle2, AlertCircle } from "lucide-react";

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
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extract channel ID from various YouTube URL formats
  const extractChannelId = (url: string): string | null => {
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

    // Handle URL: youtube.com/@handle (would need API call to resolve)
    if (trimmed.includes("/@")) {
      toast({
        title: "Formato não suportado",
        description: "Use a URL do canal no formato youtube.com/channel/UC... ou o ID do canal diretamente.",
        variant: "destructive",
      });
      return null;
    }

    return null;
  };

  const handleImport = async () => {
    const channelId = extractChannelId(channelUrl);
    
    if (!channelId) {
      toast({
        title: "URL inválida",
        description: "Insira uma URL de canal válida ou ID do canal (começa com UC).",
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
        body: { url: rssUrl }
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
        id: item.id?.replace("yt:video:", "") || item.link?.split("v=")[1] || "",
        title: item.title || "",
        published: item.published || item.pubDate || new Date().toISOString(),
        thumbnail: `https://i.ytimg.com/vi/${item.id?.replace("yt:video:", "") || ""}/hqdefault.jpg`,
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
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["youtube-videos", clientId] });
      queryClient.invalidateQueries({ queryKey: ["performance-metrics", clientId] });

      toast({
        title: "Vídeos importados!",
        description: `${insertedCount} vídeos do YouTube foram importados com sucesso.`,
      });

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
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
            <Youtube className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <CardTitle className="text-sm font-medium">Importar via RSS</CardTitle>
            <CardDescription className="text-xs">
              Importe vídeos automaticamente do canal
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="channel-url" className="text-xs">
            URL do Canal ou ID
          </Label>
          <Input
            id="channel-url"
            placeholder="youtube.com/channel/UC... ou UCxxxxxxx"
            value={channelUrl}
            onChange={(e) => setChannelUrl(e.target.value)}
            className="text-sm h-9"
          />
          <p className="text-[10px] text-muted-foreground">
            Cole a URL do canal do YouTube ou o ID do canal (começa com UC)
          </p>
        </div>

        <Button
          onClick={handleImport}
          disabled={isLoading || !channelUrl.trim()}
          className="w-full h-9 text-sm"
          size="sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Rss className="h-3.5 w-3.5 mr-2" />
              Importar Vídeos
            </>
          )}
        </Button>

        {importedCount !== null && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-emerald-600">
              {importedCount} vídeos importados
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
