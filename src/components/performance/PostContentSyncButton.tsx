import { useState } from "react";
import { Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { transcribeImagesChunked } from "@/lib/transcribeImages";

interface PostContentSyncButtonProps {
  postId: string;
  clientId: string;
  permalink: string | null;
  caption: string | null;
  contentSyncedAt: string | null;
  onSyncComplete?: () => void;
}

export const PostContentSyncButton = ({
  postId,
  clientId,
  permalink,
  caption,
  contentSyncedAt,
  onSyncComplete,
}: PostContentSyncButtonProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!permalink) {
      toast.error("Link do post não disponível");
      return;
    }

    setIsSyncing(true);

    try {
      // 1. Extract images from Instagram
      const { data: extractData, error: extractError } = await supabase.functions.invoke(
        "extract-instagram",
        {
          body: {
            url: permalink,
            clientId,
            uploadToStorage: true,
          },
        }
      );

      if (extractError) throw extractError;

      const imageUrls = extractData?.images || [];
      const uploadedPaths = extractData?.uploadedPaths || [];

      // 2. Transcribe images if available
      let transcription = "";
      if (imageUrls.length > 0) {
        try {
          transcription = await transcribeImagesChunked(imageUrls, {
            clientId,
          });
        } catch (transcribeError) {
          console.warn("Error transcribing images:", transcribeError);
          // Continue without transcription
        }
      }

      // 3. Build full content
      const parts: string[] = [];
      if (caption) {
        parts.push(caption);
      }
      if (transcription) {
        parts.push("---\n\n## Transcrição das Imagens\n\n" + transcription);
      }
      const fullContent = parts.join("\n\n");

      // 4. Update instagram_posts directly
      const { error: updateError } = await supabase
        .from("instagram_posts")
        .update({
          full_content: fullContent || null,
          images: uploadedPaths,
          content_synced_at: new Date().toISOString(),
        })
        .eq("id", postId);

      if (updateError) throw updateError;

      // 5. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["instagram-posts", clientId] });
      
      toast.success("Conteúdo sincronizado!");
      onSyncComplete?.();
    } catch (error) {
      console.error("Error syncing content:", error);
      toast.error("Erro ao sincronizar conteúdo");
    } finally {
      setIsSyncing(false);
    }
  };

  if (contentSyncedAt) {
    return (
      <Badge 
        variant="outline" 
        className="bg-green-500/10 text-green-600 border-green-500/30 gap-1"
      >
        <Check className="h-3 w-3" />
        Sincronizado
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
          Sincronizando...
        </>
      ) : (
        <>
          <Plus className="h-3 w-3" />
          Carregar
        </>
      )}
    </Button>
  );
};
