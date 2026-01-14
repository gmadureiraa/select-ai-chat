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
    let attemptId = url.searchParams.get("attemptId");

    // Late API sometimes embeds errors in the attemptId as query params
    // e.g., attemptId = "abc123?error=account_limit_exceeded"
    let embeddedError: string | null = null;
    if (attemptId?.includes('?')) {
      const [cleanAttemptId, queryPart] = attemptId.split('?');
      attemptId = cleanAttemptId;
      const embeddedParams = new URLSearchParams(queryPart);
      embeddedError = embeddedParams.get('error');
      console.log("Parsed embedded error from attemptId:", { cleanAttemptId, embeddedError });
    }

    // Combine all error sources
    const finalError = error || embeddedError;

    console.log("OAuth callback received:", { 
      connected, 
      profileId, 
      username, 
      error,
      embeddedError,
      finalError,
      attemptId,
      allParams: Object.fromEntries(url.searchParams.entries())
    });

    // User-friendly error messages
    const getErrorMessage = (errorCode: string): string => {
      const errorMessages: Record<string, string> = {
        'account_limit_exceeded': 'Limite de contas atingido no Late API. Para conectar mais redes sociais, considere fazer upgrade do seu plano Late.',
        'access_denied': 'Acesso negado. Você cancelou a autorização ou não concedeu as permissões necessárias.',
        'invalid_request': 'Requisição inválida. Por favor, tente conectar novamente.',
        'unauthorized': 'Não autorizado. Verifique suas credenciais e tente novamente.',
        'rate_limit': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
        'server_error': 'Erro no servidor. Por favor, tente novamente mais tarde.',
      };
      return errorMessages[errorCode] || errorCode;
    };

    // Check for OAuth errors BEFORE anything else
    if (finalError) {
      const errorMessage = getErrorMessage(finalError);
      console.error("OAuth error detected:", { finalError, errorMessage, errorDescription });
      return new Response(generateErrorPage(errorDescription || errorMessage, null, null), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // If no connection info, show waiting page with timeout
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
    
    // Build account name, filtering out undefined values
    let accountName = '';
    if (accountData?.displayName && !accountData.displayName.includes('undefined')) {
      accountName = accountData.displayName;
    } else if (accountData?.username) {
      accountName = `@${accountData.username}`;
    } else if (username) {
      accountName = `@${username}`;
    } else {
      accountName = displayName;
    }

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
  // Escape for safe HTML rendering
  const safeAccountName = accountName.replace(/[<>&"']/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
  }[c] || c));
  const safeDisplayName = displayName.replace(/[<>&"']/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
  }[c] || c));

  // Platform icons with proper fallback
  const platformIcons: Record<string, string> = {
    twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.757-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    threads: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.33-3.022.812-.675 1.89-1.082 3.088-1.17.944-.07 1.873.018 2.77.256.027-.558.01-1.098-.05-1.616-.145-1.22-.58-2.134-1.282-2.705-.717-.584-1.725-.876-2.992-.869h-.045c-1.104.007-2.003.312-2.672.908-.652.582-1.063 1.39-1.22 2.405l-2.014-.306c.218-1.46.846-2.654 1.866-3.545 1.053-.918 2.396-1.395 3.993-1.416h.066c1.705.012 3.116.46 4.193 1.336 1.143.93 1.822 2.254 2.016 3.935.072.632.09 1.292.052 1.973 1.047.514 1.88 1.2 2.47 2.044.814 1.163 1.097 2.583.79 3.988-.367 1.68-1.377 3.14-2.838 4.107C18.242 23.436 15.905 24 12.186 24zm.062-10.551c-1.762-.003-3.092.752-3.159 2.056-.034.634.182 1.128.64 1.466.524.39 1.322.556 2.146.511 1.091-.059 1.925-.452 2.479-1.168.486-.629.779-1.523.873-2.662-.947-.154-1.943-.21-2.979-.203z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>'
  };

  const platformColors: Record<string, string> = {
    twitter: '#000000',
    linkedin: '#0A66C2',
    instagram: '#E4405F',
    facebook: '#1877F2',
    threads: '#000000',
    tiktok: '#000000',
    youtube: '#FF0000'
  };

  const iconSvg = platformIcons[platform] || '';
  const iconColor = platformColors[platform] || '#667eea';

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <title>Conectado!</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        padding: 20px;
      }
      .card {
        background: rgba(255, 255, 255, 0.95);
        border-radius: 20px;
        padding: 48px 40px;
        box-shadow: 0 25px 80px rgba(0,0,0,0.4);
        max-width: 380px;
        width: 100%;
        text-align: center;
        animation: slideUp 0.4s ease-out;
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .icon-wrapper {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: ${iconColor};
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 24px;
        box-shadow: 0 8px 24px ${iconColor}40;
      }
      .icon-wrapper svg {
        width: 40px;
        height: 40px;
        color: white;
        fill: white;
      }
      .success-badge {
        position: absolute;
        bottom: -4px;
        right: -4px;
        width: 28px;
        height: 28px;
        background: #10B981;
        border-radius: 50%;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .success-badge svg {
        width: 14px;
        height: 14px;
        color: white;
      }
      .icon-container {
        position: relative;
        display: inline-block;
        margin-bottom: 24px;
      }
      h2 {
        color: #1a1a2e;
        margin: 0 0 8px;
        font-size: 24px;
        font-weight: 700;
      }
      .account-name {
        font-size: 16px;
        color: #64748b;
        margin: 0 0 24px;
      }
      .account-name strong {
        color: #334155;
        font-weight: 600;
      }
      .divider {
        height: 1px;
        background: #e2e8f0;
        margin: 24px 0;
      }
      .close-text {
        font-size: 14px;
        color: #94a3b8;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .spinner-small {
        width: 16px;
        height: 16px;
        border: 2px solid #e2e8f0;
        border-top: 2px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon-container">
        <div class="icon-wrapper">
          ${iconSvg}
        </div>
        <div class="success-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>
      <h2>${safeDisplayName} conectado!</h2>
      <p class="account-name">Conta <strong>${safeAccountName}</strong> vinculada com sucesso</p>
      <div class="divider"></div>
      <p class="close-text">
        <span class="spinner-small"></span>
        Fechando automaticamente...
      </p>
    </div>
    <script>
      if (window.opener) {
        window.opener.postMessage({ 
          type: 'late_oauth_success', 
          platform: '${platform}',
          clientId: '${clientId}',
          accountName: '${safeAccountName}'
        }, '*');
        setTimeout(function() { window.close(); }, 2500);
      } else {
        document.querySelector('.close-text').innerHTML = 'Pode fechar esta janela';
        document.querySelector('.spinner-small').style.display = 'none';
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
      .timeout-message {
        display: none;
        color: #e74c3c;
        margin-top: 15px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="spinner" id="spinner"></div>
      <h2 id="title">Conectando...</h2>
      <p id="message">Complete a autorização na janela que abriu.</p>
      <p class="timeout-message" id="timeout-msg">Se a conexão demorar muito, feche esta janela e tente novamente.</p>
    </div>
    <script>
      // Show timeout message after 60 seconds
      setTimeout(() => {
        document.getElementById('timeout-msg').style.display = 'block';
      }, 60000);
      
      // Update message after 2 minutes
      setTimeout(() => {
        document.getElementById('spinner').style.display = 'none';
        document.getElementById('title').textContent = 'Tempo limite atingido';
        document.getElementById('message').textContent = 'A conexão demorou mais que o esperado. Feche esta janela e tente novamente.';
        document.getElementById('timeout-msg').style.display = 'none';
      }, 120000);
    </script>
  </body>
</html>`;
}
