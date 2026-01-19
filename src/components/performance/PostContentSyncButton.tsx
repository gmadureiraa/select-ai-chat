import { useState } from "react";
import { Plus, Check, Loader2, Video, FileText } from "lucide-react";
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
  postType?: string | null;
  onSyncComplete?: () => void;
}

export const PostContentSyncButton = ({
  postId,
  clientId,
  permalink,
  caption,
  contentSyncedAt,
  postType,
  onSyncComplete,
}: PostContentSyncButtonProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const queryClient = useQueryClient();

  // Detect if this is a video/reel post
  const isVideoPost = () => {
    if (!permalink) return false;
    const isReelUrl = permalink.includes("/reel/");
    const isVideoType = postType?.toLowerCase() === "video" || 
                        postType?.toLowerCase() === "reel" ||
                        postType?.toLowerCase() === "reels";
    return isReelUrl || isVideoType;
  };

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!permalink) {
      toast.error("Link do post não disponível");
      return;
    }

    setIsSyncing(true);
    const isVideo = isVideoPost();

    try {
      let fullContent = "";
      let videoTranscript: string | null = null;
      let videoUrl: string | null = null;
      let thumbnailUrl: string | null = null;
      let uploadedPaths: string[] = [];

      // 1. Extract content from Instagram
      setSyncStatus(isVideo ? "Baixando vídeo..." : "Extraindo imagens...");
      
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
      uploadedPaths = extractData?.uploadedPaths || [];
      const extractedCaption = extractData?.caption || caption;

      // Build thumbnail URL from first uploaded image
      if (uploadedPaths.length > 0) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        thumbnailUrl = `${supabaseUrl}/storage/v1/object/public/client-files/${uploadedPaths[0]}`;
      }

      // 2. Process based on content type
      if (isVideo) {
        // For Reels/Videos: transcribe the video audio
        setSyncStatus("Transcrevendo áudio do vídeo...");
        
        // Use the first image URL as video URL (Instagram returns video URL in same field)
        if (imageUrls.length > 0) {
          videoUrl = imageUrls[0];
          
          try {
            const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke(
              "transcribe-media",
              {
                body: {
                  url: videoUrl,
                  fileName: `reels-${postId}.mp4`,
                },
              }
            );

            if (!transcribeError && transcribeData?.text) {
              videoTranscript = transcribeData.text;
              console.log("Video transcription successful, duration:", transcribeData.duration);
            } else {
              console.warn("Video transcription failed:", transcribeError);
              // Continue without transcription
            }
          } catch (transcribeErr) {
            console.warn("Error transcribing video:", transcribeErr);
            // Continue without transcription
          }
        }

        // Build full content for videos
        const parts: string[] = [];
        if (extractedCaption) {
          parts.push(`## Legenda\n\n${extractedCaption}`);
        }
        if (videoTranscript) {
          parts.push(`## Roteiro/Transcrição do Vídeo\n\n${videoTranscript}`);
        }
        fullContent = parts.join("\n\n---\n\n");

      } else {
        // For Images/Carousels: transcribe image text (OCR)
        setSyncStatus("Transcrevendo imagens...");
        
        let imageTranscription = "";
        if (imageUrls.length > 0) {
          try {
            imageTranscription = await transcribeImagesChunked(imageUrls, {
              clientId,
            });
          } catch (transcribeError) {
            console.warn("Error transcribing images:", transcribeError);
          }
        }

        // Build full content for images
        const parts: string[] = [];
        if (extractedCaption) {
          parts.push(extractedCaption);
        }
        if (imageTranscription) {
          parts.push("---\n\n## Transcrição das Imagens\n\n" + imageTranscription);
        }
        fullContent = parts.join("\n\n");
      }

      // 3. Update instagram_posts
      setSyncStatus("Salvando...");
      
      const updateData: Record<string, unknown> = {
        full_content: fullContent || null,
        images: uploadedPaths,
        thumbnail_url: thumbnailUrl,
        content_synced_at: new Date().toISOString(),
      };

      // Add video-specific fields if available
      if (isVideo) {
        updateData.video_transcript = videoTranscript;
        updateData.video_url = videoUrl;
      }

      const { error: updateError } = await supabase
        .from("instagram_posts")
        .update(updateData)
        .eq("id", postId);

      if (updateError) throw updateError;

      // 4. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["instagram-posts", clientId] });
      
      const successMessage = isVideo 
        ? videoTranscript 
          ? "Vídeo transcrito e sincronizado!" 
          : "Vídeo sincronizado (sem transcrição disponível)"
        : "Conteúdo sincronizado!";
      
      toast.success(successMessage);
      onSyncComplete?.();
    } catch (error) {
      console.error("Error syncing content:", error);
      toast.error("Erro ao sincronizar conteúdo");
    } finally {
      setIsSyncing(false);
      setSyncStatus("");
    }
  };

  if (contentSyncedAt) {
    const isVideo = isVideoPost();
    return (
      <Badge 
        variant="outline" 
        className="bg-green-500/10 text-green-600 border-green-500/30 gap-1"
      >
        {isVideo ? <Video className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
        <Check className="h-3 w-3" />
        Sincronizado
      </Badge>
    );
  }

  const isVideo = isVideoPost();

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
          {isVideo ? <Video className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {isVideo ? "Transcrever" : "Carregar"}
        </>
      )}
    </Button>
  );
};
