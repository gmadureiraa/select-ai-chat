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
  thumbnail?: string;
  images?: string[];
}

interface GenerateContentResult {
  content: string;
  images: string[];
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
        type: data.type || "article",
        thumbnail: data.thumbnail,
        images: data.images || []
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
  }: GenerateContentParams): Promise<GenerateContentResult | null> => {
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
      let extractedImages: string[] = [];

      // 1. Detect and fetch ALL URL content (supports multiple URLs)
      const urlMatches = referenceInput?.match(/https?:\/\/[^\s]+/g) || [];
      if (urlMatches.length > 0) {
        console.log(`[PlanningContent] Found ${urlMatches.length} URLs to fetch`);
        
        // Fetch all URLs in parallel
        const fetchPromises = urlMatches.map(url => fetchReferenceContent(url));
        const fetchedResults = await Promise.all(fetchPromises);
        
        let successCount = 0;
        fetchedResults.forEach((fetched, index) => {
          if (fetched) {
            successCount++;
            const sourceType = fetched.type === 'youtube' ? 'TRANSCRIÇÃO DO VÍDEO' :
                              fetched.type === 'newsletter' ? 'NEWSLETTER' :
                              'ARTIGO DE REFERÊNCIA';
            let refText = `**${sourceType} ${urlMatches.length > 1 ? `#${index + 1}` : ''}:**`;
            if (fetched.title) refText += `\nTítulo: ${fetched.title}`;
            // Limit each source content to allow more sources
            const charLimit = Math.floor(12000 / urlMatches.length);
            refText += `\n\n${fetched.content.substring(0, charLimit)}`;
            allReferenceContent.push(refText);

            // Capture images from reference
            if (fetched.thumbnail && !extractedImages.includes(fetched.thumbnail)) {
              extractedImages.push(fetched.thumbnail);
            }
            if (fetched.images && fetched.images.length > 0) {
              fetched.images.forEach(img => {
                if (!extractedImages.includes(img)) {
                  extractedImages.push(img);
                }
              });
            }
          }
        });

        // Warn user about partial failures
        if (successCount < urlMatches.length) {
          toast({
            title: `Aviso: ${urlMatches.length - successCount} URL(s) não carregada(s)`,
            description: successCount > 0 
              ? `Gerando com ${successCount} fonte(s) disponível(is).`
              : "Não foi possível extrair conteúdo das URLs. Gerando apenas com o título.",
            variant: "default"
          });
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

      
      // Build prompt
      const prompt = buildPrompt(
        title, 
        cleanText, 
        contentType, 
        allReferenceContent.length > 0 ? allReferenceContent.join('\n\n---\n\n') : undefined
      );

      console.log("[PlanningContent] Generating with content type:", contentType, "hasReference:", allReferenceContent.length > 0);

      // Call kai-content-agent which handles streaming and context
      const { data, error } = await supabase.functions.invoke("kai-content-agent", {
        body: {
          clientId,
          request: prompt,
          format: contentType,
          platform: getPlatformFromContentType(contentType)
        }
      });

      if (error) {
        console.error("[PlanningContent] Invoke error:", error);
        throw error;
      }

      // Handle streaming response
      let generatedContent = "";
      
      if (typeof data === "string") {
        // Parse SSE response
        const lines = data.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && !line.includes("[DONE]")) {
            try {
              const jsonStr = line.slice(6);
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                generatedContent += content;
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        generatedContent = data?.content || data?.output || "";
      }

      if (generatedContent) {
        const imageCount = extractedImages.length;
        toast({
          title: "Conteúdo gerado!",
          description: imageCount > 0 
            ? `Conteúdo criado com ${imageCount} imagem(s) da referência.`
            : allReferenceContent.length > 0 
              ? "O conteúdo foi criado com base nas referências e contexto do cliente."
              : "O conteúdo foi criado com base no título e contexto do cliente."
        });
        return {
          content: generatedContent,
          images: extractedImages.slice(0, 3) // Limit to 3 images
        };
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

function getPlatformFromContentType(contentType: string): string {
  const platformMapping: Record<string, string> = {
    tweet: "Twitter/X",
    thread: "Twitter/X",
    x_article: "Twitter/X",
    linkedin_post: "LinkedIn",
    carousel: "Instagram",
    stories: "Instagram",
    static_image: "Instagram",
    instagram_post: "Instagram",
    newsletter: "Email",
    blog_post: "Blog",
    short_video: "Instagram/TikTok",
    long_video: "YouTube",
    other: "Geral"
  };

  return platformMapping[contentType] || "Instagram";
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
