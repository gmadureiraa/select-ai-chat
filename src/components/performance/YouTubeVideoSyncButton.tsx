import { useState } from "react";
import { Check, Loader2, FileText, Youtube } from "lucide-react";
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
  contentSyncedAt: string | null;
  onSyncComplete?: () => void;
}

export const YouTubeVideoSyncButton = ({
  videoId,
  videoDbId,
  clientId,
  title,
  contentSyncedAt,
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

      setSyncStatus("Salvando...");
      
      // Update youtube_videos with transcript
      const { error: updateError } = await supabase
        .from("youtube_videos")
        .update({
          transcript: transcript || null,
          content_synced_at: new Date().toISOString(),
        })
        .eq("id", videoDbId);

      if (updateError) throw updateError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["youtube-videos", clientId] });
      
      const successMessage = hasTranscript 
        ? "Vídeo transcrito com sucesso!" 
        : "Vídeo sincronizado (sem transcrição disponível)";
      
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

  if (contentSyncedAt) {
    return (
      <Badge 
        variant="outline" 
        className="bg-green-500/10 text-green-600 border-green-500/30 gap-1"
      >
        <FileText className="h-3 w-3" />
        <Check className="h-3 w-3" />
        Transcrito
      </Badge>
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
          Transcrever
        </>
      )}
    </Button>
  );
};
