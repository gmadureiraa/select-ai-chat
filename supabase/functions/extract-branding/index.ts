const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    console.log('Extracting branding from:', formattedUrl);

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
    
    console.log('Branding extracted:', JSON.stringify(branding, null, 2));

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

    console.log('Mapped brand assets:', JSON.stringify(brandAssets, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: brandAssets,
        raw: branding 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error extracting branding:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract branding';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
