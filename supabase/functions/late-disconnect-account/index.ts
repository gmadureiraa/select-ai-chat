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
    const lateApiKey = Deno.env.get("LATE_API_KEY");

    if (!lateApiKey) {
      return new Response(JSON.stringify({ error: "LATE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { clientId, platform } = await req.json();

    if (!clientId || !platform) {
      return new Response(JSON.stringify({ error: "clientId e platform são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Disconnecting platform:", platform, "for client:", clientId);

    // Get the credential to find the Late account ID
    const { data: credential, error: fetchError } = await supabase
      .from("client_social_credentials")
      .select("id, metadata")
      .eq("client_id", clientId)
      .eq("platform", platform)
      .single();

    if (fetchError || !credential) {
      console.log("No credential found for platform:", platform);
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Nenhuma credencial encontrada" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = credential.metadata as Record<string, unknown> | null;
    const lateAccountId = metadata?.late_account_id as string | undefined;
    const lateProfileId = metadata?.late_profile_id as string | undefined;

    // Try to delete from Late API if we have an account ID
    if (lateAccountId) {
      try {
        console.log("Deleting Late account:", lateAccountId);
        
        const response = await fetch(`https://api.getlate.dev/social-accounts/${lateAccountId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${lateApiKey}`,
            "Content-Type": "application/json",
          },
        });

        console.log("Late API delete response:", response.status);

        if (!response.ok && response.status !== 404) {
          const errorText = await response.text();
          console.error("Error deleting from Late API:", errorText);
          // Don't fail - still delete from our database
        }
      } catch (error) {
        console.error("Error calling Late API:", error);
        // Don't fail - still delete from our database
      }
    } else if (lateProfileId) {
      // Try to disconnect using profile ID
      try {
        console.log("Disconnecting Late profile:", lateProfileId);
        
        const response = await fetch(`https://api.getlate.dev/profiles/${lateProfileId}/disconnect`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lateApiKey}`,
            "Content-Type": "application/json",
          },
        });

        console.log("Late API disconnect response:", response.status);

        if (!response.ok && response.status !== 404) {
          const errorText = await response.text();
          console.error("Error disconnecting from Late API:", errorText);
        }
      } catch (error) {
        console.error("Error calling Late API:", error);
      }
    }

    // Delete from our database
    const { error: deleteError } = await supabase
      .from("client_social_credentials")
      .delete()
      .eq("id", credential.id);

    if (deleteError) {
      console.error("Error deleting credential:", deleteError);
      throw deleteError;
    }

    console.log("Successfully disconnected platform:", platform);

    return new Response(JSON.stringify({ 
      success: true,
      platform,
      deletedFromLate: !!(lateAccountId || lateProfileId),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in late-disconnect-account:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro desconhecido" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
