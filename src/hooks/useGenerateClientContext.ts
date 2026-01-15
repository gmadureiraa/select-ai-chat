import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useGenerateClientContext = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateContext = async (clientData: {
    name: string;
    description?: string;
    tags?: Record<string, string>;
    social_media?: Record<string, string>;
    function_templates?: string[];
    websites?: string[];
    documents?: string[];
  }): Promise<string> => {
    setIsGenerating(true);

    try {
      const prompt = `Como assistente de IA da Kaleidos, analise PROFUNDAMENTE todas as informações do cliente e crie um documento de contexto completo e estruturado.

DADOS DO CLIENTE:
Nome: ${clientData.name}
${clientData.description ? `Descrição: ${clientData.description}` : ""}

${clientData.tags?.segment ? `Segmento: ${clientData.tags.segment}` : ""}
${clientData.tags?.tone ? `Tom de Voz: ${clientData.tags.tone}` : ""}
${clientData.tags?.objectives ? `Objetivos: ${clientData.tags.objectives}` : ""}
${clientData.tags?.audience ? `Público-Alvo: ${clientData.tags.audience}` : ""}

${
  clientData.social_media && Object.values(clientData.social_media).some((v) => v)
    ? `REDES SOCIAIS:\n${Object.entries(clientData.social_media)
        .filter(([_, v]) => v)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")}`
    : ""
}

${
  clientData.function_templates && clientData.function_templates.length > 0
    ? `FUNÇÕES/PADRÕES RECORRENTES:\n${clientData.function_templates.map((f, i) => `${i + 1}. ${f}`).join("\n")}`
    : ""
}

${
  clientData.websites && clientData.websites.length > 0
    ? `CONTEÚDO DOS WEBSITES:\n${clientData.websites.join("\n\n---\n\n")}`
    : ""
}

${
  clientData.documents && clientData.documents.length > 0
    ? `DOCUMENTOS ANEXADOS:\n${clientData.documents.join("\n")}`
    : ""
}

INSTRUÇÕES:
Crie um documento de contexto estruturado seguindo EXATAMENTE este formato:

# ${clientData.name} - Contexto Operacional

## 1. IDENTIDADE DA MARCA
[Descreva a essência da marca, posicionamento e personalidade]

## 2. PÚBLICO-ALVO
**Perfil Demográfico:**
[Idade, localização, gênero, renda, etc]

**Perfil Psicográfico:**
[Interesses, valores, comportamentos, desafios]

**Necessidades e Dores:**
[Principais problemas que o cliente resolve para seu público]

## 3. TOM DE VOZ E COMUNICAÇÃO
**Tom de Voz:** [Características principais]
**Palavras-Chave:** [Termos importantes para usar]
**Evitar:** [Termos ou abordagens a evitar]

## 4. OBJETIVOS DE MARKETING
**Objetivo Principal:** [Objetivo macro]
**Objetivos Específicos:**
- [Objetivo 1]
- [Objetivo 2]
- [Objetivo 3]

## 5. DIFERENCIAIS COMPETITIVOS
[O que torna este cliente único no mercado]

## 6. DIRETRIZES DE CONTEÚDO
**Formatos Preferidos:** [Posts, carrosséis, vídeos, etc]
**Temas Principais:** [Pilares de conteúdo]
**Frequência:** [Ritmo de publicações]

## 7. REGRAS E RESTRIÇÕES
[Qualquer limitação, termo proibido, ou regra específica]

---

**IMPORTANTE:** 
- Use as informações fornecidas para preencher cada seção
- Seja específico e detalhado
- Se alguma informação não foi fornecida, use [A definir] ou infira de forma inteligente baseado no contexto
- Mantenha o formato markdown limpo e organizado
- Foque em informações acionáveis para criação de conteúdo`;

      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [
            {
              role: "system",
              content:
                "Você é um especialista em planejamento de marketing digital. Crie contextos estruturados e completos para perfis.",
            },
            { role: "user", content: prompt },
          ],
          model: "gpt-5-mini-2025-08-07",
        },
      });

      if (error) throw error;

      // Processar resposta streaming
      const reader = data.body?.getReader();
      const decoder = new TextDecoder();
      let result = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.trim() || line.startsWith(":")) continue;

            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices[0]?.delta?.content || "";
                result += content;
              } catch (e) {
                // Ignore parse errors in streaming
              }
            }
          }
        }
      }

      return result;
    } catch (error) {
      console.error("Error generating context:", error);
      toast({
        title: "Erro ao gerar contexto",
        description: "Não foi possível gerar o contexto automaticamente.",
        variant: "destructive",
      });
      return "";
    } finally {
      setIsGenerating(false);
    }
  };

  return { generateContext, isGenerating };
};
