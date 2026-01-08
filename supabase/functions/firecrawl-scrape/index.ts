const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, options } = await req.json();

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

    console.log('[firecrawl-scrape] Scraping URL:', formattedUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: options?.formats || ['markdown', 'html', 'links'],
        onlyMainContent: options?.onlyMainContent ?? true,
        waitFor: options?.waitFor,
        location: options?.location,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[firecrawl-scrape] API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract images from HTML if available
    const images: string[] = [];
    const htmlContent = data.data?.html || data.html || '';
    
    if (htmlContent) {
      const imgPatterns = [
        /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
        /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi,
        /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
        /<source[^>]+srcset=["']([^"'\s]+)/gi,
      ];

      for (const pattern of imgPatterns) {
        let match;
        while ((match = pattern.exec(htmlContent)) !== null) {
          let imgUrl = match[1];
          
          // Skip tracking pixels and tiny images
          if (imgUrl.includes('tracking') || 
              imgUrl.includes('pixel') || 
              imgUrl.includes('1x1') ||
              imgUrl.includes('spacer') ||
              imgUrl.includes('blank.gif') ||
              imgUrl.includes('beacon') ||
              imgUrl.length < 15) {
            continue;
          }
          
          // Convert relative URLs to absolute
          if (imgUrl.startsWith('//')) {
            imgUrl = 'https:' + imgUrl;
          } else if (imgUrl.startsWith('/')) {
            try {
              const urlObj = new URL(formattedUrl);
              imgUrl = urlObj.origin + imgUrl;
            } catch { continue; }
          } else if (!imgUrl.startsWith('http') && !imgUrl.startsWith('data:')) {
            try {
              const urlObj = new URL(formattedUrl);
              const pathParts = urlObj.pathname.split('/');
              pathParts.pop();
              imgUrl = urlObj.origin + pathParts.join('/') + '/' + imgUrl;
            } catch { continue; }
          }
          
          // Skip data URIs and duplicates
          if (!imgUrl.startsWith('data:') && imgUrl.length > 20 && !images.includes(imgUrl)) {
            images.push(imgUrl);
          }
        }
      }
    }

    // Add OG image if available
    const metadata = data.data?.metadata || data.metadata || {};
    if (metadata.ogImage && !images.includes(metadata.ogImage)) {
      images.unshift(metadata.ogImage);
    }

    console.log('[firecrawl-scrape] Success - Content length:', 
      (data.data?.markdown || data.markdown || '').length, 
      'Images found:', images.length
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          markdown: data.data?.markdown || data.markdown || '',
          html: data.data?.html || data.html || '',
          links: data.data?.links || data.links || [],
          images,
          metadata: {
            title: metadata.title || '',
            description: metadata.description || '',
            ogImage: metadata.ogImage || '',
            sourceURL: metadata.sourceURL || formattedUrl,
            statusCode: metadata.statusCode || 200,
          },
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[firecrawl-scrape] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
