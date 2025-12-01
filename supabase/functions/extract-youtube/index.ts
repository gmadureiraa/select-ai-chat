import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      throw new Error("URL do YouTube é obrigatória");
    }

    const SUPADATA_API_KEY = Deno.env.get("SUPADATA_API_KEY");
    if (!SUPADATA_API_KEY) {
      throw new Error("SUPADATA_API_KEY não configurada");
    }

    console.log("Extraindo transcrição do YouTube:", url);

    // Chama a API Supadata para obter a transcrição
    const transcriptResponse = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}&text=true&lang=pt`,
      {
        headers: {
          "x-api-key": SUPADATA_API_KEY,
        },
      }
    );

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      console.error("Erro ao obter transcrição:", transcriptResponse.status, errorText);
      throw new Error(`Falha ao obter transcrição: ${transcriptResponse.status}`);
    }

    const transcriptData = await transcriptResponse.json();
    console.log("Dados da transcrição recebidos:", JSON.stringify(transcriptData).substring(0, 500));
    console.log("Chaves disponíveis:", Object.keys(transcriptData));
    
    // Extrai informações do vídeo da URL
    const videoId = extractVideoId(url);
    const title = transcriptData.title || transcriptData.video_title || "Vídeo do YouTube";
    
    // CORREÇÃO CRÍTICA: Ler 'content' primeiro (é o campo correto da API Supadata)
    const content = transcriptData.content || transcriptData.transcript || transcriptData.text || transcriptData.transcription || "";
    const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    
    console.log("Título extraído:", title);
    console.log("Content length:", content.length);
    console.log("Content preview:", content.substring(0, 200));
    
    if (!content || content.length === 0) {
      console.error("ERRO: Transcrição vazia! TranscriptData:", JSON.stringify(transcriptData));
    } else {
      console.log("Transcrição obtida com sucesso");
    }

    return new Response(
      JSON.stringify({
        title,
        content,
        thumbnail,
        videoId,
        metadata: {
          duration: transcriptData.duration,
          language: "pt",
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro em extract-youtube:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function extractVideoId(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  throw new Error("ID do vídeo não encontrado na URL");
}
