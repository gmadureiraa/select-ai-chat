import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LATE_API_BASE = "https://getlate.dev/api/v1";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LATE_API_KEY = Deno.env.get("LATE_API_KEY");
    if (!LATE_API_KEY) throw new Error("LATE_API_KEY not configured");

    const { profileId, newName } = await req.json();

    // Rename in Late API
    const response = await fetch(`${LATE_API_BASE}/profiles/${profileId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${LATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    });

    const data = await response.json();
    console.log("Late API rename response:", response.status, JSON.stringify(data));

    if (!response.ok) {
      throw new Error(`Late API error: ${response.status} - ${JSON.stringify(data)}`);
    }

    // Update database
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabaseAdmin
      .from('client_social_credentials')
      .update({ account_name: newName })
      .eq('account_id', profileId)
      .eq('platform', 'late_profile');

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
