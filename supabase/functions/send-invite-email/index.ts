import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Resend client implementation
class ResendClient {
  private apiKey: string;
  
  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey || "";
  }
  
  async sendEmail(params: { from: string; to: string[]; subject: string; html: string }) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }
    
    return response.json();
  }
}

const Resend = ResendClient;

// Validate API key at startup and create client
const resendApiKey = Deno.env.get("RESEND_API_KEY");
if (!resendApiKey) {
  console.error("RESEND_API_KEY not configured");
}
const resend = new Resend(resendApiKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  email: string;
  workspaceName: string;
  workspaceSlug?: string;
  inviterName: string;
  role: string;
  expiresAt: string;
  clientNames?: string[];
}

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
  viewer: "Visualizador",
};

// Format expiration date
function formatExpirationDate(expiresAt: string): string {
  const date = new Date(expiresAt);
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 
                  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if Resend API key is configured
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, workspaceName, workspaceSlug, inviterName, role, expiresAt, clientNames }: InviteEmailRequest = await req.json();

    const roleLabel = roleLabels[role] || role;
    
    // Get base URL dynamically from request headers
    const origin = req.headers.get("origin") || req.headers.get("referer");
    let baseUrl = "https://kai-kaleidos.lovable.app"; // fallback
    
    if (origin) {
      try {
        const url = new URL(origin);
        baseUrl = url.origin;
      } catch {
        // Keep fallback if parsing fails
      }
    }
    
    // Generate invite URL pointing to workspace login
    const inviteUrl = workspaceSlug 
      ? `${baseUrl}/${workspaceSlug}/login?invite=1` 
      : `${baseUrl}/login`;
    
    const createAccountUrl = workspaceSlug
      ? `${baseUrl}/${workspaceSlug}/join`
      : `${baseUrl}/register`;
    
    // Format client access info
    let clientAccessHtml = "";
    if (clientNames && clientNames.length > 0) {
      clientAccessHtml = `
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Acesso aos clientes:</p>
          <ul style="margin: 0; padding-left: 20px; color: #6b7280;">
            ${clientNames.map(name => `<li>${name}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    const formattedExpiration = formatExpirationDate(expiresAt);
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if !mso]><!-->
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--<![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <!-- Preheader text (appears in email preview) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${inviterName} te convidou para o workspace "${workspaceName}" como ${roleLabel}. Entre para acessar!
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 32px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">kAI</h1>
        <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Assistente de Marketing com IA</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 32px;">
        <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 600;">
          Você foi convidado! 🎉
        </h2>
        
        <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
          Olá! <strong>${inviterName}</strong> convidou você para fazer parte do workspace <strong>"${workspaceName}"</strong> como <strong>${roleLabel}</strong>.
        </p>

        ${clientAccessHtml}
        
        <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
          Clique no botão abaixo para acessar:
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td style="border-radius: 8px; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);">
                <a href="${inviteUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                  ✨ Acessar Workspace
                </a>
              </td>
            </tr>
          </table>
        </div>
        
        <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 13px; text-align: center;">
          Não tem conta? <a href="${createAccountUrl}" style="color: #7c3aed; text-decoration: underline; font-weight: 500;">Crie uma gratuitamente</a>
        </p>
        
        <div style="margin-top: 24px; padding: 12px; background-color: #fef3c7; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #92400e; font-size: 12px;">
            ⏰ Este convite expira em <strong>${formattedExpiration}</strong>
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          Se você não esperava este convite, pode ignorar este email com segurança.
        </p>
        <p style="margin: 8px 0 0 0; color: #d1d5db; font-size: 11px;">
          kAI - Assistente de Marketing com IA | Kaleidos
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.sendEmail({
      from: "kAI <noreply@news.kaleidos.com.br>",
      to: [email],
      subject: `🎉 ${inviterName} te convidou para ${workspaceName}`,
      html: emailHtml,
    });

    console.log("Invite email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, ...emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending invite email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
