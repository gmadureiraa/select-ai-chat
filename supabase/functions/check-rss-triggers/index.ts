import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RssTrigger {
  id: string;
  workspace_id: string;
  client_id: string | null;
  name: string;
  rss_url: string;
  is_active: boolean;
  target_column_id: string | null;
  platform: string | null;
  content_type: string | null;
  prompt_template: string | null;
  auto_generate_content: boolean;
  assigned_to: string | null;
  last_checked_at: string | null;
  last_item_guid: string | null;
  items_seen: string[];
}

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

function parseRss(xmlText: string): RssItem[] {
  const items: RssItem[] = [];
  
  // Simple RSS parser using regex
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];
    
    const getTagContent = (tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const tagMatch = itemContent.match(regex);
      if (tagMatch) {
        // Remove CDATA wrapper if present
        return tagMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim();
      }
      return '';
    };
    
    const guid = getTagContent('guid') || getTagContent('link') || getTagContent('title');
    
    if (guid) {
      items.push({
        title: getTagContent('title'),
        link: getTagContent('link'),
        description: getTagContent('description'),
        pubDate: getTagContent('pubDate'),
        guid,
      });
    }
  }
  
  return items;
}

// Map platform + content_type to agent type for format rules
function mapPlatformToContentType(platform: string | null, contentType: string | null): string {
  // Direct content type mappings
  const contentTypeMappings: Record<string, string> = {
    thread: 'thread_agent',
    tweet: 'tweet_agent',
    carousel: 'carousel_agent',
    static_image: 'static_post_agent',
    stories: 'static_post_agent',
    newsletter: 'newsletter_agent',
    blog: 'blog_agent',
    article: 'article_agent',
  };
  
  if (contentType && contentTypeMappings[contentType]) {
    return contentTypeMappings[contentType];
  }
  
  // Platform defaults
  const platformDefaults: Record<string, string> = {
    twitter: 'thread_agent',
    instagram: 'static_post_agent',
    linkedin: 'linkedin_agent',
    newsletter: 'newsletter_agent',
    blog: 'blog_agent',
    youtube: 'long_video_agent',
    tiktok: 'reels_agent',
  };
  
  return platformDefaults[platform || ''] || 'static_post_agent';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('[check-rss-triggers] Starting RSS trigger check...');
    
    // Fetch all active triggers
    const { data: triggers, error: triggersError } = await supabase
      .from('rss_triggers')
      .select('*')
      .eq('is_active', true);
    
    if (triggersError) {
      console.error('[check-rss-triggers] Error fetching triggers:', triggersError);
      throw triggersError;
    }
    
    console.log(`[check-rss-triggers] Found ${triggers?.length || 0} active triggers`);
    
    const results: { triggerId: string; newItems: number; error?: string }[] = [];
    
    for (const trigger of (triggers || []) as RssTrigger[]) {
      try {
        console.log(`[check-rss-triggers] Processing trigger: ${trigger.name} (${trigger.rss_url})`);
        
        // Fetch RSS feed
        const response = await fetch(trigger.rss_url, {
          headers: {
            'User-Agent': 'Kaleidos RSS Reader/1.0',
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch RSS: ${response.status}`);
        }
        
        const xmlText = await response.text();
        const items = parseRss(xmlText);
        
        console.log(`[check-rss-triggers] Parsed ${items.length} items from feed`);
        
        // Find new items (not in items_seen)
        const seenGuids = new Set(trigger.items_seen || []);
        
        // CRITICAL FIX: On first run (no items seen), only process the LATEST item
        // Otherwise we'd create 20+ cards at once
        let newItems: RssItem[];
        const isFirstRun = !trigger.items_seen || trigger.items_seen.length === 0;
        
        if (isFirstRun && items.length > 0) {
          // First run: only take the most recent item
          newItems = [items[0]];
          // Mark all OTHER items as seen so they won't be processed later
          items.forEach(item => seenGuids.add(item.guid));
          console.log(`[check-rss-triggers] First run - only processing latest item, marking ${items.length} as seen`);
        } else {
          newItems = items.filter(item => !seenGuids.has(item.guid));
        }
        
        console.log(`[check-rss-triggers] Found ${newItems.length} new items to process`);
        
        // Create planning items for new RSS items
        for (const item of newItems) {
          // Get first column if target_column_id is not set
          let columnId = trigger.target_column_id;
          
          if (!columnId) {
            const { data: columns } = await supabase
              .from('kanban_columns')
              .select('id')
              .eq('workspace_id', trigger.workspace_id)
              .order('position', { ascending: true })
              .limit(1);
            
            columnId = columns?.[0]?.id;
          }
          
          // Create planning item
          const planningItem = {
            workspace_id: trigger.workspace_id,
            client_id: trigger.client_id,
            title: `[RSS] ${item.title}`,
            description: item.description,
            column_id: columnId,
            platform: trigger.platform,
            content_type: trigger.content_type,
            status: 'idea',
            created_by: trigger.workspace_id, // Using workspace_id as fallback
            assigned_to: trigger.assigned_to,
            metadata: {
              rss_source: trigger.rss_url,
              rss_link: item.link,
              rss_pub_date: item.pubDate,
              rss_trigger_id: trigger.id,
            },
          };
          
          const { data: createdItem, error: createError } = await supabase
            .from('planning_items')
            .insert(planningItem)
            .select()
            .single();
          
          if (createError) {
            console.error(`[check-rss-triggers] Error creating planning item:`, createError);
          } else {
            console.log(`[check-rss-triggers] Created planning item: ${createdItem.id}`);
            
            // If auto_generate_content is enabled, trigger content generation
            if (trigger.auto_generate_content) {
              // Map platform + content_type to correct agent type
              const contentAgentType = mapPlatformToContentType(trigger.platform, trigger.content_type);
              
              // Build prompt with template or default
              let prompt = `Crie um conteúdo baseado neste artigo:\n\nTítulo: ${item.title}\n\nDescrição: ${item.description}\n\nLink: ${item.link}`;
              
              if (trigger.prompt_template) {
                prompt = trigger.prompt_template
                  .replace('{title}', item.title)
                  .replace('{description}', item.description)
                  .replace('{link}', item.link);
              }
              
              // Call execute-agent with correct parameters for format rules
              try {
                console.log(`[check-rss-triggers] Generating content with agent type: ${contentAgentType}`);
                
                const { data: agentData, error: agentError } = await supabase.functions.invoke('execute-agent', {
                  body: {
                    agentType: 'content_writer',
                    contentType: contentAgentType,
                    userMessage: prompt,
                    clientId: trigger.client_id,
                    includeContext: true,
                  },
                });
                
                if (agentError) {
                  console.error(`[check-rss-triggers] Error calling execute-agent:`, agentError);
                } else if (agentData?.success && agentData?.output) {
                  // Update the planning item with generated content
                  await supabase
                    .from('planning_items')
                    .update({ content: agentData.output })
                    .eq('id', createdItem.id);
                  console.log(`[check-rss-triggers] Updated planning item with generated content`);
                }
              } catch (agentErr) {
                console.error(`[check-rss-triggers] Exception calling execute-agent:`, agentErr);
              }
            }
          }
          
          // Add to seen items
          seenGuids.add(item.guid);
        }
        
        // Update trigger with new items_seen and last_checked_at
        const { error: updateError } = await supabase
          .from('rss_triggers')
          .update({
            items_seen: Array.from(seenGuids),
            last_checked_at: new Date().toISOString(),
            last_item_guid: items[0]?.guid || trigger.last_item_guid,
          })
          .eq('id', trigger.id);
        
        if (updateError) {
          console.error(`[check-rss-triggers] Error updating trigger:`, updateError);
        }
        
        results.push({ triggerId: trigger.id, newItems: newItems.length });
        
      } catch (triggerError) {
        console.error(`[check-rss-triggers] Error processing trigger ${trigger.id}:`, triggerError);
        results.push({ 
          triggerId: trigger.id, 
          newItems: 0, 
          error: triggerError instanceof Error ? triggerError.message : 'Unknown error' 
        });
      }
    }
    
    console.log('[check-rss-triggers] Completed processing all triggers');
    
    return new Response(JSON.stringify({ 
      success: true, 
      triggersProcessed: triggers?.length || 0,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('[check-rss-triggers] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
