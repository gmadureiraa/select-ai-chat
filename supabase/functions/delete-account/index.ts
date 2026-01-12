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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client with user token to get user info
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { confirmEmail } = await req.json();
    
    // Verify email matches
    if (confirmEmail !== user.email) {
      return new Response(
        JSON.stringify({ error: "Email de confirmação não corresponde" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for deletion operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const userId = user.id;

    console.log(`[DELETE-ACCOUNT] Starting deletion for user: ${userId}`);

    // 1. Check and cancel Stripe subscription if exists
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeSecretKey) {
      try {
        // Find customer by email
        const customerSearchRes = await fetch(
          `https://api.stripe.com/v1/customers/search?query=email:'${encodeURIComponent(user.email!)}'`,
          {
            headers: {
              Authorization: `Bearer ${stripeSecretKey}`,
            },
          }
        );
        const customerData = await customerSearchRes.json();
        
        if (customerData.data && customerData.data.length > 0) {
          const customerId = customerData.data[0].id;
          
          // Get active subscriptions
          const subsRes = await fetch(
            `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active`,
            {
              headers: {
                Authorization: `Bearer ${stripeSecretKey}`,
              },
            }
          );
          const subsData = await subsRes.json();
          
          // Cancel all active subscriptions
          for (const sub of subsData.data || []) {
            await fetch(`https://api.stripe.com/v1/subscriptions/${sub.id}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${stripeSecretKey}`,
              },
            });
            console.log(`[DELETE-ACCOUNT] Cancelled subscription: ${sub.id}`);
          }
        }
      } catch (stripeError) {
        console.error("[DELETE-ACCOUNT] Stripe error:", stripeError);
        // Continue with deletion even if Stripe fails
      }
    }

    // 2. Delete user data from tables (in order to respect foreign keys)
    const deletionOrder = [
      // Messages and conversations
      { table: "messages", column: null, via: "conversations" },
      { table: "conversations", column: null, via: "clients" },
      
      // Client-related data
      { table: "client_preferences", column: null, via: "clients" },
      { table: "client_documents", column: null, via: "clients" },
      { table: "client_websites", column: null, via: "clients" },
      { table: "client_content_library", column: null, via: "clients" },
      { table: "client_reference_library", column: null, via: "clients" },
      { table: "client_visual_references", column: null, via: "clients" },
      { table: "client_social_credentials", column: null, via: "clients" },
      { table: "client_templates", column: null, via: "clients" },
      { table: "instagram_tokens", column: null, via: "clients" },
      { table: "instagram_posts", column: null, via: "clients" },
      { table: "instagram_stories", column: null, via: "clients" },
      { table: "performance_goals", column: null, via: "clients" },
      { table: "performance_reports", column: null, via: "clients" },
      { table: "image_generations", column: null, via: "clients" },
      { table: "favorite_messages", column: "user_id" },
      
      // User direct tables
      { table: "notifications", column: "user_id" },
      { table: "ai_usage_logs", column: "user_id" },
      
      // Workspace membership
      { table: "workspace_members", column: "user_id" },
      
      // Profile (last)
      { table: "profiles", column: "id" },
    ];

    // Get user's clients first
    const { data: userClients } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("user_id", userId);
    
    const clientIds = userClients?.map(c => c.id) || [];

    // Delete client-related data
    if (clientIds.length > 0) {
      for (const item of deletionOrder.filter(d => d.via === "clients")) {
        try {
          await supabaseAdmin
            .from(item.table)
            .delete()
            .in("client_id", clientIds);
          console.log(`[DELETE-ACCOUNT] Deleted from ${item.table}`);
        } catch (e) {
          console.error(`[DELETE-ACCOUNT] Error deleting from ${item.table}:`, e);
        }
      }

      // Delete clients
      await supabaseAdmin
        .from("clients")
        .delete()
        .eq("user_id", userId);
      console.log("[DELETE-ACCOUNT] Deleted clients");
    }

    // Delete user direct tables
    for (const item of deletionOrder.filter(d => d.column && d.column !== null)) {
      try {
        await supabaseAdmin
          .from(item.table)
          .delete()
          .eq(item.column!, userId);
        console.log(`[DELETE-ACCOUNT] Deleted from ${item.table}`);
      } catch (e) {
        console.error(`[DELETE-ACCOUNT] Error deleting from ${item.table}:`, e);
      }
    }

    // 3. Delete auth user
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error("[DELETE-ACCOUNT] Error deleting auth user:", deleteAuthError);
      return new Response(
        JSON.stringify({ error: "Erro ao excluir conta de autenticação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[DELETE-ACCOUNT] Successfully deleted user: ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Conta excluída com sucesso" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[DELETE-ACCOUNT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});