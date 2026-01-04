import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GenerateContentParams {
  title: string;
  description?: string;
  platform: string;
  contentType: string;
  clientId: string;
}

export function usePlanningContentGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateContent = async ({
    title,
    description,
    platform,
    contentType,
    clientId
  }: GenerateContentParams): Promise<string | null> => {
    if (!title || !platform || !clientId) {
      toast({
        title: "Dados incompletos",
        description: "Preencha título, plataforma e cliente para gerar conteúdo.",
        variant: "destructive"
      });
      return null;
    }

    setIsGenerating(true);

    try {
      // Map platform + contentType to content agent type
      const contentAgentType = mapToAgentType(platform, contentType);
      
      // Build prompt
      const prompt = buildPrompt(title, description, platform, contentType);

      console.log("[PlanningContent] Generating with content type:", contentAgentType, "prompt:", prompt.substring(0, 100));

      // Use content_writer as the main agent, with contentType for specialization
      const { data, error } = await supabase.functions.invoke("execute-agent", {
        body: {
          agentType: "content_writer",
          contentType: contentAgentType,
          userMessage: prompt,
          clientId,
          includeContext: true
        }
      });

      if (error) {
        console.error("[PlanningContent] Error:", error);
        throw error;
      }

      if (data?.content) {
        toast({
          title: "Conteúdo gerado!",
          description: "O conteúdo foi criado com base no título e contexto do cliente."
        });
        return data.content;
      }

      return null;
    } catch (error) {
      console.error("[PlanningContent] Generation failed:", error);
      toast({
        title: "Erro ao gerar conteúdo",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateContent,
    isGenerating
  };
}

function mapToAgentType(platform: string, contentType: string): string {
  const map: Record<string, Record<string, string>> = {
    instagram: {
      post: "static_post_agent",
      carousel: "carousel_agent",
      thread: "carousel_agent",
      article: "static_post_agent"
    },
    twitter: {
      post: "tweet_agent",
      thread: "thread_agent",
      article: "thread_agent",
      carousel: "thread_agent"
    },
    linkedin: {
      post: "linkedin_agent",
      article: "linkedin_agent",
      thread: "linkedin_agent",
      carousel: "linkedin_agent"
    },
    newsletter: {
      post: "newsletter_agent",
      article: "newsletter_agent",
      thread: "newsletter_agent",
      carousel: "newsletter_agent"
    },
    blog: {
      post: "blog_agent",
      article: "blog_agent",
      thread: "blog_agent",
      carousel: "blog_agent"
    },
    youtube: {
      post: "long_video_agent",
      article: "long_video_agent",
      thread: "long_video_agent",
      carousel: "long_video_agent"
    },
    tiktok: {
      post: "reels_agent",
      article: "reels_agent",
      thread: "reels_agent",
      carousel: "reels_agent"
    }
  };

  return map[platform]?.[contentType] || "static_post_agent";
}

function buildPrompt(title: string, description: string | undefined, platform: string, contentType: string): string {
  const platformNames: Record<string, string> = {
    instagram: "Instagram",
    twitter: "Twitter/X",
    linkedin: "LinkedIn",
    newsletter: "Newsletter",
    blog: "Blog",
    youtube: "YouTube",
    tiktok: "TikTok"
  };

  const contentTypeNames: Record<string, string> = {
    post: "post",
    carousel: "carrossel",
    thread: "thread",
    article: "artigo"
  };

  let prompt = `Crie um ${contentTypeNames[contentType] || "conteúdo"} para ${platformNames[platform] || platform} sobre: "${title}"`;

  if (description) {
    prompt += `\n\nDescrição adicional: ${description}`;
  }

  prompt += "\n\nSiga o tom de voz e estilo do cliente. Entregue o conteúdo pronto para publicar.";

  return prompt;
}
