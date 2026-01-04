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
        console.error("[PlanningContent] Invoke error:", error);
        throw error;
      }

      console.log("[PlanningContent] Response data:", data);

      // Check for success and extract output
      if (!data?.success) {
        throw new Error(data?.error || "Erro ao gerar conteúdo");
      }

      const generatedContent = data.output || data.content || "";

      if (generatedContent) {
        toast({
          title: "Conteúdo gerado!",
          description: "O conteúdo foi criado com base no título e contexto do cliente."
        });
        return generatedContent;
      }

      toast({
        title: "Sem conteúdo",
        description: "A IA não retornou conteúdo. Tente novamente.",
        variant: "destructive"
      });
      return null;
    } catch (error) {
      console.error("[PlanningContent] Generation failed:", error);
      toast({
        title: "Erro ao gerar conteúdo",
        description: error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
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
  // Direct mapping based on platform and content type
  const platformMappings: Record<string, Record<string, string>> = {
    instagram: {
      post: "static_post_agent",
      carousel: "carousel_agent",
      stories: "static_post_agent",
      static_image: "static_post_agent"
    },
    twitter: {
      post: "tweet_agent",
      tweet: "tweet_agent",
      thread: "thread_agent",
      article: "article_agent"
    },
    linkedin: {
      post: "linkedin_agent",
      article: "linkedin_agent"
    },
    newsletter: {
      post: "newsletter_agent",
      article: "newsletter_agent"
    },
    blog: {
      post: "blog_agent",
      article: "blog_agent"
    },
    youtube: {
      post: "long_video_agent",
      video: "long_video_agent"
    },
    tiktok: {
      post: "reels_agent",
      video: "reels_agent"
    }
  };

  // First try platform + contentType combination
  const platformMapping = platformMappings[platform];
  if (platformMapping && platformMapping[contentType]) {
    return platformMapping[contentType];
  }

  // Fallback: try to infer from contentType alone
  const contentTypeMapping: Record<string, string> = {
    tweet: "tweet_agent",
    thread: "thread_agent",
    carousel: "carousel_agent",
    stories: "static_post_agent",
    static_image: "static_post_agent",
    instagram_post: "static_post_agent",
    linkedin_post: "linkedin_agent",
    newsletter: "newsletter_agent",
    blog_post: "blog_agent",
    short_video: "reels_agent",
    long_video: "long_video_agent",
    x_article: "article_agent"
  };

  if (contentTypeMapping[contentType]) {
    return contentTypeMapping[contentType];
  }

  // Fallback based on platform only
  const platformDefaults: Record<string, string> = {
    instagram: "static_post_agent",
    twitter: "tweet_agent",
    linkedin: "linkedin_agent",
    newsletter: "newsletter_agent",
    blog: "blog_agent",
    youtube: "long_video_agent",
    tiktok: "reels_agent"
  };

  return platformDefaults[platform] || "static_post_agent";
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
    tweet: "tweet",
    thread: "thread com 5-10 tweets",
    carousel: "carrossel com 8-10 slides",
    stories: "sequência de stories",
    static_image: "post",
    instagram_post: "post",
    linkedin_post: "post",
    newsletter: "newsletter completa",
    blog_post: "artigo de blog",
    short_video: "roteiro de vídeo curto",
    long_video: "roteiro de vídeo longo",
    x_article: "artigo no X",
    article: "artigo"
  };

  const formatName = contentTypeNames[contentType] || "conteúdo";
  const platformName = platformNames[platform] || platform;

  let prompt = `Crie um ${formatName} para ${platformName} sobre: "${title}"`;

  if (description) {
    prompt += `\n\nContexto adicional: ${description}`;
  }

  prompt += `\n\nIMPORTANTE:
- Siga rigorosamente as regras do formato ${formatName}
- Use o tom de voz e estilo do cliente
- Entregue o conteúdo 100% pronto para publicar
- Seja específico e evite generalidades`;

  return prompt;
}
