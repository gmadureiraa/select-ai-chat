import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyResult {
  platform: string;
  status: 'valid' | 'invalid' | 'deleted' | 'error';
  message?: string;
}

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

    const { clientId } = await req.json();

    if (!clientId) {
      return new Response(JSON.stringify({ error: "clientId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Verifying accounts for client:", clientId);

    // Get all credentials for this client that have Late account IDs
    const { data: credentials, error: fetchError } = await supabase
      .from("client_social_credentials")
      .select("id, platform, metadata, account_name, is_valid")
      .eq("client_id", clientId);

    if (fetchError) {
      console.error("Error fetching credentials:", fetchError);
      throw fetchError;
    }

    console.log("Found credentials:", credentials?.length || 0);

    const results: VerifyResult[] = [];

    for (const credential of credentials || []) {
      const metadata = credential.metadata as Record<string, unknown> | null;
      const lateAccountId = metadata?.late_account_id as string | undefined;
      const lateProfileId = metadata?.late_profile_id as string | undefined;

      // If no Late IDs, skip this credential
      if (!lateAccountId && !lateProfileId) {
        console.log(`Credential ${credential.id} (${credential.platform}) has no Late IDs, skipping`);
        continue;
      }

      try {
        // Check if account exists in Late API
        const accountIdToCheck = lateAccountId || lateProfileId;
        const endpoint = lateAccountId 
          ? `https://api.getlate.dev/social-accounts/${lateAccountId}`
          : `https://api.getlate.dev/profiles/${lateProfileId}`;

        console.log(`Checking ${credential.platform} account at ${endpoint}`);

        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${lateApiKey}`,
            "Content-Type": "application/json",
          },
        });

        console.log(`Late API response for ${credential.platform}: ${response.status}`);

        if (response.status === 404) {
          // Account no longer exists in Late - delete from our database
          console.log(`Account ${accountIdToCheck} not found in Late, deleting credential ${credential.id}`);
          
          const { error: deleteError } = await supabase
            .from("client_social_credentials")
            .delete()
            .eq("id", credential.id);

          if (deleteError) {
            console.error("Error deleting credential:", deleteError);
            results.push({
              platform: credential.platform,
              status: 'error',
              message: `Erro ao deletar: ${deleteError.message}`,
            });
          } else {
            results.push({
              platform: credential.platform,
              status: 'deleted',
              message: 'Conta removida (não existe mais no Late)',
            });
          }
        } else if (response.ok) {
          const accountData = await response.json();
          
          // Update is_valid status based on Late API response
          const isConnected = accountData.status === 'connected' || accountData.connected === true;
          
          if (credential.is_valid !== isConnected) {
            const { error: updateError } = await supabase
              .from("client_social_credentials")
              .update({ 
                is_valid: isConnected,
                last_validated_at: new Date().toISOString(),
                validation_error: isConnected ? null : 'Conta desconectada no Late API',
              })
              .eq("id", credential.id);

            if (updateError) {
              console.error("Error updating credential:", updateError);
            }
          }

          results.push({
            platform: credential.platform,
            status: isConnected ? 'valid' : 'invalid',
            message: isConnected ? 'Conta válida' : 'Conta desconectada',
          });
        } else {
          // Other error - log but don't delete
          const errorText = await response.text();
          console.error(`Late API error for ${credential.platform}:`, errorText);
          
          results.push({
            platform: credential.platform,
            status: 'error',
            message: `Erro ao verificar: ${response.status}`,
          });
        }
      } catch (error) {
        console.error(`Error checking ${credential.platform}:`, error);
        results.push({
          platform: credential.platform,
          status: 'error',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    console.log("Verification results:", results);

    return new Response(JSON.stringify({ 
      success: true,
      clientId,
      results,
      deletedCount: results.filter(r => r.status === 'deleted').length,
      invalidCount: results.filter(r => r.status === 'invalid').length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in late-verify-accounts:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro desconhecido" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
