import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BookOpen, Plus, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface LibraryStatusBadgeProps {
  postId: string;
  clientId: string;
  contentLibraryId: string | null | undefined;
  caption: string | null | undefined;
  postType: string | null | undefined;
  permalink: string | null | undefined;
  thumbnailUrl: string | null | undefined;
  postedAt: string | null | undefined;
}

export function LibraryStatusBadge({
  postId,
  clientId,
  contentLibraryId,
  caption,
  postType,
  permalink,
  thumbnailUrl,
  postedAt,
}: LibraryStatusBadgeProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isLinked = !!contentLibraryId;

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      // Map post type to valid content_type enum
      const contentTypeMap: Record<string, "instagram_post" | "carousel" | "reel_script" | "stories"> = {
        reel: "reel_script",
        carousel: "carousel",
        story: "stories",
        image: "instagram_post",
      };
      const contentType = contentTypeMap[postType || ""] || "instagram_post";

      // Create library entry
      const { data: libraryEntry, error: insertError } = await supabase
        .from("client_content_library")
        .insert({
          client_id: clientId,
          title: caption?.slice(0, 100) || `Post ${postType || 'Instagram'}`,
          content: caption || "",
          content_type: contentType,
          content_url: permalink,
          thumbnail_url: thumbnailUrl,
          metadata: {
            synced_from_performance: true,
            post_id: postId,
            posted_at: postedAt,
            post_type: postType,
          },
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Link to instagram post
      const { error: updateError } = await supabase
        .from("instagram_posts")
        .update({ content_library_id: libraryEntry.id })
        .eq("id", postId);

      if (updateError) throw updateError;

      setJustSynced(true);
      queryClient.invalidateQueries({ queryKey: ["instagram-posts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["content-library", clientId] });

      toast({
        title: "Sincronizado!",
        description: "Post adicionado à biblioteca de conteúdo",
      });

      setTimeout(() => setJustSynced(false), 3000);
    } catch (error) {
      console.error("[LibraryStatusBadge] Error:", error);
      toast({
        title: "Erro ao sincronizar",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLinked || justSynced) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary" 
            className="gap-1 cursor-default bg-green-500/10 text-green-600 hover:bg-green-500/20"
          >
            {justSynced ? (
              <Check className="h-3 w-3" />
            ) : (
              <BookOpen className="h-3 w-3" />
            )}
            <span className="text-[10px]">Biblioteca</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Conteúdo completo na biblioteca</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-muted-foreground hover:text-foreground"
          onClick={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          <span className="text-[10px] ml-1">Adicionar</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Adicionar à biblioteca de conteúdo</p>
      </TooltipContent>
    </Tooltip>
  );
}
