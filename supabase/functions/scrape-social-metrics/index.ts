import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, platform, url } = await req.json();
    
    if (!clientId || !platform || !url) {
      throw new Error('clientId, platform, and url are required');
    }

    console.log(`Scraping ${platform} metrics for:`, url);

    let metrics = {};

    if (platform === 'instagram') {
      metrics = await scrapeInstagram(url);
    } else if (platform === 'youtube') {
      metrics = await scrapeYouTube(url);
    } else if (platform === 'tiktok') {
      metrics = await scrapeTikTok(url);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // Connect to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store metrics in database
    const { data: metricsData, error: metricsError } = await supabase
      .from('platform_metrics')
      .upsert({
        client_id: clientId,
        platform: platform,
        metric_date: new Date().toISOString().split('T')[0],
        ...metrics,
      }, {
        onConflict: 'client_id,platform,metric_date',
      });

    if (metricsError) {
      console.error('Error storing metrics:', metricsError);
      throw metricsError;
    }

    console.log('Metrics stored successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: metrics,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in scrape-social-metrics:', error);
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

async function scrapeInstagram(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const html = await response.text();
    
    // Extract followers count from meta tags or JSON-LD
    const followersMatch = html.match(/"edge_followed_by":\{"count":(\d+)\}/);
    const followers = followersMatch ? parseInt(followersMatch[1]) : 0;

    const postsMatch = html.match(/"edge_owner_to_timeline_media":\{"count":(\d+)\}/);
    const posts = postsMatch ? parseInt(postsMatch[1]) : 0;

    console.log(`Instagram scraped - Followers: ${followers}, Posts: ${posts}`);

    return {
      subscribers: followers,
      total_posts: posts,
      metadata: {
        url: url,
        scraped_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Error scraping Instagram:', error);
    return {
      subscribers: 0,
      total_posts: 0,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

async function scrapeYouTube(channelUrl: string) {
  try {
    const response = await fetch(channelUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const html = await response.text();
    
    // Extract subscriber count
    const subscribersMatch = html.match(/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([\d,\.]+[KMB]?) subscribers?"\}\}/);
    let subscribers = 0;
    if (subscribersMatch) {
      const subText = subscribersMatch[1];
      subscribers = parseYouTubeNumber(subText);
    }

    // Extract video count
    const videosMatch = html.match(/"videosCountText":\{"runs":\[\{"text":"([\d,]+)"\}/);
    const videos = videosMatch ? parseInt(videosMatch[1].replace(/,/g, '')) : 0;

    console.log(`YouTube scraped - Subscribers: ${subscribers}, Videos: ${videos}`);

    return {
      subscribers: subscribers,
      total_posts: videos,
      metadata: {
        url: channelUrl,
        scraped_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Error scraping YouTube:', error);
    return {
      subscribers: 0,
      total_posts: 0,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

async function scrapeTikTok(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const html = await response.text();
    
    // Extract follower count from JSON in script tag
    const followersMatch = html.match(/"followerCount":(\d+)/);
    const followers = followersMatch ? parseInt(followersMatch[1]) : 0;

    const videosMatch = html.match(/"videoCount":(\d+)/);
    const videos = videosMatch ? parseInt(videosMatch[1]) : 0;

    const likesMatch = html.match(/"heartCount":(\d+)/);
    const likes = likesMatch ? parseInt(likesMatch[1]) : 0;

    console.log(`TikTok scraped - Followers: ${followers}, Videos: ${videos}, Likes: ${likes}`);

    return {
      subscribers: followers,
      total_posts: videos,
      likes: likes,
      metadata: {
        url: url,
        scraped_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Error scraping TikTok:', error);
    return {
      subscribers: 0,
      total_posts: 0,
      likes: 0,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

function parseYouTubeNumber(text: string): number {
  const num = parseFloat(text.replace(/,/g, ''));
  if (text.includes('K')) return Math.round(num * 1000);
  if (text.includes('M')) return Math.round(num * 1000000);
  if (text.includes('B')) return Math.round(num * 1000000000);
  return Math.round(num);
}
