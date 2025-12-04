import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials não configuradas");
    }

    // Use service role to access private bucket
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Loading knowledge base for client: ${clientFolder}`);
    console.log(`Files requested: ${files.join(", ")}`);

    const contents: Array<{ file: string; content: string } | null> = await Promise.all(
      files.map(async (file: string) => {
        try {
          const filePath = `${clientFolder}/${file}`;
          
          // Try to download file directly using service role
          const { data, error } = await supabase.storage
            .from("client-files")
            .download(filePath);

          if (error) {
            console.warn(`Failed to download ${file}: ${error.message}`);
            return null;
          }

          const content = await data.text();
          console.log(`Successfully loaded ${file} (${content.length} chars)`);
          return { file, content };
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
