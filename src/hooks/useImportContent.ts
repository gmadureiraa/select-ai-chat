import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ContentType } from "./useContentLibrary";

interface Newsletter {
  title: string;
  date: string;
  content: string;
  url?: string;
}

const parseNewslettersFromMarkdown = (markdown: string, clientName: string): Newsletter[] => {
  const newsletters: Newsletter[] = [];
  
  // Split by "##" headers (each newsletter section)
  const sections = markdown.split(/^## /m).filter(Boolean);
  
  sections.forEach((section) => {
    // Skip intro sections and pattern analysis
    if (section.includes("Padrões Identificados") || 
        section.includes("Este arquivo contém") ||
        section.includes("Tom e Estilo")) {
      return;
    }

    const lines = section.split('\n');
    const firstLine = lines[0];
    
    // Extract title (first line before any **Data:** marker)
    const titleMatch = firstLine.match(/^(.+?)(?:\s*\*\*Data)/);
    const title = titleMatch ? titleMatch[1].trim() : firstLine.trim();
    
    // Extract date
    const dateMatch = section.match(/\*\*Data:\*\*\s*(.+?)(?:\n|$)/);
    const date = dateMatch ? dateMatch[1].trim() : "";
    
    // Extract full content (everything after the header)
    const content = lines.slice(1).join('\n').trim();
    
    // Extract URL if present
    const urlMatch = section.match(/\[Ver online\]\((https?:\/\/[^\)]+)\)/);
    const url = urlMatch ? urlMatch[1] : undefined;
    
    if (title && content) {
      newsletters.push({ title, date, content, url });
    }
  });
  
  return newsletters;
};

export const useImportContent = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importFromMarkdown = useMutation({
    mutationFn: async (clientSlug: string) => {
      // Determine file path based on client
      let filePath = "";
      let contentType: ContentType = "newsletter";
      
      if (clientSlug === "layla-foz") {
        filePath = "/clients/layla-foz/newsletters-completas.md";
      } else if (clientSlug === "defiverso") {
        filePath = "/clients/defiverso/resumos-semanais.md";
      } else {
        throw new Error("Cliente não suportado para importação automática");
      }

      // Fetch markdown file
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error("Não foi possível ler o arquivo de newsletters");
      }
      
      const markdown = await response.text();
      
      // Parse newsletters
      const newsletters = parseNewslettersFromMarkdown(markdown, clientSlug);
      
      if (newsletters.length === 0) {
        throw new Error("Nenhuma newsletter encontrada no arquivo");
      }

      // Insert all newsletters
      const insertPromises = newsletters.map(async (newsletter) => {
        const { data, error } = await supabase
          .from("client_content_library")
          .insert({
            client_id: clientId,
            title: newsletter.title,
            content_type: contentType,
            content: newsletter.content,
            content_url: newsletter.url,
            metadata: { date: newsletter.date },
          })
          .select()
          .single();

        if (error) throw error;

        // Log activity
        await supabase.rpc("log_user_activity", {
          p_activity_type: "content_library_added",
          p_entity_type: "content_library",
          p_entity_id: data.id,
          p_entity_name: newsletter.title,
          p_description: `Importou newsletter "${newsletter.title}" para a biblioteca`,
          p_metadata: { source: "markdown_import", date: newsletter.date },
        });

        return data;
      });

      const results = await Promise.all(insertPromises);
      return { count: results.length, newsletters };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-content-library", clientId] });
      toast({
        title: "Newsletters importadas!",
        description: `${data.count} newsletters foram adicionadas à biblioteca com sucesso.`,
      });
    },
    onError: (error: Error) => {
      console.error("Error importing content:", error);
      toast({
        title: "Erro ao importar",
        description: error.message || "Não foi possível importar as newsletters.",
        variant: "destructive",
      });
    },
  });

  return { importFromMarkdown };
};
