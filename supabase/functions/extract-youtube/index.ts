import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Keep some request-scoped variables for safe fallback responses in the catch block
  let requestedUrl = "";
  let videoId = "";
  let title = "Vídeo do YouTube";
  let duration: string | number | null = null;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = await req.json();
    requestedUrl = url;

    if (!url) {
      throw new Error("URL do YouTube é obrigatória");
    }

    const SUPADATA_API_KEY = Deno.env.get("SUPADATA_API_KEY");
    if (!SUPADATA_API_KEY) {
      throw new Error("SUPADATA_API_KEY não configurada");
    }

    console.log("🎬 Extraindo transcrição do YouTube:", url);

    // Extrai o videoId primeiro
    videoId = extractVideoId(url);
    let content = "";

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

    const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    
    // Tentar obter informações básicas do vídeo via oEmbed se não temos título
    if (title === "Vídeo do YouTube") {
      try {
        const oEmbedResponse = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );
        if (oEmbedResponse.ok) {
          const oEmbedData = await oEmbedResponse.json();
          title = oEmbedData.title || title;
          console.log("📺 Título via oEmbed:", title);
        }
      } catch (oEmbedErr) {
        console.warn("⚠️ Não foi possível obter título via oEmbed:", oEmbedErr);
      }
    }

    // Determinar status da transcrição
    const hasTranscript = content && content.length > 0;
    
    if (!hasTranscript) {
      console.warn("⚠️ Transcrição não disponível, retornando apenas metadados do vídeo");
    } else {
      console.log("🎉 Sucesso! Retornando dados completos com transcrição.");
    }

    return new Response(
      JSON.stringify({
        title,
        content: content || "",
        transcript: content || "",
        thumbnail,
        videoId,
        hasTranscript,
        metadata: {
          duration: duration,
          language: hasTranscript ? "pt" : null,
          extractionMethod: hasTranscript ? "success" : "metadata_only",
          contentLength: content?.length || 0,
          transcriptUnavailable: !hasTranscript,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Erro em extract-youtube:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";

    // If transcript extraction fails (common case: no captions), return 200 with metadata instead of 500.
    // This prevents the UI from breaking and still lets the user use title/thumbnail as reference.
    const transcriptFailureSignals = [
      "Não foi possível extrair a transcrição",
      "Transcript Unavailable",
      "transcript-unavailable",
      "Legendas não disponíveis",
    ];
    const isTranscriptFailure = transcriptFailureSignals.some((s) => errorMessage.includes(s));

    if (isTranscriptFailure) {
      // Best effort: try to ensure we have a videoId to build a thumbnail
      try {
        if (!videoId && requestedUrl) videoId = extractVideoId(requestedUrl);
      } catch {
        // ignore
      }

      if (videoId) {
        const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        return new Response(
          JSON.stringify({
            title: title || "Vídeo do YouTube",
            content: "",
            transcript: "",
            thumbnail,
            videoId,
            hasTranscript: false,
            metadata: {
              duration,
              language: null,
              extractionMethod: "error_fallback_metadata_only",
              contentLength: 0,
              transcriptUnavailable: true,
              originalError: errorMessage,
            },
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

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
  // Check if it's a channel URL
  if (url.includes('/@') || url.includes('/channel/') || url.includes('/c/')) {
    throw new Error("Por favor, forneça uma URL de vídeo do YouTube, não uma URL de canal. Exemplo: https://youtube.com/watch?v=VIDEO_ID");
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  throw new Error("URL do YouTube inválida. Por favor, forneça uma URL de vídeo válida. Exemplo: https://youtube.com/watch?v=VIDEO_ID");
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
