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
  auto_publish: boolean;
  last_triggered_at: string | null;
  items_created: number;
  created_by: string | null;
}

interface RSSItem {
  title: string;
  link: string;
  description?: string;
  content?: string;
  pubDate?: string;
  guid?: string;
  imageUrl?: string;
  allImages?: string[];
}

// Content type to format mapping for AI generation
const FORMAT_MAP: Record<string, string> = {
  'tweet': 'tweet',
  'thread': 'thread',
  'x_article': 'linkedin',
  'linkedin_post': 'linkedin',
  'carousel': 'carousel',
  'stories': 'stories',
  'instagram_post': 'post',
  'static_image': 'post',
  'short_video': 'reels',
  'long_video': 'reels',
  'newsletter': 'newsletter',
  'blog_post': 'newsletter',
  'case_study': 'newsletter',
  'report': 'newsletter',
  'document': 'post',
  'social_post': 'post', // Legacy
  'other': 'post',
};

// Content type to platform mapping
const PLATFORM_MAP: Record<string, string> = {
  'tweet': 'twitter',
  'thread': 'twitter',
  'x_article': 'twitter',
  'linkedin_post': 'linkedin',
  'carousel': 'instagram',
  'stories': 'instagram',
  'instagram_post': 'instagram',
  'static_image': 'instagram',
  'short_video': 'tiktok',
  'long_video': 'youtube',
  'newsletter': 'newsletter',
  'blog_post': 'blog',
};

// Extract images from HTML content
function extractImagesFromHTML(html: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    // Filter out tracking pixels and icons
    if (src && !src.includes('pixel') && !src.includes('tracking') && !src.includes('icon')) {
      images.push(src);
    }
  }
  
  // Also look for og:image or twitter:image meta patterns if present
  const metaImageRegex = /content=["']([^"']+\.(jpg|jpeg|png|gif|webp)[^"']*)["']/gi;
  while ((match = metaImageRegex.exec(html)) !== null) {
    if (!images.includes(match[1])) {
      images.push(match[1]);
    }
  }
  
  return images.slice(0, 10); // Limit to 10 images
}

// Parse RSS feed with full content and images
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
      const content = itemXml.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i)?.[1]?.trim() 
                   || itemXml.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i)?.[1]?.trim();
      const pubDate = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
      const guid = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1]?.trim() || link;
      
      // Extract images from content and description
      const allImages: string[] = [];
      
      // Media content
      const mediaUrl = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1];
      if (mediaUrl) allImages.push(mediaUrl);
      
      // Media thumbnail
      const thumbnailUrl = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1];
      if (thumbnailUrl && !allImages.includes(thumbnailUrl)) allImages.push(thumbnailUrl);
      
      // Enclosure
      const enclosureUrl = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i)?.[1];
      if (enclosureUrl && !allImages.includes(enclosureUrl)) allImages.push(enclosureUrl);
      
      // Extract from content HTML
      if (content) {
        const contentImages = extractImagesFromHTML(content);
        for (const img of contentImages) {
          if (!allImages.includes(img)) allImages.push(img);
        }
      }
      
      // Extract from description HTML
      if (description) {
        const descImages = extractImagesFromHTML(description);
        for (const img of descImages) {
          if (!allImages.includes(img)) allImages.push(img);
        }
      }
      
      items.push({ 
        title, 
        link, 
        description, 
        content,
        pubDate, 
        guid,
        imageUrl: allImages[0],
        allImages: allImages.slice(0, 8), // Limit to 8 images
      });
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
  const today = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  if (lastTriggered) {
    const lastDate = new Date(lastTriggered);
    if (lastDate.toDateString() === now.toDateString()) {
      return false;
    }
  }
  
  switch (config.type) {
    case 'daily':
      return config.time ? currentTime >= config.time : true;
      
    case 'weekly':
      if (!config.days?.includes(today)) return false;
      return config.time ? currentTime >= config.time : true;
      
    case 'monthly':
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
  
  if (config.last_guid && latestItem.guid === config.last_guid) {
    return { shouldTrigger: false };
  }
  
  return { 
    shouldTrigger: true, 
    data: latestItem,
    newGuid: latestItem.guid 
  };
}

// Replace template variables in prompt
function replaceTemplateVariables(template: string, data: RSSItem | null, automationName: string): string {
  if (!template) return `Crie conteúdo para: ${automationName}`;
  
  let prompt = template;
  
  const variables: Record<string, string> = {
    '{{title}}': data?.title || automationName,
    '{{description}}': data?.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '',
    '{{link}}': data?.link || '',
    '{{content}}': data?.content?.replace(/<[^>]*>/g, '').substring(0, 3000) || data?.description?.replace(/<[^>]*>/g, '').substring(0, 3000) || '',
    '{{images}}': (data?.allImages?.length || 0) > 0 
      ? `${data!.allImages!.length} imagens disponíveis do conteúdo original`
      : 'Sem imagens disponíveis',
  };
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
    prompt = prompt.replace(regex, value);
  }
  
  return prompt;
}

// Parse thread from generated content
function parseThreadFromContent(content: string): Array<{ id: string; text: string; media_urls: string[] }> | null {
  const tweets: Array<{ id: string; text: string; media_urls: string[] }> = [];
  
  // Try to detect thread structure
  // Pattern 1: "1/", "2/", etc.
  const numberedPattern = /(?:^|\n)(\d+)\/[\s\n]*([\s\S]*?)(?=(?:\n\d+\/)|$)/g;
  let match;
  let foundNumbered = false;
  
  while ((match = numberedPattern.exec(content)) !== null) {
    foundNumbered = true;
    tweets.push({
      id: `tweet-${match[1]}`,
      text: match[2].trim(),
      media_urls: [],
    });
  }
  
  if (foundNumbered && tweets.length > 0) return tweets;
  
  // Pattern 2: "Tweet 1:", "Tweet 2:", etc.
  const tweetPattern = /(?:^|\n)Tweet\s*(\d+)[:.]?\s*([\s\S]*?)(?=(?:\nTweet\s*\d)|$)/gi;
  
  while ((match = tweetPattern.exec(content)) !== null) {
    tweets.push({
      id: `tweet-${match[1]}`,
      text: match[2].trim(),
      media_urls: [],
    });
  }
  
  if (tweets.length > 0) return tweets;
  
  // Pattern 3: Split by "---" separator
  const parts = content.split(/\n---\n/);
  if (parts.length > 1) {
    parts.forEach((part, idx) => {
      const text = part.trim();
      if (text && text.length <= 280) {
        tweets.push({
          id: `tweet-${idx + 1}`,
          text,
          media_urls: [],
        });
      }
    });
    if (tweets.length > 0) return tweets;
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let automationId: string | null = null;
    let isManualTest = false;
    try {
      const body = await req.json();
      automationId = body.automationId || null;
      isManualTest = !!automationId;
    } catch {
      // No body or invalid JSON
    }

    console.log(`Starting automation processing... ${isManualTest ? `(Manual test: ${automationId})` : '(Scheduled)'}`);

    let query = supabase
      .from('planning_automations')
      .select('*');
    
    if (automationId) {
      query = query.eq('id', automationId);
    } else {
      query = query.eq('is_active', true);
    }

    const { data: automations, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching automations:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${automations?.length || 0} automation(s) to process`);

    const results: { id: string; name: string; triggered: boolean; error?: string; runId?: string }[] = [];

    for (const automation of (automations as PlanningAutomation[]) || []) {
      const startTime = Date.now();
      let runId: string | null = null;
      
      try {
        // Create run record
        const { data: run, error: runError } = await supabase
          .from('planning_automation_runs')
          .insert({
            automation_id: automation.id,
            workspace_id: automation.workspace_id,
            status: 'running',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (runError) {
          console.error(`Error creating run record for ${automation.name}:`, runError);
        } else {
          runId = run?.id;
        }

        let shouldTrigger = false;
        let triggerData: RSSItem | null = null;
        let newGuid: string | undefined;

        if (isManualTest) {
          console.log(`Manual test for ${automation.name} - forcing trigger`);
          shouldTrigger = true;
          
          if (automation.trigger_type === 'rss' && automation.trigger_config.url) {
            const items = await parseRSSFeed(automation.trigger_config.url);
            if (items.length > 0) {
              triggerData = items[0];
              newGuid = items[0].guid;
              console.log(`RSS data loaded: "${triggerData.title}" with ${triggerData.allImages?.length || 0} images`);
            }
          }
        } else {
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
              shouldTrigger = false;
              break;
          }
        }

        if (!shouldTrigger) {
          if (runId) {
            await supabase
              .from('planning_automation_runs')
              .update({
                status: 'skipped',
                result: 'Trigger conditions not met',
                completed_at: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
              })
              .eq('id', runId);
          }
          
          results.push({ id: automation.id, name: automation.name, triggered: false, runId: runId || undefined });
          continue;
        }

        console.log(`Triggering automation: ${automation.name}`);

        const itemTitle = triggerData?.title || automation.name;
        const itemDescription = triggerData?.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '';
        
        // Get images from RSS
        const mediaUrls = triggerData?.allImages?.slice(0, 4) || [];
        console.log(`Extracted ${mediaUrls.length} images from RSS`);
        
        // Derive platform from content_type if not set
        const derivedPlatform = automation.platform || PLATFORM_MAP[automation.content_type] || null;
        const format = FORMAT_MAP[automation.content_type] || 'post';
        
        // Get default column
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

        const { count } = await supabase
          .from('planning_items')
          .select('*', { count: 'exact', head: true })
          .eq('column_id', columnId);

        const position = (count || 0) + 1;

        // Prepare metadata with images
        const metadata: Record<string, unknown> = {
          automation_id: automation.id,
          automation_name: automation.name,
          trigger_type: automation.trigger_type,
          source_url: triggerData?.link,
          rss_images: mediaUrls,
        };

        // Create planning item
        const { data: newItem, error: createError } = await supabase
          .from('planning_items')
          .insert({
            workspace_id: automation.workspace_id,
            client_id: automation.client_id,
            column_id: columnId,
            title: itemTitle,
            description: itemDescription,
            platform: derivedPlatform,
            content_type: automation.content_type,
            position,
            status: 'idea',
            media_urls: mediaUrls,
            created_by: automation.created_by || '00000000-0000-0000-0000-000000000000',
            metadata,
          })
          .select()
          .single();

        if (createError) {
          console.error(`Error creating item for ${automation.name}:`, createError);
          
          if (runId) {
            await supabase
              .from('planning_automation_runs')
              .update({
                status: 'failed',
                error: createError.message,
                completed_at: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
              })
              .eq('id', runId);
          }
          
          results.push({ id: automation.id, name: automation.name, triggered: false, error: createError.message, runId: runId || undefined });
          continue;
        }

        console.log(`Created planning item: ${newItem.id}`);

        let generatedContent: string | null = null;

        // Generate content if enabled
        if (automation.auto_generate_content && automation.client_id) {
          try {
            console.log(`Generating content for item ${newItem.id} with format: ${format}...`);
            
            // Replace template variables
            const prompt = replaceTemplateVariables(
              automation.prompt_template || '',
              triggerData,
              automation.name
            );
            
            // Add context about images for threads/carousels
            let enrichedPrompt = prompt;
            if (mediaUrls.length > 0 && (automation.content_type === 'thread' || automation.content_type === 'carousel')) {
              enrichedPrompt += `\n\n📸 IMAGENS DISPONÍVEIS: O conteúdo original possui ${mediaUrls.length} imagens que serão anexadas automaticamente. Faça referência a elas nos pontos apropriados do conteúdo.`;
            }

            console.log(`Prompt for AI: ${enrichedPrompt.substring(0, 200)}...`);

            const response = await fetch(`${supabaseUrl}/functions/v1/kai-content-agent`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                message: enrichedPrompt,
                clientId: automation.client_id,
                workspaceId: automation.workspace_id,
                format: format,
                platform: derivedPlatform,
                stream: false,
              }),
            });

            if (response.ok) {
              const contentResult = await response.json();
            if (contentResult.content) {
                generatedContent = contentResult.content;
                console.log(`Content generated (${generatedContent!.length} chars)`);
                
                // Update metadata based on content type
                const updatedMetadata = { ...metadata };
                
                // For threads, parse and structure the tweets with images
                if (automation.content_type === 'thread' && generatedContent) {
                  const threadTweets = parseThreadFromContent(generatedContent);
                  if (threadTweets && threadTweets.length > 0) {
                    // Distribute images across tweets
                    if (mediaUrls.length > 0) {
                      const imagesPerTweet = Math.ceil(mediaUrls.length / Math.min(threadTweets.length, 4));
                      let imageIndex = 0;
                      
                      for (let i = 0; i < threadTweets.length && imageIndex < mediaUrls.length; i++) {
                        const tweetImages: string[] = [];
                        for (let j = 0; j < imagesPerTweet && imageIndex < mediaUrls.length; j++) {
                          tweetImages.push(mediaUrls[imageIndex]);
                          imageIndex++;
                        }
                        threadTweets[i].media_urls = tweetImages;
                      }
                    }
                    
                    updatedMetadata.thread_tweets = threadTweets;
                    console.log(`Parsed ${threadTweets.length} tweets with distributed images`);
                  }
                }
                
                await supabase
                  .from('planning_items')
                  .update({ 
                    content: generatedContent,
                    metadata: updatedMetadata,
                  })
                  .eq('id', newItem.id);
                  
                console.log(`Content saved to item ${newItem.id}`);
              }
            } else {
              const errorText = await response.text();
              console.error(`Content generation failed: ${errorText}`);
            }
          } catch (genError) {
            console.error(`Error generating content for ${automation.name}:`, genError);
          }
        }

        // Auto publish if enabled
        if (automation.auto_publish && automation.client_id && derivedPlatform && generatedContent) {
          try {
            console.log(`Auto-publishing item ${newItem.id} to ${derivedPlatform}...`);
            
            const { data: credentials } = await supabase
              .from('client_social_credentials')
              .select('metadata')
              .eq('client_id', automation.client_id)
              .eq('platform', derivedPlatform === 'twitter' ? 'twitter' : derivedPlatform)
              .maybeSingle();

            const lateProfileId = (credentials?.metadata as any)?.late_profile_id;

            if (lateProfileId) {
              const publishResponse = await fetch(`${supabaseUrl}/functions/v1/late-post`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  clientId: automation.client_id,
                  platform: derivedPlatform,
                  content: generatedContent,
                  mediaUrls: mediaUrls,
                }),
              });

              if (publishResponse.ok) {
                const publishResult = await publishResponse.json();
                console.log(`Successfully published item ${newItem.id}:`, publishResult);
                
                await supabase
                  .from('planning_items')
                  .update({ 
                    status: 'published',
                    metadata: {
                      ...(newItem.metadata as any || {}),
                      auto_published: true,
                      published_at: new Date().toISOString(),
                    }
                  })
                  .eq('id', newItem.id);
              } else {
                console.error(`Failed to publish item ${newItem.id}:`, await publishResponse.text());
              }
            } else {
              console.log(`No Late API credentials found for ${derivedPlatform}`);
            }
          } catch (publishError) {
            console.error(`Error auto-publishing for ${automation.name}:`, publishError);
          }
        }

        // Update automation tracking
        const updateData: Record<string, unknown> = {
          last_triggered_at: new Date().toISOString(),
          items_created: (automation.items_created || 0) + 1,
        };

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

        // Update run as completed
        if (runId) {
          await supabase
            .from('planning_automation_runs')
            .update({
              status: 'completed',
              result: generatedContent 
                ? `Criado e gerado: ${itemTitle}` 
                : `Criado: ${itemTitle}`,
              items_created: 1,
              completed_at: new Date().toISOString(),
              duration_ms: Date.now() - startTime,
              trigger_data: triggerData ? { 
                title: triggerData.title, 
                link: triggerData.link,
                images_count: triggerData.allImages?.length || 0,
              } : null,
            })
            .eq('id', runId);
        }

        results.push({ id: automation.id, name: automation.name, triggered: true, runId: runId || undefined });

      } catch (automationError) {
        console.error(`Error processing automation ${automation.name}:`, automationError);
        
        if (runId) {
          await supabase
            .from('planning_automation_runs')
            .update({
              status: 'failed',
              error: automationError instanceof Error ? automationError.message : 'Unknown error',
              completed_at: new Date().toISOString(),
              duration_ms: Date.now() - startTime,
            })
            .eq('id', runId);
        }
        
        results.push({ 
          id: automation.id, 
          name: automation.name, 
          triggered: false, 
          error: automationError instanceof Error ? automationError.message : 'Unknown error',
          runId: runId || undefined
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
