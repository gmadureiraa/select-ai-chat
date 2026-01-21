import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImageGenRequest {
  prompt: string;
  referenceImage?: string;
  aspectRatio: "1:1" | "16:9" | "9:16" | "4:5";
  noText: boolean;
  preserveFace: boolean;
  clientId?: string;
}

function buildPrompt(req: ImageGenRequest): string {
  const parts: string[] = [];

  // Reference image instructions
  if (req.referenceImage) {
    if (req.preserveFace) {
      parts.push("VERY IMPORTANT: Keep the EXACT same person, face, and identity from the reference image. The person must be recognizable as the same individual.");
    }
    parts.push("Use the reference image as a style guide. Match the visual aesthetic, lighting, and mood.");
  }

  // No text constraint
  if (req.noText) {
    parts.push("CRITICAL: Do NOT include any text, letters, numbers, or writing in the image. The image must be purely visual.");
  }

  // Main creation prompt
  parts.push(`CREATE: ${req.prompt}`);

  // Aspect ratio guidance
  const arGuide: Record<string, string> = {
    "1:1": "Square composition (1:1 aspect ratio)",
    "16:9": "Wide horizontal composition (16:9 aspect ratio, cinematic)",
    "9:16": "Vertical composition (9:16 aspect ratio, mobile/stories format)",
    "4:5": "Portrait composition (4:5 aspect ratio, Instagram post)",
  };
  parts.push(arGuide[req.aspectRatio] || "Square composition");

  // Quality suffix
  parts.push("Ultra high quality, professional, detailed, vibrant colors.");

  return parts.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body: ImageGenRequest = await req.json();
    const { prompt, referenceImage, aspectRatio = "1:1", noText = false, preserveFace = false, clientId } = body;

    if (!prompt || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[generate-image-simple] Starting:", { 
      promptLength: prompt.length, 
      hasReference: !!referenceImage, 
      aspectRatio, 
      noText, 
      preserveFace 
    });

    // Build the final prompt
    const finalPrompt = buildPrompt({ prompt, referenceImage, aspectRatio, noText, preserveFace, clientId });
    console.log("[generate-image-simple] Final prompt:", finalPrompt.substring(0, 200) + "...");

    // Check for API key
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Image generation not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Gemini request
    const contentParts: any[] = [{ text: finalPrompt }];

    // Add reference image if provided
    if (referenceImage) {
      const base64Match = referenceImage.match(/^data:image\/(\w+);base64,(.+)$/);
      if (base64Match) {
        contentParts.unshift({
          inline_data: {
            mime_type: `image/${base64Match[1]}`,
            data: base64Match[2],
          },
        });
      }
    }

    // Call Gemini 2.0 Flash Image
    const MODEL = "gemini-2.0-flash-exp-image-generation";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: contentParts }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            temperature: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate-image-simple] Gemini error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("[generate-image-simple] Gemini response received");

    // Extract image from response
    const parts = data.candidates?.[0]?.content?.parts || [];
    let imageBase64: string | null = null;
    let mimeType = "image/png";

    for (const part of parts) {
      if (part.inline_data?.data) {
        imageBase64 = part.inline_data.data;
        mimeType = part.inline_data.mime_type || "image/png";
        break;
      }
    }

    if (!imageBase64) {
      console.error("[generate-image-simple] No image in response");
      return new Response(
        JSON.stringify({ error: "No image generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload to Supabase Storage
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const fileName = `generated-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
    const filePath = `${clientId || user.id}/${fileName}`;

    const imageBuffer = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from("client-files")
      .upload(filePath, imageBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[generate-image-simple] Upload error:", uploadError);
      // Return base64 as fallback
      return new Response(
        JSON.stringify({ imageUrl: `data:${mimeType};base64,${imageBase64}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: urlData } = supabase.storage.from("client-files").getPublicUrl(filePath);
    const imageUrl = urlData.publicUrl;

    console.log("[generate-image-simple] Success:", imageUrl);

    return new Response(
      JSON.stringify({ imageUrl, success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[generate-image-simple] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
