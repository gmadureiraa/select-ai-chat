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
  
  // Try DD/MM/YYYY HH:mm format (BR format)
  const matchBR = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (matchBR) {
    const [, day, month, year, hour, minute] = matchBR;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
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

interface StoryRecord {
  client_id: string;
  story_id: string | null;
  media_type: string;
  views: number;
  reach: number;
  likes: number;
  shares: number;
  replies: number;
  forward_taps: number;
  interactions: number;
  posted_at: string | null;
  metadata: {
    caption: string | null;
    permalink: string | null;
    duration: number;
    profile_visits: number;
    sticker_taps: number;
    link_clicks: number;
  };
}

export function useImportInstagramStoriesCSV(clientId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rows: StoriesCSVRow[]) => {
      // Build raw stories array
      const storiesRaw: StoryRecord[] = rows.map((row) => {
        const duration = parseNumber(row["Duração (s)"] || row["Duration (s)"]);
        const storyIdRaw = row["Identificação do post"] || row["Post ID"] || null;
        
        const likes = parseNumber(row["Curtidas"] || row["Likes"]);
        const shares = parseNumber(row["Compartilhamentos"] || row["Shares"]);
        const replies = parseNumber(row["Respostas"] || row["Replies"]);
        
        // Calculate interactions = likes + shares + replies
        const interactions = likes + shares + replies;
        
        return {
          client_id: clientId,
          story_id: storyIdRaw ? String(storyIdRaw).trim() : null,
          media_type: duration > 0 ? "video" : "image",
          views: parseNumber(row["Visualizações"] || row["Views"]),
          reach: parseNumber(row["Alcance"] || row["Reach"]),
          likes,
          shares,
          replies,
          forward_taps: parseNumber(row["Navegação"] || row["Navigation"]),
          interactions,
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

      // Filter out invalid records (no story_id)
      const validStories = storiesRaw.filter(s => s.story_id && s.story_id.length > 0);
      
      // Deduplicate by story_id to avoid "cannot affect row a second time" error
      // Keep the record with more data (higher views or more complete metadata)
      const storyMap = new Map<string, StoryRecord>();
      
      for (const story of validStories) {
        const key = story.story_id!;
        const existing = storyMap.get(key);
        
        if (!existing) {
          storyMap.set(key, story);
        } else {
          // Keep the one with more complete data
          const existingScore = (existing.views || 0) + (existing.reach || 0) + (existing.posted_at ? 100 : 0);
          const newScore = (story.views || 0) + (story.reach || 0) + (story.posted_at ? 100 : 0);
          
          if (newScore > existingScore) {
            storyMap.set(key, story);
          }
        }
      }
      
      const stories = Array.from(storyMap.values());
      
      if (stories.length === 0) {
        throw new Error("Nenhum story válido encontrado no arquivo CSV.");
      }

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
      
      // Better error message for duplicate key errors
      let message = error.message || "Falha ao importar stories.";
      if (error.code === "21000" || message.includes("cannot affect row a second time")) {
        message = "Erro: foram encontrados IDs duplicados no arquivo CSV. Verifique se o arquivo não contém stories repetidos.";
      }
      
      toast({
        title: "Erro ao importar",
        description: message,
        variant: "destructive",
      });
    },
  });
}
