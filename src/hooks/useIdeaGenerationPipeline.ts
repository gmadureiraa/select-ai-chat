import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export interface GeneratedIdea {
  id: string;
  title: string;
  description: string;
  format: string;
  inspiration?: string;
  isSelected?: boolean;
}

export interface IdeaPipelineState {
  step: 
    | "idle" 
    | "analyzing_client" 
    | "reading_competitors" 
    | "selecting_references"
    | "generating_ideas" 
    | "validating_ideas"
    | "ideas_ready"
    | "generating_content"
    | "style_editing"
    | "consistency_check"
    | "final_review"
    | "content_ready"
    | "error";
  currentAgent: string | null;
  ideas: GeneratedIdea[];
  selectedIdea: GeneratedIdea | null;
  generatedContent: string | null;
  generatedImageUrl: string | null;
  error: string | null;
}

export interface IdeaPipelineOptions {
  clientId: string;
  clientName: string;
  contentFormat: string;
  identityGuide?: string;
  contentLibrary: any[];
  referenceLibrary: any[];
  globalKnowledge?: any[];
}

export const useIdeaGenerationPipeline = () => {
  const [state, setState] = useState<IdeaPipelineState>({
    step: "idle",
    currentAgent: null,
    ideas: [],
    selectedIdea: null,
    generatedContent: null,
    generatedImageUrl: null,
    error: null,
  });
  const { toast } = useToast();
  const { user } = useAuth();

  const updateState = (updates: Partial<IdeaPipelineState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // =========================================
  // FASE 1: GERAR IDEIAS (3 ou 5)
  // =========================================
  const generateIdeas = useCallback(async (
    options: IdeaPipelineOptions,
    userRequest: string,
    ideaCount: number = 3
  ) => {
    const { clientId, clientName, contentFormat, identityGuide, contentLibrary, referenceLibrary } = options;

    try {
      updateState({ step: "analyzing_client", currentAgent: "Analisador de Cliente", error: null });

      // Chamar edge function especializada em gerar ideias
      const { data, error } = await supabase.functions.invoke("generate-ideas-pipeline", {
        body: {
          clientId,
          clientName,
          contentFormat,
          identityGuide,
          contentLibrary: contentLibrary.slice(0, 30),
          referenceLibrary: referenceLibrary.slice(0, 20),
          userRequest,
          ideaCount,
          userId: user?.id,
        },
      });

      if (error) throw error;

      // Processar SSE stream
      const reader = data.body?.getReader();
      if (!reader) throw new Error("Sem resposta do servidor");

      const decoder = new TextDecoder();
      let buffer = "";
      let ideas: GeneratedIdea[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            
            if (parsed.step) {
              updateState({ 
                step: parsed.step as any, 
                currentAgent: parsed.agentName || parsed.step 
              });
            }

            if (parsed.ideas) {
              ideas = parsed.ideas.map((idea: any, idx: number) => ({
                id: `idea-${idx + 1}`,
                title: idea.title,
                description: idea.description,
                format: contentFormat,
                inspiration: idea.inspiration,
              }));
            }

            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      updateState({ 
        step: "ideas_ready", 
        currentAgent: null, 
        ideas 
      });

      return ideas;
    } catch (err: any) {
      console.error("[IDEA_PIPELINE] Error generating ideas:", err);
      updateState({ step: "error", error: err.message, currentAgent: null });
      toast({
        title: "Erro ao gerar ideias",
        description: err.message,
        variant: "destructive",
      });
      return [];
    }
  }, [user?.id, toast]);

  // =========================================
  // FASE 2: GERAR CONTEÚDO A PARTIR DE IDEIA
  // =========================================
  const generateContentFromIdea = useCallback(async (
    options: IdeaPipelineOptions,
    idea: GeneratedIdea
  ) => {
    const { clientId, clientName, contentFormat, identityGuide, contentLibrary, referenceLibrary, globalKnowledge } = options;

    try {
      updateState({ 
        step: "generating_content", 
        currentAgent: "Escritor de Conteúdo", 
        selectedIdea: idea, 
        error: null 
      });

      // Chamar edge function especializada em gerar conteúdo
      const { data, error } = await supabase.functions.invoke("generate-content-from-idea", {
        body: {
          clientId,
          clientName,
          contentFormat,
          identityGuide,
          contentLibrary: contentLibrary.slice(0, 20),
          referenceLibrary: referenceLibrary.slice(0, 10),
          globalKnowledge: globalKnowledge?.slice(0, 5) || [],
          idea: {
            title: idea.title,
            description: idea.description,
            inspiration: idea.inspiration,
          },
          userId: user?.id,
        },
      });

      if (error) throw error;

      // Processar SSE stream
      const reader = data.body?.getReader();
      if (!reader) throw new Error("Sem resposta do servidor");

      const decoder = new TextDecoder();
      let buffer = "";
      let finalContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            
            if (parsed.step) {
              const stepMap: Record<string, IdeaPipelineState["step"]> = {
                "writer": "generating_content",
                "style_editor": "style_editing",
                "consistency_editor": "consistency_check",
                "final_reviewer": "final_review",
                "complete": "content_ready",
              };
              updateState({ 
                step: stepMap[parsed.step] || parsed.step as any, 
                currentAgent: parsed.agentName || parsed.step 
              });
            }

            if (parsed.content && parsed.step === "complete") {
              finalContent = parsed.content;
            }

            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      updateState({ 
        step: "content_ready", 
        currentAgent: null, 
        generatedContent: finalContent 
      });

      return finalContent;
    } catch (err: any) {
      console.error("[IDEA_PIPELINE] Error generating content:", err);
      updateState({ step: "error", error: err.message, currentAgent: null });
      toast({
        title: "Erro ao gerar conteúdo",
        description: err.message,
        variant: "destructive",
      });
      return null;
    }
  }, [user?.id, toast]);

  // =========================================
  // FASE 3: GERAR IMAGEM PARA O CONTEÚDO
  // =========================================
  const generateImageForContent = useCallback(async (
    clientId: string,
    content: string,
    format: string
  ) => {
    try {
      updateState({ currentAgent: "Gerador de Imagem" });

      // Criar prompt para imagem baseado no conteúdo
      const imagePrompt = `Crie uma imagem profissional para ${format === 'stories' ? 'Instagram Stories' : format === 'carousel' ? 'carrossel do Instagram' : 'post de redes sociais'} sobre: ${content.substring(0, 500)}`;

      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          prompt: imagePrompt,
          clientId,
          userId: user?.id,
          imageFormat: format,
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        updateState({ generatedImageUrl: data.imageUrl, currentAgent: null });
        return data.imageUrl;
      }

      return null;
    } catch (err: any) {
      console.error("[IDEA_PIPELINE] Error generating image:", err);
      toast({
        title: "Erro ao gerar imagem",
        description: err.message,
        variant: "destructive",
      });
      return null;
    }
  }, [user?.id, toast]);

  // =========================================
  // RESET
  // =========================================
  const reset = useCallback(() => {
    setState({
      step: "idle",
      currentAgent: null,
      ideas: [],
      selectedIdea: null,
      generatedContent: null,
      generatedImageUrl: null,
      error: null,
    });
  }, []);

  const selectIdea = useCallback((idea: GeneratedIdea) => {
    updateState({ selectedIdea: idea });
  }, []);

  return {
    state,
    generateIdeas,
    generateContentFromIdea,
    generateImageForContent,
    selectIdea,
    reset,
  };
};
