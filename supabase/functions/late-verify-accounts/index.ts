import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LATE_API_BASE = "https://getlate.dev/api/v1";

interface VerifyResult {
  platform: string;
  status: 'valid' | 'invalid' | 'deleted' | 'error';
  message?: string;
}

interface LateAccount {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  status?: string;
  connected?: boolean;
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
    // Exclude 'late_profile' as it's not a real social account - just stores the profile ID
    const { data: credentials, error: fetchError } = await supabase
      .from("client_social_credentials")
      .select("id, platform, metadata, account_name, is_valid")
      .eq("client_id", clientId)
      .neq("platform", "late_profile");

    if (fetchError) {
      console.error("Error fetching credentials:", fetchError);
      throw fetchError;
    }

    console.log("Found credentials:", credentials?.length || 0);

    // Group credentials by profile ID to minimize API calls
    const profileAccounts: Map<string, typeof credentials> = new Map();
    
    for (const credential of credentials || []) {
      const metadata = credential.metadata as Record<string, unknown> | null;
      const lateProfileId = metadata?.late_profile_id as string | undefined;
      
      if (lateProfileId) {
        if (!profileAccounts.has(lateProfileId)) {
          profileAccounts.set(lateProfileId, []);
        }
        profileAccounts.get(lateProfileId)!.push(credential);
      }
    }

    const results: VerifyResult[] = [];

    // For each profile, fetch all accounts and verify
    for (const [profileId, profileCredentials] of profileAccounts) {
      try {
        console.log(`Fetching accounts for profile: ${profileId}`);
        
        // Use GET /v1/accounts?profileId= instead of /accounts/{accountId}
        const response = await fetch(`${LATE_API_BASE}/accounts?profileId=${profileId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${lateApiKey}`,
            "Content-Type": "application/json",
          },
        });

        console.log(`Late API response for profile ${profileId}: ${response.status}`);

        if (response.status === 404) {
          // Profile no longer exists - delete all credentials for this profile
          console.log(`Profile ${profileId} not found, deleting all associated credentials`);
          
          for (const credential of profileCredentials) {
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
                message: 'Conta removida (perfil não existe mais no Late)',
              });
            }
          }
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Late API error for profile ${profileId}:`, response.status, errorText);
          
          for (const credential of profileCredentials) {
            results.push({
              platform: credential.platform,
              status: 'error',
              message: `Erro ao verificar: ${response.status}`,
            });
          }
          continue;
        }

        const accountsData = await response.json();
        const lateAccounts: LateAccount[] = accountsData.accounts || [];

        console.log(`Found ${lateAccounts.length} accounts in Late API for profile ${profileId}`);

        // Check each credential against the fetched accounts
        for (const credential of profileCredentials) {
          const metadata = credential.metadata as Record<string, unknown> | null;
          const lateAccountId = metadata?.late_account_id as string | undefined;

          if (!lateAccountId) {
            console.log(`Credential ${credential.id} (${credential.platform}) has no late_account_id, skipping`);
            continue;
          }

          // Find the matching account in Late API response
          const matchingAccount = lateAccounts.find(acc => acc._id === lateAccountId);

          if (!matchingAccount) {
            // Account no longer exists in Late - delete from our database
            console.log(`Account ${lateAccountId} not found in Late accounts, deleting credential ${credential.id}`);
            
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
          } else {
            // Account exists - check if connected
            const isConnected = matchingAccount.status === 'connected' || matchingAccount.connected === true;
            
            if (credential.is_valid !== isConnected) {
              const { error: updateError } = await supabase
                .from("client_social_credentials")
                .update({ 
                  is_valid: isConnected,
                  last_validated_at: new Date().toISOString(),
                  validation_error: isConnected ? null : 'Conta desconectada no Late API',
                  account_name: matchingAccount.displayName || matchingAccount.username || credential.account_name,
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
          }
        }
      } catch (error) {
        console.error(`Error checking profile ${profileId}:`, error);
        for (const credential of profileCredentials) {
          results.push({
            platform: credential.platform,
            status: 'error',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
          });
        }
      }
    }

    // Handle credentials without profile IDs (legacy or error cases)
    for (const credential of credentials || []) {
      const metadata = credential.metadata as Record<string, unknown> | null;
      const lateProfileId = metadata?.late_profile_id as string | undefined;
      
      if (!lateProfileId) {
        const lateAccountId = metadata?.late_account_id as string | undefined;
        if (!lateAccountId) {
          console.log(`Credential ${credential.id} (${credential.platform}) has no Late IDs, skipping`);
        } else {
          // This shouldn't happen normally, but mark as needing re-connection
          results.push({
            platform: credential.platform,
            status: 'error',
            message: 'Credencial incompleta - reconecte a conta',
          });
        }
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
