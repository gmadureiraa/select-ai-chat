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
    const { clientFolder, files } = await req.json();
    
    if (!clientFolder || !Array.isArray(files)) {
      throw new Error("clientFolder e files são obrigatórios");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!SUPABASE_URL) {
      throw new Error("SUPABASE_URL não configurada");
    }

    console.log(`Loading knowledge base for client: ${clientFolder}`);
    console.log(`Files requested: ${files.join(", ")}`);

    const contents: Array<{ file: string; content: string } | null> = await Promise.all(
      files.map(async (file: string) => {
        try {
          // Construir URL para arquivo no storage público
          const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/client-files/${clientFolder}/${file}`;
          console.log(`Fetching: ${fileUrl}`);

          const response = await fetch(fileUrl);
          
          if (response.ok) {
            const content = await response.text();
            console.log(`Successfully loaded ${file} (${content.length} chars)`);
            return { file, content };
          } else {
            console.warn(`Failed to load ${file}: ${response.status} ${response.statusText}`);
            return null;
          }
        } catch (error) {
          console.error(`Error loading ${file}:`, error);
          return null;
        }
      })
    );

    const validContents = contents.filter(Boolean);
    
    console.log(`Knowledge base loaded: ${validContents.length}/${files.length} files`);

    return new Response(
      JSON.stringify({ 
        contents: validContents,
        loaded: validContents.length,
        total: files.length
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in extract-knowledge:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
