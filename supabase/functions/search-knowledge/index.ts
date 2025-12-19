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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error("[search-knowledge] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query, workspaceId, limit = 5 } = await req.json();

    if (!query || !workspaceId) {
      throw new Error("query and workspaceId are required");
    }

    // Verify user belongs to the workspace
    const { data: membership, error: membershipError } = await supabaseAuth
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      console.error("[search-knowledge] Access denied - user not in workspace:", user.id, workspaceId);
      return new Response(
        JSON.stringify({ error: "Access denied - not a workspace member" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[search-knowledge] Searching:", query, "by user:", user.id);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Generate embedding for search query
    const embeddingResponse = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query,
        dimensions: 768
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Embedding request failed: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data?.[0]?.embedding;

    if (!queryEmbedding) {
      throw new Error("Failed to generate query embedding");
    }

    // Use service role for database operations after authorization is verified
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Use the semantic search function
    const { data: semanticResults, error: semanticError } = await supabaseService
      .rpc("search_knowledge_semantic", {
        query_embedding: queryEmbedding,
        workspace_id_filter: workspaceId,
        match_count: limit,
        similarity_threshold: 0.4
      });

    if (semanticError) {
      console.error("[search-knowledge] Semantic search error:", semanticError);
    }

    // Also do text search as fallback
    const { data: textResults, error: textError } = await supabaseService
      .from("global_knowledge")
      .select("id, title, content, summary, category, source_url")
      .eq("workspace_id", workspaceId)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(limit);

    if (textError) {
      console.error("[search-knowledge] Text search error:", textError);
    }

    // Merge and deduplicate results
    const resultMap = new Map();
    
    // Add semantic results first (higher priority)
    (semanticResults || []).forEach((r: any) => {
      resultMap.set(r.id, { ...r, searchType: "semantic" });
    });

    // Add text results that aren't already in semantic
    (textResults || []).forEach((r: any) => {
      if (!resultMap.has(r.id)) {
        resultMap.set(r.id, { ...r, similarity: null, searchType: "text" });
      }
    });

    const results = Array.from(resultMap.values());

    console.log(`[search-knowledge] Found ${results.length} results`);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      semanticCount: semanticResults?.length || 0,
      textCount: textResults?.length || 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[search-knowledge] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
