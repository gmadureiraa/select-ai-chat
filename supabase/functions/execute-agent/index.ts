import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage, estimateTokens } from "../_shared/ai-usage.ts";
import { checkWorkspaceTokens, debitWorkspaceTokens, getWorkspaceIdFromUser, createInsufficientTokensResponse } from "../_shared/tokens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleApiKey = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");

    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: "Google AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user client for auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { agentType, prompt, clientId } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get workspace ID and check tokens
    const workspaceId = await getWorkspaceIdFromUser(user.id);
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: "Workspace not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Estimate tokens needed (rough estimate)
    const estimatedInputTokens = estimateTokens(prompt);
    const estimatedCost = Math.ceil(estimatedInputTokens * 0.5); // Buffer for output

    const tokenCheck = await checkWorkspaceTokens(workspaceId, estimatedCost);
    if (!tokenCheck.hasTokens && !tokenCheck.isUnlimited) {
      return createInsufficientTokensResponse(corsHeaders);
    }

    // Call Google Generative AI API
    const model = "gemini-2.0-flash";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleApiKey}`;

    console.log(`[execute-agent] Calling ${model} for agent: ${agentType || 'generic'}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[execute-agent] Google AI API error:`, errorText);
      return new Response(
        JSON.stringify({ error: "AI generation failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Calculate actual token usage
    const inputTokens = result.usageMetadata?.promptTokenCount || estimatedInputTokens;
    const outputTokens = result.usageMetadata?.candidatesTokenCount || estimateTokens(content);
    const totalTokens = inputTokens + outputTokens;

    // Log AI usage
    await logAIUsage(
      supabaseAdmin,
      user.id,
      model,
      "execute-agent",
      inputTokens,
      outputTokens,
      { agentType, clientId }
    );

    // Debit tokens if not unlimited
    if (!tokenCheck.isUnlimited) {
      await debitWorkspaceTokens(
        workspaceId,
        user.id,
        totalTokens,
        `execute-agent: ${agentType || 'generic'}`,
        { agentType, clientId, model }
      );
    }

    console.log(`[execute-agent] Success - ${totalTokens} tokens used`);

    return new Response(
      JSON.stringify({ content }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[execute-agent] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
