import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateResult {
  total: number;
  updated: number;
  failed: number;
  items: Array<{
    id: string;
    title: string;
    status: "updated" | "failed" | "no_url" | "no_image_found";
    thumbnail_url?: string;
    error?: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { clientId, limit = 50 } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔄 Updating newsletter covers for client ${clientId}`);

    // Fetch newsletters without thumbnail_url
    const { data: newsletters, error: fetchError } = await supabase
      .from("client_content_library")
      .select("id, title, content_url, content")
      .eq("client_id", clientId)
      .eq("content_type", "newsletter")
      .is("thumbnail_url", null)
      .limit(limit);

    if (fetchError) {
      throw fetchError;
    }

    const result: UpdateResult = {
      total: newsletters?.length || 0,
      updated: 0,
      failed: 0,
      items: [],
    };

    console.log(`📦 Found ${result.total} newsletters without covers`);

    for (const newsletter of newsletters || []) {
      try {
        // First, try to extract from Markdown content
        const markdownImageMatch = newsletter.content?.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
        let thumbnailUrl = markdownImageMatch?.[1] || null;

        // If no image in content and we have a URL, scrape og:image
        if (!thumbnailUrl && newsletter.content_url) {
          console.log(`🌐 Scraping og:image from ${newsletter.content_url}`);
          
          try {
            const response = await fetch(newsletter.content_url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; Kaleidos/1.0; +https://kaleidos.app)",
              },
            });

            if (response.ok) {
              const html = await response.text();
              
              // Extract og:image
              const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                                   html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
              
              if (ogImageMatch?.[1]) {
                thumbnailUrl = ogImageMatch[1];
                console.log(`✅ Found og:image: ${thumbnailUrl}`);
              }
            }
          } catch (scrapeError) {
            console.warn(`⚠️ Scrape failed for ${newsletter.content_url}:`, scrapeError);
          }
        }

        if (thumbnailUrl) {
          // Update the newsletter
          const { error: updateError } = await supabase
            .from("client_content_library")
            .update({ 
              thumbnail_url: thumbnailUrl,
              updated_at: new Date().toISOString()
            })
            .eq("id", newsletter.id);

          if (updateError) {
            throw updateError;
          }

          result.updated++;
          result.items.push({
            id: newsletter.id,
            title: newsletter.title,
            status: "updated",
            thumbnail_url: thumbnailUrl,
          });
        } else {
          result.items.push({
            id: newsletter.id,
            title: newsletter.title,
            status: newsletter.content_url ? "no_image_found" : "no_url",
          });
        }
      } catch (itemError) {
        console.error(`❌ Error updating ${newsletter.id}:`, itemError);
        result.failed++;
        result.items.push({
          id: newsletter.id,
          title: newsletter.title,
          status: "failed",
          error: itemError instanceof Error ? itemError.message : "Unknown error",
        });
      }
    }

    console.log(`✅ Update complete: ${result.updated} updated, ${result.failed} failed`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Update covers error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
