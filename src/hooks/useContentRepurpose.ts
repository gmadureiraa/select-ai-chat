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
  | "email_marketing"
  | "cut_moments";

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

export interface CutMoment {
  timestamp: string;
  title: string;
  description: string;
  score: number;
  hook: string;
}

export interface GeneratedContent {
  format: ContentFormat;
  content: string;
  objective: ContentObjective;
  generatedAt: Date;
  cutMoments?: CutMoment[];
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

  cut_moments: `Analise a transcrição e identifique os 5 MELHORES momentos para criar cortes/clips virais.

Para cada momento, forneça:
1. TIMESTAMP aproximado (baseado na posição no texto, ex: "2:30 - 3:45")
2. TÍTULO: Nome curto e chamativo para o corte
3. DESCRIÇÃO: O que acontece neste momento (1-2 frases)
4. SCORE: Pontuação de 1-100 baseada no potencial viral
5. HOOK: Sugestão de gancho/legenda para o corte

Critérios para pontuação:
- Impacto emocional
- Valor informativo
- Potencial de compartilhamento
- Clareza da mensagem
- Elemento surpresa ou curiosidade

Retorne no formato JSON:
{
  "moments": [
    {
      "timestamp": "2:30 - 3:45",
      "title": "Título do momento",
      "description": "Descrição breve",
      "score": 95,
      "hook": "Gancho sugerido"
    }
  ]
}

Ordene do maior score para o menor.`,
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
  const [showResults, setShowResults] = useState(false);

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

  const parseStreamResponse = async (response: any): Promise<string> => {
    // Check if response.data is a ReadableStream
    if (response.data && typeof response.data.getReader === 'function') {
      const reader = response.data.getReader();
      const decoder = new TextDecoder();
      let result = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process line by line
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            
            // Support OpenAI format
            const openaiContent = parsed.choices?.[0]?.delta?.content;
            if (openaiContent) {
              result += openaiContent;
              continue;
            }
            
            // Support Gemini format (used by chat edge function)
            const geminiContent = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (geminiContent) {
              result += geminiContent;
              continue;
            }

            // Support direct content format
            if (parsed.content && typeof parsed.content === 'string') {
              result += parsed.content;
            }
          } catch {
            // Incomplete JSON, will handle in next chunk
          }
        }
      }

      return result;
    }
    
    // If it's not a stream, try to get content directly
    if (typeof response.data === 'string') {
      return response.data;
    }
    
    if (response.data?.content) {
      return response.data.content;
    }

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content;
    }

    // Try Gemini format for non-stream
    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.data.candidates[0].content.parts[0].text;
    }

    // Log for debugging
    console.log("Response data type:", typeof response.data);
    console.log("Response data:", response.data);

    throw new Error("Formato de resposta não reconhecido");
  };

  const generateForFormat = async (format: ContentFormat): Promise<GeneratedContent> => {
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

    try {
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

      const content = await parseStreamResponse(response);

      // Parse cut moments if this is the cut_moments format
      let cutMoments: CutMoment[] | undefined;
      if (format === "cut_moments") {
        try {
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\{[\s\S]*"moments"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            cutMoments = parsed.moments.map((m: any) => ({
              timestamp: m.timestamp || "0:00",
              title: m.title || "Momento",
              description: m.description || "",
              score: m.score || 50,
              hook: m.hook || "",
            }));
          }
        } catch {
          console.log("Could not parse cut moments JSON");
        }
      }

      return {
        format,
        content,
        objective: contentObjective,
        generatedAt: new Date(),
        cutMoments,
      };
    } catch (error) {
      console.error(`Error generating ${format}:`, error);
      throw error;
    }
  };

  const generateAll = async () => {
    if (!contentObjective || selectedFormats.length === 0) {
      throw new Error("Selecione objetivo e formatos");
    }

    setIsGenerating(true);
    setGeneratedContents([]);

    try {
      const results: GeneratedContent[] = [];
      
      for (const format of selectedFormats) {
        setGeneratingFormat(format);
        
        const generatedContent = await generateForFormat(format);
        results.push(generatedContent);
        
        setGeneratedContents([...results]);
      }

      setShowResults(true);
      return results;
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
    setShowResults(false);
  };

  const goBackToForm = () => {
    setShowResults(false);
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
    showResults,
    transcribe,
    generateForFormat,
    generateAll,
    copyToClipboard,
    reset,
    goBackToForm,
  };
}
