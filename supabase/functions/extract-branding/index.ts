import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  checkWorkspaceTokens, 
  debitWorkspaceTokens, 
  getWorkspaceIdFromUser,
  createInsufficientTokensResponse,
  TOKEN_COSTS 
} from "../_shared/tokens.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url, workspaceId: providedWorkspaceId } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get workspace ID and check tokens
    const workspaceId = providedWorkspaceId || await getWorkspaceIdFromUser(user.id);
    if (!workspaceId) {
      console.error("[extract-branding] Could not determine workspace");
      return new Response(
        JSON.stringify({ success: false, error: 'Workspace not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenCost = TOKEN_COSTS.branding_extraction;
    const tokenCheck = await checkWorkspaceTokens(workspaceId, tokenCost);
    
    if (!tokenCheck.hasTokens) {
      console.warn(`[extract-branding] Insufficient tokens for workspace ${workspaceId}`);
      return createInsufficientTokensResponse(corsHeaders);
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('[extract-branding] Extracting branding from:', formattedUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['branding'],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract branding data from response
    const branding = data.data?.branding || data.branding || {};
    
    console.log('[extract-branding] Branding extracted:', JSON.stringify(branding, null, 2));

    // Map Firecrawl branding response to our BrandAssets structure
    const brandAssets = {
      logos: {
        primary: branding.logo || branding.images?.logo || null,
        favicon: branding.favicon || branding.images?.favicon || null,
        ogImage: branding.ogImage || branding.images?.ogImage || null,
      },
      colors: {
        primary: branding.colors?.primary || null,
        secondary: branding.colors?.secondary || null,
        accent: branding.colors?.accent || null,
        background: branding.colors?.background || null,
        textPrimary: branding.colors?.textPrimary || null,
        textSecondary: branding.colors?.textSecondary || null,
      },
      typography: {
        fonts: branding.fonts?.map((f: { family: string }) => f.family) || [],
        primary: branding.typography?.fontFamilies?.primary || branding.typography?.fontFamilies?.heading || null,
        secondary: branding.typography?.fontFamilies?.code || null,
      },
      buttons: branding.components?.buttonPrimary ? {
        primaryBg: branding.components.buttonPrimary.background || null,
        primaryText: branding.components.buttonPrimary.textColor || null,
        secondaryBg: branding.components?.buttonSecondary?.background || null,
        secondaryText: branding.components?.buttonSecondary?.textColor || null,
        borderRadius: branding.components.buttonPrimary.borderRadius || branding.spacing?.borderRadius || null,
      } : null,
      colorScheme: branding.colorScheme || 'light',
      importedFrom: formattedUrl,
      importedAt: new Date().toISOString(),
    };

    // Debit tokens after successful extraction
    const debitResult = await debitWorkspaceTokens(
      workspaceId,
      user.id,
      tokenCost,
      "Extração de branding",
      { url: formattedUrl }
    );
    
    if (!debitResult.success) {
      console.warn(`[extract-branding] Token debit failed: ${debitResult.error}`);
    }

    console.log('[extract-branding] Mapped brand assets:', JSON.stringify(brandAssets, null, 2));
    console.log(`[extract-branding] Complete - ${tokenCost} tokens debited`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: brandAssets,
        raw: branding 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[extract-branding] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract branding';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
