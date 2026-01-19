import { useState } from "react";
import { Check, Loader2, FileText, Youtube, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface YouTubeVideoSyncButtonProps {
  videoId: string;
  videoDbId: string;
  clientId: string;
  title: string;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  contentSyncedAt: string | null;
  contentLibraryId?: string | null;
  onSyncComplete?: () => void;
}

export const YouTubeVideoSyncButton = ({
  videoId,
  videoDbId,
  clientId,
  title,
  thumbnailUrl,
  publishedAt,
  contentSyncedAt,
  contentLibraryId,
  onSyncComplete,
}: YouTubeVideoSyncButtonProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const queryClient = useQueryClient();

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!videoId) {
      toast.error("ID do vídeo não disponível");
      return;
    }

    setIsSyncing(true);

    try {
      setSyncStatus("Extraindo transcrição...");
      
      // Call extract-youtube to get the transcript
      const { data: extractData, error: extractError } = await supabase.functions.invoke(
        "extract-youtube",
        {
          body: {
            url: `https://youtube.com/watch?v=${videoId}`,
          },
        }
      );

      if (extractError) throw extractError;

      const transcript = extractData?.content || extractData?.transcript || "";
      const hasTranscript = transcript.length > 0;

      if (!hasTranscript) {
        toast.warning("Transcrição não disponível para este vídeo");
      }

      setSyncStatus("Salvando na biblioteca...");
      
      // Create entry in content library with thumbnail and transcript
      const { data: libraryEntry, error: insertError } = await supabase
        .from("client_content_library")
        .insert({
          client_id: clientId,
          title: title || `Vídeo YouTube`,
          content: transcript || `Vídeo: ${title}`,
          content_type: "video_script",
          content_url: `https://youtube.com/watch?v=${videoId}`,
          thumbnail_url: thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          metadata: {
            synced_from_performance: true,
            video_id: videoId,
            published_at: publishedAt,
            has_transcript: hasTranscript,
          },
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Update youtube_videos with transcript and library link
      const { error: updateError } = await supabase
        .from("youtube_videos")
        .update({
          transcript: transcript || null,
          content_synced_at: new Date().toISOString(),
          content_library_id: libraryEntry.id,
        })
        .eq("id", videoDbId);

      if (updateError) throw updateError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["youtube-videos", clientId] });
      queryClient.invalidateQueries({ queryKey: ["unified-content", clientId] });
      queryClient.invalidateQueries({ queryKey: ["content-library", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-content-library", clientId] });
      
      const successMessage = hasTranscript 
        ? "Vídeo transcrito e adicionado à biblioteca!" 
        : "Vídeo adicionado à biblioteca (sem transcrição)";
      
      toast.success(successMessage);
      onSyncComplete?.();
    } catch (error) {
      console.error("Error syncing YouTube video:", error);
      toast.error("Erro ao transcrever vídeo");
    } finally {
      setIsSyncing(false);
      setSyncStatus("");
    }
  };

  // Only show "Na Biblioteca" if contentLibraryId is set (actual library entry exists)
  if (contentLibraryId) {
    return (
      <Badge 
        variant="outline" 
        className="bg-green-500/10 text-green-600 border-green-500/30 gap-1"
      >
        <Library className="h-3 w-3" />
        <Check className="h-3 w-3" />
        Na Biblioteca
      </Badge>
    );
  }

  // If contentSyncedAt exists but no library ID, show "Ressincronizar" button
  if (contentSyncedAt && !contentLibraryId) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSync}
        disabled={isSyncing}
        className="h-7 px-2 text-xs gap-1 text-orange-600 hover:text-orange-700"
      >
        {isSyncing ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            {syncStatus || "Sincronizando..."}
          </>
        ) : (
          <>
            <Library className="h-3 w-3" />
            Ressincronizar
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSync}
      disabled={isSyncing}
      className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-primary"
    >
      {isSyncing ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          {syncStatus || "Sincronizando..."}
        </>
      ) : (
        <>
          <Youtube className="h-3 w-3" />
          Transcrever + Biblioteca
        </>
      )}
    </Button>
  );
};
