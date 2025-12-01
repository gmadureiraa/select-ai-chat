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

    console.log("🎬 Extraindo transcrição do YouTube:", url);

    // Extrai o videoId primeiro
    const videoId = extractVideoId(url);
    let title = "Vídeo do YouTube";
    let content = "";
    let duration = null;

    // MÉTODO 1: Tentar API Supadata primeiro
    try {
      console.log("📡 Tentando API Supadata...");
      const transcriptResponse = await fetch(
        `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}&text=true&lang=pt`,
        {
          headers: {
            "x-api-key": SUPADATA_API_KEY,
          },
        }
      );

      if (transcriptResponse.ok) {
        const transcriptData = await transcriptResponse.json();
        console.log("✅ Resposta Supadata OK");
        console.log("🔑 Chaves disponíveis:", Object.keys(transcriptData));
        console.log("📦 Dados completos:", JSON.stringify(transcriptData));
        
        title = transcriptData.title || transcriptData.video_title || title;
        content = transcriptData.content || transcriptData.transcript || transcriptData.text || "";
        duration = transcriptData.duration;
        
        console.log("📝 Título:", title);
        console.log("📏 Tamanho do content:", content.length);
        if (content.length > 0) {
          console.log("📄 Preview (primeiros 200 chars):", content.substring(0, 200));
        }
      } else {
        const errorText = await transcriptResponse.text();
        console.warn("⚠️ Supadata falhou:", transcriptResponse.status, errorText);
      }
    } catch (supErr) {
      console.error("❌ Erro no Supadata:", supErr);
    }

    // MÉTODO 2: Fallback - YouTube Inner API
    if (!content || content.length === 0) {
      console.log("🔄 Tentando método alternativo (YouTube Inner API)...");
      try {
        content = await fetchYouTubeTranscript(videoId);
        if (content && content.length > 0) {
          console.log("✅ Transcrição obtida via fallback!");
          console.log("📏 Tamanho:", content.length);
          console.log("📄 Preview:", content.substring(0, 200));
        }
      } catch (fallbackErr) {
        console.error("❌ Fallback também falhou:", fallbackErr);
      }
    }

    // Verificação final
    if (!content || content.length === 0) {
      console.error("💥 FALHA TOTAL: Nenhum método conseguiu extrair a transcrição!");
      throw new Error("Não foi possível extrair a transcrição do vídeo. O vídeo pode não ter legendas disponíveis em português.");
    }

    const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    console.log("🎉 Sucesso! Retornando dados completos.");

    return new Response(
      JSON.stringify({
        title,
        content,
        thumbnail,
        videoId,
        metadata: {
          duration: duration,
          language: "pt",
          extractionMethod: "success",
          contentLength: content.length,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Erro em extract-youtube:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      }),
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

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  try {
    // Obtém a página do vídeo
    const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const videoPageHtml = await videoPageResponse.text();
    
    // Extrai o player response
    const playerResponseMatch = videoPageHtml.match(/var ytInitialPlayerResponse = ({.+?});/);
    if (!playerResponseMatch) {
      throw new Error("Player response não encontrado");
    }
    
    const playerResponse = JSON.parse(playerResponseMatch[1]);
    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    
    if (!captions || captions.length === 0) {
      throw new Error("Legendas não disponíveis");
    }
    
    // Procura por legendas em português
    let captionTrack = captions.find((track: any) => 
      track.languageCode === 'pt' || track.languageCode === 'pt-BR'
    );
    
    // Se não encontrar em português, pega a primeira disponível
    if (!captionTrack) {
      captionTrack = captions[0];
    }
    
    // Baixa as legendas
    const captionUrl = captionTrack.baseUrl;
    const captionResponse = await fetch(captionUrl);
    const captionXml = await captionResponse.text();
    
    // Parse XML e extrai texto
    const textMatches = captionXml.matchAll(/<text[^>]*>(.*?)<\/text>/g);
    const transcriptParts: string[] = [];
    
    for (const match of textMatches) {
      const text = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]+>/g, ''); // Remove tags HTML
      
      if (text.trim()) {
        transcriptParts.push(text.trim());
      }
    }
    
    return transcriptParts.join(' ');
  } catch (error) {
    console.error("Erro ao buscar transcrição diretamente:", error);
    throw error;
  }
}
