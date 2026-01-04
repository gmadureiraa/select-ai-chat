import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseMentions } from "@/lib/mentionParser";

interface GenerateContentParams {
  title: string;
  contentType: string;
  clientId: string;
  referenceInput?: string; // Can be URL, @mentions, or plain text
}

interface ReferenceContent {
  title?: string;
  content: string;
  type: 'youtube' | 'article' | 'html' | 'newsletter';
}

export function usePlanningContentGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingReference, setIsFetchingReference] = useState(false);
  const { toast } = useToast();

  // Fetch content from a reference URL
  const fetchReferenceContent = async (url: string): Promise<ReferenceContent | null> => {
    if (!url) return null;

    try {
      const { data, error } = await supabase.functions.invoke("fetch-reference-content", {
        body: { url }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to fetch reference");

      return {
        title: data.title,
        content: data.content || "",
        type: data.type || "article"
      };
    } catch (error) {
      console.error("[PlanningContent] Reference fetch failed:", error);
      return null;
    }
  };

  // Fetch content from @mentions in the library
  const fetchMentionedContent = async (text: string): Promise<string> => {
    const mentions = parseMentions(text);
    if (mentions.length === 0) return "";

    const contents: string[] = [];

    for (const mention of mentions) {
      const table = mention.type === 'content' 
        ? 'client_content_library' 
        : 'client_reference_library';

      const { data } = await supabase
        .from(table)
        .select('title, content')
        .eq('id', mention.id)
        .single();

      if (data?.content) {
        contents.push(`**${data.title}:**\n${data.content}`);
      }
    }

    return contents.join('\n\n---\n\n');
  };

  const generateContent = async ({
    title,
    contentType,
    clientId,
    referenceInput
  }: GenerateContentParams): Promise<string | null> => {
    if (!title || !contentType || !clientId) {
      toast({
        title: "Dados incompletos",
        description: "Preencha título, formato e cliente para gerar conteúdo.",
        variant: "destructive"
      });
      return null;
    }

    setIsGenerating(true);
    setIsFetchingReference(true);

    try {
      let allReferenceContent: string[] = [];

      // 1. Detect and fetch URL content
      const urlMatch = referenceInput?.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        const fetched = await fetchReferenceContent(urlMatch[0]);
        if (fetched) {
          const sourceType = fetched.type === 'youtube' ? 'TRANSCRIÇÃO DO VÍDEO' :
                            fetched.type === 'newsletter' ? 'NEWSLETTER' :
                            'ARTIGO DE REFERÊNCIA';
          let refText = `**${sourceType}:**`;
          if (fetched.title) refText += `\nTítulo: ${fetched.title}`;
          refText += `\n\n${fetched.content.substring(0, 10000)}`;
          allReferenceContent.push(refText);
        }
      }

      // 2. Fetch @mentioned content
      const mentionContent = await fetchMentionedContent(referenceInput || "");
      if (mentionContent) {
        allReferenceContent.push(`**CONTEÚDO DA BIBLIOTECA:**\n\n${mentionContent}`);
      }

      // 3. Extract remaining plain text (without URL and without mentions)
      const cleanText = (referenceInput || "")
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/@\[[^\]]+\]\([^)]+\)/g, '')
        .trim();

      setIsFetchingReference(false);

      // Map to agent type
      const contentAgentType = mapToAgentType(contentType);
      
      // Build prompt
      const prompt = buildPrompt(
        title, 
        cleanText, 
        contentType, 
        allReferenceContent.length > 0 ? allReferenceContent.join('\n\n---\n\n') : undefined
      );

      console.log("[PlanningContent] Generating with content type:", contentAgentType, "hasReference:", allReferenceContent.length > 0);

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

      if (!data?.success) {
        throw new Error(data?.error || "Erro ao gerar conteúdo");
      }

      const generatedContent = data.output || data.content || "";

      if (generatedContent) {
        toast({
          title: "Conteúdo gerado!",
          description: allReferenceContent.length > 0 
            ? "O conteúdo foi criado com base nas referências e contexto do cliente."
            : "O conteúdo foi criado com base no título e contexto do cliente."
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
      setIsFetchingReference(false);
    }
  };

  return {
    generateContent,
    isGenerating,
    isFetchingReference
  };
}

function mapToAgentType(contentType: string): string {
  const contentTypeMapping: Record<string, string> = {
    tweet: "tweet_agent",
    thread: "thread_agent",
    x_article: "article_agent",
    linkedin_post: "linkedin_agent",
    carousel: "carousel_agent",
    stories: "static_post_agent",
    static_image: "static_post_agent",
    instagram_post: "static_post_agent",
    newsletter: "newsletter_agent",
    blog_post: "blog_agent",
    short_video: "reels_agent",
    long_video: "long_video_agent",
    other: "static_post_agent"
  };

  return contentTypeMapping[contentType] || "static_post_agent";
}

function buildPrompt(
  title: string, 
  additionalDescription: string | undefined, 
  contentType: string,
  referenceContent?: string
): string {
  const contentTypeNames: Record<string, string> = {
    tweet: "tweet para Twitter/X",
    thread: "thread com 5-10 tweets para Twitter/X",
    x_article: "artigo no X",
    linkedin_post: "post para LinkedIn",
    carousel: "carrossel com 8-10 slides para Instagram",
    stories: "sequência de stories para Instagram",
    static_image: "post para Instagram",
    instagram_post: "post para Instagram",
    newsletter: "newsletter completa",
    blog_post: "artigo de blog",
    short_video: "roteiro de vídeo curto (Reels/TikTok)",
    long_video: "roteiro de vídeo longo (YouTube)",
    other: "conteúdo"
  };

  const formatName = contentTypeNames[contentType] || "conteúdo";

  let prompt = `Crie um ${formatName} sobre: "${title}"`;

  if (additionalDescription) {
    prompt += `\n\nInstruções adicionais: ${additionalDescription}`;
  }

  if (referenceContent) {
    prompt += `\n\n---\n\n**MATERIAL DE REFERÊNCIA:**\n\n${referenceContent}`;
    prompt += `\n\n---\n\nUSE o material de referência acima como base principal para criar o conteúdo, extraindo os melhores insights e adaptando para o formato ${formatName}.`;
  }

  prompt += `\n\nIMPORTANTE:
- Siga rigorosamente as regras do formato ${formatName}
- Use o tom de voz e estilo do cliente
- Entregue o conteúdo 100% pronto para publicar
- Seja específico e evite generalidades`;

  return prompt;
}
