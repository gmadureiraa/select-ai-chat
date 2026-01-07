import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduleConfig {
  type?: 'daily' | 'weekly' | 'monthly';
  days?: number[];
  time?: string;
}

interface RSSConfig {
  url?: string;
  last_guid?: string;
  last_checked?: string;
}

interface PlanningAutomation {
  id: string;
  workspace_id: string;
  client_id: string | null;
  name: string;
  is_active: boolean;
  trigger_type: 'schedule' | 'rss' | 'webhook';
  trigger_config: ScheduleConfig & RSSConfig;
  target_column_id: string | null;
  platform: string | null;
  content_type: string;
  auto_generate_content: boolean;
  prompt_template: string | null;
  last_triggered_at: string | null;
  items_created: number;
  created_by: string | null;
}

interface RSSItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  guid?: string;
}

// Parse RSS feed
async function parseRSSFeed(url: string): Promise<RSSItem[]> {
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    const items: RSSItem[] = [];
    const itemMatches = text.match(/<item[\s\S]*?<\/item>/gi) || [];
    
    for (const itemXml of itemMatches) {
      const title = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || '';
      const link = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || '';
      const description = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim();
      const pubDate = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
      const guid = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() || link;
      
      items.push({ title, link, description, pubDate, guid });
    }
    
    return items;
  } catch (error) {
    console.error(`Error parsing RSS feed ${url}:`, error);
    return [];
  }
}

// Check if schedule trigger should fire
function shouldTriggerSchedule(config: ScheduleConfig, lastTriggered: string | null): boolean {
  const now = new Date();
  const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  // Check if already triggered today
  if (lastTriggered) {
    const lastDate = new Date(lastTriggered);
    if (lastDate.toDateString() === now.toDateString()) {
      return false; // Already triggered today
    }
  }
  
  // Check schedule type
  switch (config.type) {
    case 'daily':
      // Check if current time is past the scheduled time
      return config.time ? currentTime >= config.time : true;
      
    case 'weekly':
      // Check if today is one of the scheduled days
      if (!config.days?.includes(today)) return false;
      return config.time ? currentTime >= config.time : true;
      
    case 'monthly':
      // Check if today's date matches scheduled days
      const dayOfMonth = now.getDate();
      if (!config.days?.includes(dayOfMonth)) return false;
      return config.time ? currentTime >= config.time : true;
      
    default:
      return false;
  }
}

// Check RSS trigger
async function checkRSSTrigger(
  config: RSSConfig
): Promise<{ shouldTrigger: boolean; data?: RSSItem; newGuid?: string }> {
  if (!config.url) return { shouldTrigger: false };
  
  const items = await parseRSSFeed(config.url);
  if (items.length === 0) return { shouldTrigger: false };
  
  const latestItem = items[0];
  
  // Check if this is a new item
  if (config.last_guid && latestItem.guid === config.last_guid) {
    return { shouldTrigger: false };
  }
  
  return { 
    shouldTrigger: true, 
    data: latestItem,
    newGuid: latestItem.guid 
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting automation processing...');

    // Fetch active automations
    const { data: automations, error: fetchError } = await supabase
      .from('planning_automations')
      .select('*')
      .eq('is_active', true);

    if (fetchError) {
      console.error('Error fetching automations:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${automations?.length || 0} active automations`);

    const results: { id: string; name: string; triggered: boolean; error?: string }[] = [];

    for (const automation of (automations as PlanningAutomation[]) || []) {
      try {
        let shouldTrigger = false;
        let triggerData: RSSItem | null = null;
        let newGuid: string | undefined;

        // Check trigger based on type
        switch (automation.trigger_type) {
          case 'schedule':
            shouldTrigger = shouldTriggerSchedule(automation.trigger_config, automation.last_triggered_at);
            break;
            
          case 'rss':
            const rssResult = await checkRSSTrigger(automation.trigger_config);
            shouldTrigger = rssResult.shouldTrigger;
            triggerData = rssResult.data || null;
            newGuid = rssResult.newGuid;
            break;
            
          case 'webhook':
            // Webhooks are triggered externally, skip in cron
            shouldTrigger = false;
            break;
        }

        if (!shouldTrigger) {
          results.push({ id: automation.id, name: automation.name, triggered: false });
          continue;
        }

        console.log(`Triggering automation: ${automation.name}`);

        // Create planning item
        const itemTitle = triggerData?.title || automation.name;
        const itemDescription = triggerData?.description || '';
        
        // Get default column if not specified
        let columnId = automation.target_column_id;
        if (!columnId) {
          const { data: defaultColumn } = await supabase
            .from('kanban_columns')
            .select('id')
            .eq('workspace_id', automation.workspace_id)
            .eq('is_default', true)
            .single();
          columnId = defaultColumn?.id;
        }

        // Get next position
        const { count } = await supabase
          .from('planning_items')
          .select('*', { count: 'exact', head: true })
          .eq('column_id', columnId);

        const position = (count || 0) + 1;

        // Create the planning item
        const { data: newItem, error: createError } = await supabase
          .from('planning_items')
          .insert({
            workspace_id: automation.workspace_id,
            client_id: automation.client_id,
            column_id: columnId,
            title: itemTitle,
            description: itemDescription,
            platform: automation.platform,
            content_type: automation.content_type,
            position,
            status: 'idea',
            created_by: automation.created_by || '00000000-0000-0000-0000-000000000000',
            metadata: {
              automation_id: automation.id,
              automation_name: automation.name,
              trigger_type: automation.trigger_type,
              source_url: triggerData?.link,
            }
          })
          .select()
          .single();

        if (createError) {
          console.error(`Error creating item for ${automation.name}:`, createError);
          results.push({ id: automation.id, name: automation.name, triggered: false, error: createError.message });
          continue;
        }

        console.log(`Created planning item: ${newItem.id}`);

        // Generate content if enabled
        if (automation.auto_generate_content && automation.client_id) {
          try {
            console.log(`Generating content for item ${newItem.id}...`);
            
            const prompt = automation.prompt_template 
              ? automation.prompt_template.replace('{{title}}', itemTitle).replace('{{description}}', itemDescription)
              : `Crie conteúdo para: ${itemTitle}\n\n${itemDescription}`;

            // Call content generation function
            const response = await fetch(`${supabaseUrl}/functions/v1/kai-content-agent`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                message: prompt,
                clientId: automation.client_id,
                workspaceId: automation.workspace_id,
              }),
            });

            if (response.ok) {
              const contentResult = await response.json();
              if (contentResult.content) {
                await supabase
                  .from('planning_items')
                  .update({ content: contentResult.content })
                  .eq('id', newItem.id);
                console.log(`Content generated for item ${newItem.id}`);
              }
            }
          } catch (genError) {
            console.error(`Error generating content for ${automation.name}:`, genError);
            // Continue even if content generation fails
          }
        }

        // Update automation tracking
        const updateData: Record<string, unknown> = {
          last_triggered_at: new Date().toISOString(),
          items_created: (automation.items_created || 0) + 1,
        };

        // Update RSS last_guid if applicable
        if (automation.trigger_type === 'rss' && newGuid) {
          updateData.trigger_config = {
            ...automation.trigger_config,
            last_guid: newGuid,
            last_checked: new Date().toISOString(),
          };
        }

        await supabase
          .from('planning_automations')
          .update(updateData)
          .eq('id', automation.id);

        results.push({ id: automation.id, name: automation.name, triggered: true });

      } catch (automationError) {
        console.error(`Error processing automation ${automation.name}:`, automationError);
        results.push({ 
          id: automation.id, 
          name: automation.name, 
          triggered: false, 
          error: automationError instanceof Error ? automationError.message : 'Unknown error' 
        });
      }
    }

    const triggered = results.filter(r => r.triggered).length;
    console.log(`Processing complete. Triggered: ${triggered}/${results.length}`);

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      triggered,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-automations:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
