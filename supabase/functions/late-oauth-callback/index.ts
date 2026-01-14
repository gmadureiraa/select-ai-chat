import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LATE_API_BASE = "https://getlate.dev/api";

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    
    // Get parameters from Late callback
    const connected = url.searchParams.get("connected");
    const profileId = url.searchParams.get("profileId");
    const username = url.searchParams.get("username");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description") || url.searchParams.get("message");
    const attemptId = url.searchParams.get("attemptId");

    console.log("OAuth callback received:", { 
      connected, 
      profileId, 
      username, 
      error,
      attemptId,
      allParams: Object.fromEntries(url.searchParams.entries())
    });

    // Check for OAuth errors
    if (error) {
      console.error("OAuth error:", error, errorDescription);
      return new Response(generateErrorPage(errorDescription || error, null, null), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // If no connection info, show waiting page
    if (!connected && !profileId) {
      return new Response(generateWaitingPage(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LATE_API_KEY = Deno.env.get("LATE_API_KEY");

    if (!LATE_API_KEY) {
      console.error("LATE_API_KEY not configured");
      return new Response(generateErrorPage("Configuração incompleta", null, null), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    let clientId: string | null = null;
    let platform: string | null = null;

    // Strategy 1: Use attemptId to find exact client and platform (new method)
    if (attemptId) {
      const { data: attempt, error: attemptError } = await supabase
        .from("oauth_connection_attempts")
        .select("*")
        .eq("id", attemptId)
        .single();

      if (attemptError) {
        console.error("Failed to find attempt:", attemptError);
      } else if (attempt) {
        // Check if expired
        if (new Date(attempt.expires_at) < new Date()) {
          console.error("Attempt expired:", attemptId);
          return new Response(generateErrorPage("Sessão expirada. Tente conectar novamente.", null, null), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        // Check if already used
        if (attempt.used_at) {
          console.error("Attempt already used:", attemptId);
          return new Response(generateErrorPage("Esta sessão já foi utilizada. Tente conectar novamente.", null, null), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        clientId = attempt.client_id;
        platform = attempt.platform;

        // Mark attempt as used
        await supabase
          .from("oauth_connection_attempts")
          .update({ used_at: new Date().toISOString() })
          .eq("id", attemptId);

        console.log("Found attempt:", { clientId, platform, attemptId });
      }
    }

    // Strategy 2: Fallback - find by profile_id in metadata
    // IMPORTANT: Only match to the client that OWNS this profile
    if (!clientId) {
      const { data: allProfiles, error: mappingError } = await supabase
        .from("client_social_credentials")
        .select("client_id, metadata, account_id")
        .eq("platform", "late_profile"); // Only look at client-specific profiles, not shared

      if (mappingError) {
        console.error("Error finding profile mappings:", mappingError);
      }

      console.log("Looking for profileId:", profileId, "in client profiles:", allProfiles?.length);

      if (allProfiles && allProfiles.length > 0) {
        const matchingProfile = allProfiles.find((p) => {
          const metadata = p.metadata as Record<string, unknown> | null;
          return metadata?.late_profile_id === profileId || p.account_id === profileId;
        });
        
        if (matchingProfile) {
          clientId = matchingProfile.client_id;
          console.log("Found matching client profile:", matchingProfile);
        }
      }
    }

    if (!clientId) {
      console.error("Could not find client for profileId:", profileId);
      return new Response(generateErrorPage("Cliente não encontrado. Tente conectar novamente.", null, null), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Clean the platform name (remove any query string pollution)
    if (!platform) {
      platform = connected?.split('?')[0]?.toLowerCase() || null;
    }

    if (!platform) {
      console.error("No platform detected");
      return new Response(generateErrorPage("Plataforma não detectada", null, clientId), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Fetch accounts from Late API to get the newly connected account
    const accountsResponse = await fetch(`${LATE_API_BASE}/v1/accounts?profileId=${profileId}`, {
      headers: {
        "Authorization": `Bearer ${LATE_API_KEY}`,
      },
    });

    let accountData = null;
    if (accountsResponse.ok) {
      const accountsData = await accountsResponse.json();
      console.log("Accounts from Late API:", accountsData);
      
      // Find the account matching the platform
      const platformAccounts = accountsData.accounts?.filter(
        (acc: { platform: string }) => acc.platform?.toLowerCase() === platform
      ) || [];

      if (platformAccounts.length > 0) {
        // If username provided, try to match it; otherwise use the first/most recent
        if (username) {
          accountData = platformAccounts.find(
            (acc: { username: string }) => acc.username === username
          ) || platformAccounts[0];
        } else {
          // Use the most recently connected account (last in array usually)
          accountData = platformAccounts[platformAccounts.length - 1];
        }
      }
    } else {
      console.error("Failed to fetch accounts:", await accountsResponse.text());
    }

    console.log("Selected account:", accountData);

    // Store credentials in database
    const { error: upsertError } = await supabase
      .from("client_social_credentials")
      .upsert({
        client_id: clientId,
        platform: platform,
        account_id: accountData?._id || username || `${platform}_${Date.now()}`,
        account_name: accountData?.displayName || accountData?.username || username || platform,
        is_valid: true,
        last_validated_at: new Date().toISOString(),
        validation_error: null,
        metadata: {
          provider: "oauth",
          late_account_id: accountData?._id,
          late_profile_id: profileId,
          username: accountData?.username || username,
          display_name: accountData?.displayName,
          profile_picture: accountData?.profilePicture,
          connected_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "client_id,platform",
      });

    if (upsertError) {
      console.error("Database upsert error:", upsertError);
      return new Response(generateErrorPage("Falha ao salvar credenciais", platform, clientId), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    console.log("Successfully saved credentials for:", { clientId, platform, accountId: accountData?._id });

    // Success! Return HTML that closes the popup and notifies parent
    const platformNames: Record<string, string> = {
      twitter: 'Twitter/X',
      linkedin: 'LinkedIn',
      instagram: 'Instagram',
      facebook: 'Facebook',
      threads: 'Threads',
      tiktok: 'TikTok',
      youtube: 'YouTube'
    };

    const displayName = platformNames[platform] || platform;
    const accountName = accountData?.displayName || accountData?.username || username || platform;

    return new Response(generateSuccessPage(displayName, platform, clientId, accountName), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

  } catch (error) {
    console.error("Error in late-oauth-callback:", error);
    return new Response(generateErrorPage("Ocorreu um erro inesperado", null, null), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});

function generateSuccessPage(displayName: string, platform: string, clientId: string, accountName: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <title>Conectado!</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-align: center;
        padding: 50px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card {
        background: white;
        border-radius: 16px;
        padding: 40px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        max-width: 400px;
      }
      .success-icon {
        font-size: 64px;
        margin-bottom: 20px;
      }
      h2 {
        color: #1a1a2e;
        margin-bottom: 10px;
      }
      p {
        color: #666;
        margin-bottom: 20px;
      }
      .account-name {
        font-weight: 600;
        color: #333;
      }
      .close-text {
        font-size: 14px;
        color: #999;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="success-icon">✅</div>
      <h2>${displayName} Conectado!</h2>
      <p>Conta <span class="account-name">${accountName}</span> vinculada com sucesso.</p>
      <p class="close-text">Esta janela fechará automaticamente...</p>
    </div>
    <script>
      if (window.opener) {
        window.opener.postMessage({ 
          type: 'late_oauth_success', 
          platform: '${platform}',
          clientId: '${clientId}',
          accountName: '${accountName}'
        }, '*');
        setTimeout(() => window.close(), 2000);
      } else {
        document.querySelector('.close-text').textContent = 'Você pode fechar esta janela.';
      }
    </script>
  </body>
</html>`;
}

function generateErrorPage(message: string, platform: string | null, clientId: string | null): string {
  // Escape single quotes in message
  const escapedMessage = message.replace(/'/g, "\\'");
  const platformStr = platform ? `'${platform}'` : 'null';
  const clientIdStr = clientId ? `'${clientId}'` : 'null';
  
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <title>Erro na Conexão</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-align: center;
        padding: 50px 20px;
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        min-height: 100vh;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card {
        background: white;
        border-radius: 16px;
        padding: 40px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        max-width: 400px;
      }
      .error-icon {
        font-size: 64px;
        margin-bottom: 20px;
      }
      h2 {
        color: #1a1a2e;
        margin-bottom: 10px;
      }
      p {
        color: #666;
        margin-bottom: 20px;
      }
      .close-text {
        font-size: 14px;
        color: #999;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="error-icon">❌</div>
      <h2>Erro na Conexão</h2>
      <p>${message}</p>
      <p class="close-text">Você pode fechar esta janela e tentar novamente.</p>
    </div>
    <script>
      if (window.opener) {
        window.opener.postMessage({ 
          type: 'late_oauth_error', 
          error: '${escapedMessage}',
          platform: ${platformStr},
          clientId: ${clientIdStr}
        }, '*');
      }
    </script>
  </body>
</html>`;
}

function generateWaitingPage(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <title>Conectando...</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-align: center;
        padding: 50px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card {
        background: white;
        border-radius: 16px;
        padding: 40px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        max-width: 400px;
      }
      .spinner {
        width: 50px;
        height: 50px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      h2 {
        color: #1a1a2e;
        margin-bottom: 10px;
      }
      p {
        color: #666;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="spinner"></div>
      <h2>Conectando...</h2>
      <p>Complete a autorização na janela que abriu.</p>
    </div>
  </body>
</html>`;
}
