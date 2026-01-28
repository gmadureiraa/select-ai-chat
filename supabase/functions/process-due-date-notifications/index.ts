import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify authorization - only allow service role or cron
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.includes(supabaseServiceRoleKey) && !authHeader?.includes("Bearer")) {
      // For cron jobs, check for specific header
      const cronSecret = req.headers.get("x-cron-secret");
      if (cronSecret !== supabaseServiceRoleKey) {
        console.log("[process-due-date-notifications] Unauthorized access attempt");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log("[process-due-date-notifications] Starting due date notification processing...");

    // Call the database function to create notifications
    const { error } = await supabase.rpc('create_due_date_notifications');

    if (error) {
      console.error("[process-due-date-notifications] Error calling function:", error);
      throw error;
    }

    console.log("[process-due-date-notifications] Due date notifications processed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Due date notifications processed",
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("[process-due-date-notifications] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
