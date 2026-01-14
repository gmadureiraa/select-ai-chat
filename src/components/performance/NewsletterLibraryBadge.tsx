import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Library, Loader2, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NewsletterLibraryBadgeProps {
  postId: string;
  clientId: string;
  contentLibraryId?: string | null;
  subject?: string;
  content?: string;
  metricDate?: string;
  metadata?: Record<string, unknown>;
}

export function NewsletterLibraryBadge({
  postId,
  clientId,
  contentLibraryId,
  subject,
  content,
  metricDate,
  metadata
}: NewsletterLibraryBadgeProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSync = async () => {
    if (isSyncing || contentLibraryId || justSynced) return;

    setIsSyncing(true);
    try {
      // Create entry in content library
      const { data: libraryEntry, error: insertError } = await supabase
        .from("client_content_library")
        .insert({
          client_id: clientId,
          title: subject || `Newsletter de ${metricDate}`,
          content: content || `Edição da newsletter do dia ${metricDate}`,
          content_type: "newsletter",
          metadata: {
            ...metadata,
            synced_from_metrics: true,
            metric_date: metricDate,
            platform_metric_id: postId,
          }
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
        description: "Conteúdo adicionado à biblioteca.",
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

  if (contentLibraryId || justSynced) {
    return (
      <Badge 
        variant="outline" 
        className="bg-green-500/10 text-green-600 border-green-500/30 gap-1 text-[10px] h-5"
      >
        <Library className="h-3 w-3" />
        Biblioteca
      </Badge>
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
          Biblioteca
        </>
      )}
    </Button>
  );
}
