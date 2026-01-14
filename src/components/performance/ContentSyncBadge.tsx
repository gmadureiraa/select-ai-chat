import { useState } from "react";
import { Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ContentSyncBadgeProps {
  postId: string;
  clientId: string;
  platform: "linkedin" | "twitter" | "youtube";
  content?: string | null;
  contentSyncedAt?: string | null;
  tableName: "linkedin_posts" | "twitter_posts" | "youtube_videos";
  onSyncComplete?: () => void;
}

export function ContentSyncBadge({
  postId,
  clientId,
  platform,
  content,
  contentSyncedAt,
  tableName,
  onSyncComplete,
}: ContentSyncBadgeProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!content) {
      toast.error("Conteúdo não disponível para sincronizar");
      return;
    }

    setIsSyncing(true);

    try {
      // Update the post with synced content
      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          full_content: content,
          content_synced_at: new Date().toISOString(),
        })
        .eq("id", postId);

      if (updateError) throw updateError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: [`${platform}-posts`, clientId] });
      queryClient.invalidateQueries({ queryKey: [`${platform}-videos`, clientId] });

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
        className="bg-green-500/10 text-green-600 border-green-500/30 gap-1 text-[10px] h-5"
      >
        <Check className="h-3 w-3" />
        Sync
      </Badge>
    );
  }

  if (!content) {
    return (
      <span className="text-xs text-muted-foreground">-</span>
    );
  }

  return (
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
          <Plus className="h-3 w-3 mr-1" />
          Sync
        </>
      )}
    </Button>
  );
}
