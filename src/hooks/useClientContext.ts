import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ContextSources {
  hasDescription: boolean;
  hasTags: boolean;
  websitesCount: number;
  documentsCount: number;
  contentCount: number;
  referencesCount: number;
  instagramCount: number;
  youtubeCount: number;
}

export const useClientContext = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [sources, setSources] = useState<ContextSources | null>(null);
  const { toast } = useToast();

  const generateContext = async (clientId: string): Promise<string | null> => {
    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-client-context", {
        body: { clientId },
      });

      if (error) throw error;

      if (data?.success) {
        setSources(data.sources);
        toast({
          title: "Contexto gerado com sucesso!",
          description: `Analisados: ${data.sources.websitesCount} sites, ${data.sources.documentsCount} docs, ${data.sources.contentCount} conteúdos`,
        });
        return data.context;
      } else {
        throw new Error(data?.error || "Erro desconhecido");
      }
    } catch (error) {
      console.error("Error generating context:", error);
      toast({
        title: "Erro ao gerar contexto",
        description: error instanceof Error ? error.message : "Não foi possível gerar o contexto.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchSourceCounts = async (clientId: string): Promise<ContextSources | null> => {
    try {
      const [
        clientResult,
        websitesResult,
        documentsResult,
        contentResult,
        referencesResult,
        instagramResult,
        youtubeResult,
      ] = await Promise.all([
        supabase.from("clients").select("description, tags").eq("id", clientId).single(),
        supabase.from("client_websites").select("id").eq("client_id", clientId).not("scraped_markdown", "is", null),
        supabase.from("client_documents").select("id").eq("client_id", clientId).not("extracted_content", "is", null),
        supabase.from("client_content_library").select("id").eq("client_id", clientId),
        supabase.from("client_reference_library").select("id").eq("client_id", clientId),
        supabase.from("instagram_posts").select("id").eq("client_id", clientId),
        supabase.from("youtube_videos").select("id").eq("client_id", clientId).not("transcript", "is", null),
      ]);

      const client = clientResult.data;
      const tags = (client?.tags as Record<string, string>) || {};

      const newSources: ContextSources = {
        hasDescription: !!client?.description,
        hasTags: Object.values(tags).some((v) => v),
        websitesCount: websitesResult.data?.length || 0,
        documentsCount: documentsResult.data?.length || 0,
        contentCount: contentResult.data?.length || 0,
        referencesCount: referencesResult.data?.length || 0,
        instagramCount: instagramResult.data?.length || 0,
        youtubeCount: youtubeResult.data?.length || 0,
      };

      setSources(newSources);
      return newSources;
    } catch (error) {
      console.error("Error fetching source counts:", error);
      return null;
    }
  };

  return {
    generateContext,
    fetchSourceCounts,
    isGenerating,
    sources,
  };
};
