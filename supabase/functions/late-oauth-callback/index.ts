import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LATE_API_BASE = "https://getlate.dev/api";

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    
    // Late API returns these params after OAuth completes
    const connected = url.searchParams.get("connected"); // The platform that was connected
    const profileId = url.searchParams.get("profileId");
    const username = url.searchParams.get("username");
    
    // Error params
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description") || url.searchParams.get("message");

    console.log("OAuth callback received:", { 
      connected, 
      profileId, 
      username, 
      error,
      allParams: Object.fromEntries(url.searchParams.entries())
    });

    // Check for OAuth errors
    if (error) {
      console.error("OAuth error:", error, errorDescription);
      return new Response(generateErrorPage(errorDescription || error), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // If no connection info, show waiting page
    if (!connected && !profileId) {
      return new Response(generateWaitingPage(), {
        headers: { "Content-Type": "text/html" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LATE_API_KEY = Deno.env.get("LATE_API_KEY");

    if (!LATE_API_KEY) {
      console.error("LATE_API_KEY not configured");
      return new Response(generateErrorPage("Configuração incompleta"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Find the client_id associated with this profile
    // We stored the mapping when starting OAuth
    const { data: profileMapping, error: mappingError } = await supabase
      .from("client_social_credentials")
      .select("client_id, metadata")
      .eq("platform", "late_profile")
      .filter("metadata->>late_profile_id", "eq", profileId)
      .maybeSingle();

    if (mappingError) {
      console.error("Error finding profile mapping:", mappingError);
    }

    let clientId = profileMapping?.client_id;

    // Fallback: if no direct mapping found, try to find any client with this profile
    if (!clientId && profileId) {
      const { data: anyCredential } = await supabase
        .from("client_social_credentials")
        .select("client_id")
        .filter("metadata->>late_profile_id", "eq", profileId)
        .limit(1)
        .maybeSingle();
      
      clientId = anyCredential?.client_id;
    }

    if (!clientId) {
      console.error("Could not find client for profileId:", profileId);
      return new Response(generateErrorPage("Cliente não encontrado"), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Clean the platform name (remove any query string pollution)
    const platform = connected?.split('?')[0]?.toLowerCase();

    if (!platform) {
      console.error("No platform detected");
      return new Response(generateErrorPage("Plataforma não detectada"), {
        headers: { "Content-Type": "text/html" },
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
      return new Response(generateErrorPage("Falha ao salvar credenciais"), {
        headers: { "Content-Type": "text/html" },
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

    return new Response(generateSuccessPage(displayName, platform, clientId), {
      headers: { "Content-Type": "text/html" },
    });

  } catch (error) {
    console.error("Error in late-oauth-callback:", error);
    return new Response(generateErrorPage("Ocorreu um erro inesperado"), {
      headers: { "Content-Type": "text/html" },
    });
  }
});

function generateSuccessPage(displayName: string, platform: string, clientId: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Conectado!</title>
        <meta charset="UTF-8">
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
          <p>Sua conta foi vinculada com sucesso.</p>
          <p class="close-text">Esta janela fechará automaticamente...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'late_oauth_success', 
              platform: '${platform}',
              clientId: '${clientId}'
            }, '*');
            setTimeout(() => window.close(), 2000);
          } else {
            document.querySelector('.close-text').textContent = 'Você pode fechar esta janela.';
          }
        </script>
      </body>
    </html>
  `;
}

function generateErrorPage(message: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Erro na Conexão</title>
        <meta charset="UTF-8">
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
              error: '${message}'
            }, '*');
          }
        </script>
      </body>
    </html>
  `;
}

function generateWaitingPage(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Conectando...</title>
        <meta charset="UTF-8">
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
    </html>
  `;
}
