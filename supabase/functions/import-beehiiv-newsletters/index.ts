import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, publicationId, limit = 30 } = await req.json();
    
    if (!clientId) {
      throw new Error('Client ID is required');
    }

    const beehiivApiKey = Deno.env.get('BEEHIIV_API_KEY');
    if (!beehiivApiKey) {
      throw new Error('Beehiiv API key not configured');
    }

    // Use provided publication ID or default
    const pubId = publicationId || 'pub_fd4a6eba-57e6-4a97-827a-d8ebba263f0e';

    console.log(`Fetching ${limit} newsletters from Beehiiv publication: ${pubId}`);

    // Fetch posts list
    const postsResponse = await fetch(
      `https://api.beehiiv.com/v2/publications/${pubId}/posts?status=confirmed&limit=${limit}&expand=free_web_content`,
      {
        headers: {
          'Authorization': `Bearer ${beehiivApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!postsResponse.ok) {
      const error = await postsResponse.text();
      console.error('Beehiiv API error:', error);
      throw new Error(`Beehiiv API error: ${postsResponse.status} - ${error}`);
    }

    const postsData = await postsResponse.json();
    const posts = postsData.data || [];
    
    console.log(`Found ${posts.length} posts`);

    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const importedNewsletters = [];
    const errors = [];

    for (const post of posts) {
      try {
        // Get full post content
        const postDetailResponse = await fetch(
          `https://api.beehiiv.com/v2/publications/${pubId}/posts/${post.id}?expand=free_web_content`,
          {
            headers: {
              'Authorization': `Bearer ${beehiivApiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!postDetailResponse.ok) {
          console.error(`Failed to fetch post ${post.id}:`, postDetailResponse.status);
          errors.push({ postId: post.id, title: post.title, error: `API error: ${postDetailResponse.status}` });
          continue;
        }

        const postDetail = await postDetailResponse.json();
        const fullPost = postDetail.data;

        console.log(`Post ${fullPost.title} - Available content fields:`, {
          hasFreeWeb: !!fullPost.content?.free?.web,
          hasFreeEmail: !!fullPost.content?.free?.email,
          hasPremiumWeb: !!fullPost.content?.premium?.web,
          hasPremiumEmail: !!fullPost.content?.premium?.email,
          freeWebLength: fullPost.content?.free?.web?.length || 0,
          premiumWebLength: fullPost.content?.premium?.web?.length || 0,
        });

        // Extract content - try premium first (full content), then free
        const htmlContent = fullPost.content?.premium?.web 
          || fullPost.content?.premium?.email 
          || fullPost.content?.free?.web 
          || fullPost.content?.free?.email 
          || '';
        
        console.log(`HTML content length for "${fullPost.title}": ${htmlContent.length}`);
        
        // Convert HTML to cleaner text while preserving structure better
        const cleanContent = htmlContent
          // Remove style and script tags
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          // Preserve headings with markdown-like formatting
          .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
          .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
          .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
          .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n\n#### $1\n\n')
          // Handle blockquotes
          .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n\n> $1\n\n')
          // Handle line breaks and paragraphs
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<p[^>]*>/gi, '')
          // Handle lists
          .replace(/<li[^>]*>/gi, '• ')
          .replace(/<\/li>/gi, '\n')
          .replace(/<\/?[ou]l[^>]*>/gi, '\n')
          // Handle links - preserve text
          .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
          // Handle emphasis
          .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
          .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
          .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
          .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
          // Remove remaining HTML tags
          .replace(/<[^>]+>/g, '')
          // Decode HTML entities
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&rsquo;/g, "'")
          .replace(/&lsquo;/g, "'")
          .replace(/&rdquo;/g, '"')
          .replace(/&ldquo;/g, '"')
          .replace(/&mdash;/g, '—')
          .replace(/&ndash;/g, '–')
          .replace(/&hellip;/g, '...')
          // Clean up excessive whitespace
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]+/g, ' ')
          .trim();
        
        console.log(`Clean content length for "${fullPost.title}": ${cleanContent.length}`);

        // Extract images from HTML
        const imageRegex = /<img[^>]+src="([^"]+)"/gi;
        const images: string[] = [];
        let match;
        while ((match = imageRegex.exec(htmlContent)) !== null) {
          if (match[1] && !match[1].includes('tracking') && !match[1].includes('pixel')) {
            images.push(match[1]);
          }
        }

        // Build full title with subtitle if available
        const fullTitle = fullPost.subtitle 
          ? `${fullPost.title} - ${fullPost.subtitle}`
          : fullPost.title;

        // Check if already exists
        const { data: existing } = await supabase
          .from('client_content_library')
          .select('id')
          .eq('client_id', clientId)
          .eq('content_url', fullPost.web_url)
          .single();

        if (existing) {
          console.log(`Newsletter already exists: ${fullPost.title}`);
          continue;
        }

        // Insert into content library
        const { data: inserted, error: insertError } = await supabase
          .from('client_content_library')
          .insert({
            client_id: clientId,
            title: fullTitle,
            content_type: 'newsletter',
            content: cleanContent,
            content_url: fullPost.web_url,
            thumbnail_url: fullPost.thumbnail_url,
            metadata: {
              beehiiv_id: fullPost.id,
              subtitle: fullPost.subtitle,
              publish_date: fullPost.publish_date,
              stats: fullPost.stats,
              images: images.slice(0, 10), // Keep up to 10 images
              original_html_length: htmlContent.length,
            },
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting ${fullPost.title}:`, insertError);
          errors.push({ postId: post.id, title: fullPost.title, error: insertError.message });
        } else {
          console.log(`Imported: ${fullPost.title}`);
          importedNewsletters.push({
            id: inserted.id,
            title: fullTitle,
            url: fullPost.web_url,
            contentLength: cleanContent.length,
            imagesCount: images.length,
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (postError) {
        console.error(`Error processing post ${post.id}:`, postError);
        errors.push({ postId: post.id, title: post.title, error: String(postError) });
      }
    }

    console.log(`Import complete: ${importedNewsletters.length} imported, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: importedNewsletters.length,
        errors: errors.length,
        newsletters: importedNewsletters,
        errorDetails: errors,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in import-beehiiv-newsletters:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
