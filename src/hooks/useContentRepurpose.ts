import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ContentFormat = 
  | "newsletter" 
  | "thread" 
  | "tweet" 
  | "carousel" 
  | "linkedin_post" 
  | "instagram_post" 
  | "reels_script" 
  | "blog_post" 
  | "email_marketing";

export type ContentObjective = 
  | "sales" 
  | "lead_generation" 
  | "educational" 
  | "brand_awareness";

export interface TranscriptData {
  title: string;
  content: string;
  thumbnail: string;
  videoId: string;
  metadata?: {
    duration?: number;
    language?: string;
  };
}

export interface GeneratedContent {
  format: ContentFormat;
  content: string;
  objective: ContentObjective;
  generatedAt: Date;
}

const FORMAT_PROMPTS: Record<ContentFormat, string> = {
  newsletter: `Crie uma newsletter completa e envolvente com:
- Título chamativo
- Introdução que conecta com o leitor
- Corpo do texto com os principais insights
- Conclusão com call-to-action
- Tom pessoal e profissional`,
  
  thread: `Crie uma thread para Twitter/X com:
- 5-10 tweets conectados
- Primeiro tweet como gancho forte
- Cada tweet deve ter valor isolado
- Use emojis estratégicos
- Último tweet com CTA
- Numere cada tweet (1/, 2/, etc)`,
  
  tweet: `Crie um tweet único e impactante:
- Máximo 280 caracteres
- Gancho forte no início
- Inclua insight valioso
- Use emojis se apropriado
- Opcional: hashtags relevantes`,
  
  carousel: `Crie o conteúdo para um carrossel de Instagram/LinkedIn:
- Slide 1: Título/Gancho chamativo
- Slides 2-8: Um insight por slide
- Último slide: CTA
- Texto curto e direto por slide
- Separe claramente cada slide com "---"`,
  
  linkedin_post: `Crie um post para LinkedIn:
- Primeira linha como gancho
- Parágrafos curtos (1-3 linhas)
- Use espaçamentos estratégicos
- Tom profissional mas pessoal
- Inclua insights acionáveis
- CTA no final
- 3-5 hashtags relevantes`,
  
  instagram_post: `Crie uma legenda para Instagram:
- Primeira linha chamativa
- Conteúdo valor
- Emojis estratégicos
- Quebras de linha
- CTA
- 20-30 hashtags relevantes no final`,
  
  reels_script: `Crie um roteiro para Reels/TikTok:
- Duração: 30-60 segundos
- GANCHO (0-3s): Frase que para o scroll
- DESENVOLVIMENTO (3-20s): Conteúdo principal
- CLÍMAX (20-25s): Insight principal
- CTA (25-30s): Ação desejada
- Use linguagem oral e dinâmica`,
  
  blog_post: `Crie um artigo de blog completo:
- Título SEO-friendly
- Introdução envolvente
- Subtítulos (H2, H3)
- Parágrafos bem estruturados
- Exemplos práticos
- Conclusão com takeaways
- Meta descrição`,
  
  email_marketing: `Crie um email de marketing:
- Assunto irresistível (+ 2 variações)
- Preview text
- Saudação pessoal
- Corpo com benefícios claros
- Prova social se aplicável
- CTA principal destacado
- PS opcional`,
};

const OBJECTIVE_CONTEXT: Record<ContentObjective, string> = {
  sales: "Foco em conversão e vendas. Destaque benefícios, resolução de problemas e urgência. Use CTAs de compra/contratação.",
  lead_generation: "Foco em captura de leads. Ofereça valor em troca de contato. Use CTAs para baixar materiais, inscrever-se, agendar reunião.",
  educational: "Foco em ensinar e informar. Estruture de forma didática. Use exemplos e analogias. Posicione como autoridade no assunto.",
  brand_awareness: "Foco em construir reconhecimento e autoridade. Conte histórias. Mostre valores e propósito. Crie conexão emocional.",
};

export function useContentRepurpose(clientId: string) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<ContentFormat[]>([]);
  const [contentObjective, setContentObjective] = useState<ContentObjective | null>(null);
  const [generatedContents, setGeneratedContents] = useState<GeneratedContent[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingFormat, setGeneratingFormat] = useState<string | null>(null);

  const transcribe = async () => {
    if (!youtubeUrl.trim()) {
      throw new Error("URL do YouTube é obrigatória");
    }

    setIsTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-youtube", {
        body: { url: youtubeUrl },
      });

      if (error) throw error;
      if (!data || !data.content) {
        throw new Error("Não foi possível extrair a transcrição do vídeo");
      }

      setTranscript({
        title: data.title,
        content: data.content,
        thumbnail: data.thumbnail,
        videoId: data.videoId,
        metadata: data.metadata,
      });

      return data;
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleFormat = (format: ContentFormat) => {
    setSelectedFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format]
    );
  };

  const generateForFormat = async (format: ContentFormat): Promise<string> => {
    if (!transcript || !contentObjective) {
      throw new Error("Transcrição e objetivo são obrigatórios");
    }

    const formatPrompt = FORMAT_PROMPTS[format];
    const objectiveContext = OBJECTIVE_CONTEXT[contentObjective];

    const systemPrompt = `Você é um especialista em criação de conteúdo para redes sociais e marketing digital.
    
Objetivo do conteúdo: ${objectiveContext}

REGRAS:
- Siga EXATAMENTE as instruções do formato solicitado
- Use a transcrição como base, mas adapte a linguagem
- Mantenha a essência do conteúdo original
- Não invente informações que não estão na transcrição
- Seja criativo mas fiel ao conteúdo`;

    const userPrompt = `${formatPrompt}

TRANSCRIÇÃO DO VÍDEO:
Título: ${transcript.title}

Conteúdo:
${transcript.content.substring(0, 15000)}

Gere o conteúdo no formato solicitado.`;

    const response = await supabase.functions.invoke("chat", {
      body: {
        messages: [{ role: "user", content: userPrompt }],
        systemPrompt,
        clientId,
        options: {
          includeFormats: true,
          contextLevel: "full",
        },
      },
    });

    if (response.error) throw response.error;

    // Parse streaming response
    const reader = response.data.getReader();
    const decoder = new TextDecoder();
    let result = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ") && !line.includes("[DONE]")) {
          try {
            const json = JSON.parse(line.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              result += content;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    return result;
  };

  const generateAll = async () => {
    if (!contentObjective || selectedFormats.length === 0) {
      throw new Error("Selecione objetivo e formatos");
    }

    setIsGenerating(true);
    setGeneratedContents([]);

    try {
      for (const format of selectedFormats) {
        setGeneratingFormat(format);
        
        const content = await generateForFormat(format);
        
        setGeneratedContents((prev) => [
          ...prev,
          {
            format,
            content,
            objective: contentObjective,
            generatedAt: new Date(),
          },
        ]);
      }
    } finally {
      setIsGenerating(false);
      setGeneratingFormat(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const reset = () => {
    setYoutubeUrl("");
    setTranscript(null);
    setSelectedFormats([]);
    setContentObjective(null);
    setGeneratedContents([]);
  };

  return {
    youtubeUrl,
    setYoutubeUrl,
    transcript,
    selectedFormats,
    toggleFormat,
    contentObjective,
    setContentObjective,
    generatedContents,
    isTranscribing,
    isGenerating,
    generatingFormat,
    transcribe,
    generateForFormat,
    generateAll,
    copyToClipboard,
    reset,
  };
}
