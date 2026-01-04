import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

function parseRss(xmlText: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];
    
    const getTagContent = (tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const tagMatch = regex.exec(itemContent);
      return tagMatch ? (tagMatch[1] || tagMatch[2] || '').trim() : '';
    };

    items.push({
      title: getTagContent('title'),
      link: getTagContent('link'),
      description: getTagContent('description'),
      pubDate: getTagContent('pubDate'),
      guid: getTagContent('guid') || getTagContent('link'),
    });
  }

  return items;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { triggerId, createCard = false } = await req.json();

    if (!triggerId) {
      return new Response(
        JSON.stringify({ error: 'triggerId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Testing RSS trigger: ${triggerId}, createCard: ${createCard}`);

    // Fetch trigger details
    const { data: trigger, error: triggerError } = await supabase
      .from('rss_triggers')
      .select('*')
      .eq('id', triggerId)
      .single();

    if (triggerError || !trigger) {
      console.error('Trigger not found:', triggerError);
      return new Response(
        JSON.stringify({ error: 'Trigger not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching RSS feed: ${trigger.rss_url}`);

    // Fetch RSS feed
    const feedResponse = await fetch(trigger.rss_url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSSBot/1.0)' }
    });

    if (!feedResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch feed: ${feedResponse.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const xmlText = await feedResponse.text();
    const items = parseRss(xmlText);

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No items found in feed',
          feedUrl: trigger.rss_url 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the latest item (first in the array)
    const latestItem = items[0];
    const itemsSeen = trigger.items_seen || [];
    const isNew = !itemsSeen.includes(latestItem.guid);

    console.log(`Latest item: "${latestItem.title}", isNew: ${isNew}`);

    // Preview response
    const preview = {
      title: latestItem.title,
      description: latestItem.description?.substring(0, 200) + (latestItem.description?.length > 200 ? '...' : ''),
      link: latestItem.link,
      pubDate: latestItem.pubDate,
      isNew,
    };

    // If not creating card, just return preview
    if (!createCard) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          preview,
          wouldCreate: isNew,
          totalItems: items.length,
          itemsSeen: itemsSeen.length
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create planning item
    let planningTitle = trigger.title_template || '[RSS] {{title}}';
    planningTitle = planningTitle.replace('{{title}}', latestItem.title);

    let planningDescription = trigger.description_template || '{{description}}\n\nFonte: {{link}}';
    planningDescription = planningDescription
      .replace('{{description}}', latestItem.description || '')
      .replace('{{link}}', latestItem.link || '')
      .replace('{{title}}', latestItem.title || '');

    const planningItem = {
      workspace_id: trigger.workspace_id,
      client_id: trigger.client_id,
      title: planningTitle,
      description: planningDescription,
      content_type: trigger.content_type || 'post',
      status: 'idea',
      created_by: trigger.assigned_to || '00000000-0000-0000-0000-000000000000',
      assigned_to: trigger.assigned_to,
      metadata: {
        source: 'rss_trigger',
        trigger_id: trigger.id,
        rss_item: {
          guid: latestItem.guid,
          link: latestItem.link,
          pubDate: latestItem.pubDate,
        },
        is_test: true,
      },
    };

    console.log('Creating planning item:', planningItem.title);

    const { data: createdItem, error: createError } = await supabase
      .from('planning_items')
      .insert(planningItem)
      .select()
      .single();

    if (createError) {
      console.error('Error creating planning item:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create planning item', details: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update items_seen
    const newItemsSeen = [...itemsSeen, latestItem.guid];
    await supabase
      .from('rss_triggers')
      .update({ 
        items_seen: newItemsSeen,
        last_checked_at: new Date().toISOString()
      })
      .eq('id', triggerId);

    console.log(`Planning item created: ${createdItem.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        preview,
        created: true,
        item: createdItem
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in test-rss-trigger:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
