import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StoriesCSVRow {
  "Identificação do post"?: string;
  "Descrição"?: string;
  "Duração (s)"?: string;
  "Horário de publicação"?: string;
  "Link permanente"?: string;
  "Visualizações"?: string;
  "Alcance"?: string;
  "Curtidas"?: string;
  "Compartilhamentos"?: string;
  "Respostas"?: string;
  "Navegação"?: string;
  "Visitas ao perfil"?: string;
  "Toques em figurinhas"?: string;
  "Cliques no link"?: string;
  // English alternatives
  "Post ID"?: string;
  "Description"?: string;
  "Duration (s)"?: string;
  "Published at"?: string;
  "Permalink"?: string;
  "Views"?: string;
  "Reach"?: string;
  "Likes"?: string;
  "Shares"?: string;
  "Replies"?: string;
  "Navigation"?: string;
}

const parseNumber = (value: string | undefined): number => {
  if (!value) return 0;
  const cleaned = value.replace(/[^\d.-]/g, '');
  return parseInt(cleaned, 10) || 0;
};

const parseDate = (value: string | undefined): string | null => {
  if (!value) return null;
  
  // Try MM/DD/YYYY HH:mm format (Reportei)
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (match) {
    const [, month, day, year, hour, minute] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    ).toISOString();
  }
  
  // Try ISO format
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch {
    // ignore
  }
  
  return null;
};

export function useImportInstagramStoriesCSV(clientId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rows: StoriesCSVRow[]) => {
      const stories = rows.map((row) => {
        const duration = parseNumber(row["Duração (s)"] || row["Duration (s)"]);
        
        return {
          client_id: clientId,
          story_id: row["Identificação do post"] || row["Post ID"] || null,
          media_type: duration > 0 ? "video" : "image",
          views: parseNumber(row["Visualizações"] || row["Views"]),
          reach: parseNumber(row["Alcance"] || row["Reach"]),
          likes: parseNumber(row["Curtidas"] || row["Likes"]),
          shares: parseNumber(row["Compartilhamentos"] || row["Shares"]),
          replies: parseNumber(row["Respostas"] || row["Replies"]),
          forward_taps: parseNumber(row["Navegação"] || row["Navigation"]),
          posted_at: parseDate(row["Horário de publicação"] || row["Published at"]),
          metadata: {
            caption: row["Descrição"] || row["Description"] || null,
            permalink: row["Link permanente"] || row["Permalink"] || null,
            duration: duration,
            profile_visits: parseNumber(row["Visitas ao perfil"]),
            sticker_taps: parseNumber(row["Toques em figurinhas"]),
            link_clicks: parseNumber(row["Cliques no link"]),
          },
        };
      });

      const { error } = await supabase
        .from("instagram_stories")
        .upsert(stories, {
          onConflict: "story_id,client_id",
          ignoreDuplicates: false,
        });

      if (error) throw error;

      // Log import history
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("import_history").insert({
          client_id: clientId,
          platform: "instagram_stories",
          records_count: stories.length,
          file_name: "stories_import.csv",
          user_id: user.id,
        });
      }

      return stories.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["instagram-stories", clientId] });
      queryClient.invalidateQueries({ queryKey: ["import-history", clientId] });
      toast({
        title: "Stories importados",
        description: `${count} stories foram importados com sucesso.`,
      });
    },
    onError: (error: any) => {
      console.error("Error importing stories:", error);
      toast({
        title: "Erro ao importar",
        description: error.message || "Falha ao importar stories.",
        variant: "destructive",
      });
    },
  });
}
