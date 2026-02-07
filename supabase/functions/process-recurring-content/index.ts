import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecurringTemplate {
  id: string;
  workspace_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  content: string | null;
  column_id: string | null;
  platform: string | null;
  content_type: string | null;
  priority: string | null;
  recurrence_type: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrence_days: string[];
  recurrence_time: string | null;
  recurrence_end_date: string | null;
  created_by: string;
  assigned_to: string | null;
  generate_with_ai?: boolean;
  metadata?: Record<string, unknown>;
}

function shouldCreateToday(template: RecurringTemplate): boolean {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Check if we're past the end date
  if (template.recurrence_end_date && template.recurrence_end_date < today) {
    return false;
  }
  
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const dayOfMonth = now.getDate();
  
  switch (template.recurrence_type) {
    case 'daily':
      return true;
      
    case 'weekly':
      // Check if today is one of the selected days
      return template.recurrence_days?.includes(dayOfWeek) || false;
      
    case 'biweekly':
      // Every two weeks on selected days
      const weekNumber = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weekNumber % 2 !== 0) return false;
      return template.recurrence_days?.includes(dayOfWeek) || false;
      
    case 'monthly':
      // First occurrence of the selected day in the month
      // Or specific day of month if recurrence_days contains numbers
      if (template.recurrence_days?.some(d => !isNaN(parseInt(d)))) {
        return template.recurrence_days.includes(dayOfMonth.toString());
      }
      // Default to first Monday of the month
      return dayOfMonth <= 7 && dayOfWeek === 'monday';
      
    default:
      return false;
  }
}

/**
 * Generate content using unified-content-api
 */
async function generateAIContent(
  supabaseUrl: string,
  serviceKey: string,
  template: RecurringTemplate
): Promise<{ content: string; images: string[] } | null> {
  if (!template.client_id) {
    console.log('[process-recurring-content] No client_id, skipping AI generation');
    return null;
  }

  const format = template.content_type || 'instagram_carousel';
  const brief = template.description || template.title;

  console.log(`[process-recurring-content] Generating AI content for template: ${template.title}`);
  console.log(`[process-recurring-content] Format: ${format}, Brief: ${brief.substring(0, 100)}...`);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/unified-content-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        client_id: template.client_id,
        format: format,
        brief: brief,
        title: template.title,
        generate_images: false, // Text only for now
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[process-recurring-content] AI generation failed: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    
    if (result.content) {
      console.log(`[process-recurring-content] AI content generated successfully, length: ${result.content.length}`);
      return {
        content: result.content,
        images: result.images || [],
      };
    }

    console.log('[process-recurring-content] AI returned no content');
    return null;
  } catch (error) {
    console.error('[process-recurring-content] Error calling unified-content-api:', error);
    return null;
  }
}

/**
 * Check if template should use AI generation:
 * - Has generate_with_ai flag set to true, OR
 * - Has description (briefing) but no content
 */
function shouldGenerateWithAI(template: RecurringTemplate): boolean {
  // Explicit flag takes precedence
  if (template.generate_with_ai === true) {
    return true;
  }
  
  // If there's a briefing (description) but no content, generate with AI
  if (template.description && !template.content) {
    return true;
  }
  
  // Check metadata for ai_generation flag
  const metadata = template.metadata as Record<string, unknown> | undefined;
  if (metadata?.generate_with_ai === true) {
    return true;
  }
  
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('[process-recurring-content] Starting recurring content check...');
    
    // Fetch all recurrence templates
    const { data: templates, error: templatesError } = await supabase
      .from('planning_items')
      .select('*')
      .eq('is_recurrence_template', true)
      .not('recurrence_type', 'is', null)
      .neq('recurrence_type', 'none');
    
    if (templatesError) {
      console.error('[process-recurring-content] Error fetching templates:', templatesError);
      throw templatesError;
    }
    
    console.log(`[process-recurring-content] Found ${templates?.length || 0} recurrence templates`);
    
    const today = new Date().toISOString().split('T')[0];
    const results: { templateId: string; created: boolean; itemId?: string; aiGenerated?: boolean; error?: string }[] = [];
    
    for (const template of (templates || []) as RecurringTemplate[]) {
      try {
        console.log(`[process-recurring-content] Processing template: ${template.title}`);
        
        // Check if we should create content today
        if (!shouldCreateToday(template)) {
          console.log(`[process-recurring-content] Template ${template.id} not scheduled for today`);
          results.push({ templateId: template.id, created: false });
          continue;
        }
        
        // Check if we already created content for this template today
        const { data: existingItems } = await supabase
          .from('planning_items')
          .select('id')
          .eq('recurrence_parent_id', template.id)
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`);
        
        if (existingItems && existingItems.length > 0) {
          console.log(`[process-recurring-content] Template ${template.id} already created today`);
          results.push({ templateId: template.id, created: false });
          continue;
        }
        
        // Determine content - either from template or AI-generated
        let finalContent = template.content;
        let aiGenerated = false;
        let generatedImages: string[] = [];
        
        if (shouldGenerateWithAI(template)) {
          console.log(`[process-recurring-content] Template ${template.id} marked for AI generation`);
          const aiResult = await generateAIContent(supabaseUrl, supabaseServiceKey, template);
          
          if (aiResult) {
            finalContent = aiResult.content;
            generatedImages = aiResult.images;
            aiGenerated = true;
            console.log(`[process-recurring-content] AI content generated for template ${template.id}`);
          } else {
            // Fallback to description if AI fails
            finalContent = template.description || template.content;
            console.log(`[process-recurring-content] AI generation failed, using fallback content`);
          }
        }
        
        // Create the recurring planning item
        const scheduledTime = template.recurrence_time 
          ? `${today}T${template.recurrence_time}` 
          : null;
        
        const newItem: Record<string, unknown> = {
          workspace_id: template.workspace_id,
          client_id: template.client_id,
          title: template.title,
          description: template.description,
          content: finalContent,
          column_id: template.column_id,
          platform: template.platform,
          content_type: template.content_type,
          priority: template.priority,
          status: 'idea',
          created_by: template.created_by,
          assigned_to: template.assigned_to,
          recurrence_parent_id: template.id,
          scheduled_at: scheduledTime,
          due_date: today,
          metadata: {
            generated_from_recurrence: true,
            recurrence_template_id: template.id,
            ai_generated: aiGenerated,
          },
        };
        
        // Add images if generated
        if (generatedImages.length > 0) {
          newItem.images = generatedImages;
        }
        
        const { data: createdItem, error: createError } = await supabase
          .from('planning_items')
          .insert(newItem)
          .select()
          .single();
        
        if (createError) {
          console.error(`[process-recurring-content] Error creating item:`, createError);
          results.push({ templateId: template.id, created: false, error: createError.message });
        } else {
          console.log(`[process-recurring-content] Created recurring item: ${createdItem.id} (AI: ${aiGenerated})`);
          results.push({ templateId: template.id, created: true, itemId: createdItem.id, aiGenerated });
        }
        
      } catch (templateError) {
        console.error(`[process-recurring-content] Error processing template ${template.id}:`, templateError);
        results.push({ 
          templateId: template.id, 
          created: false, 
          error: templateError instanceof Error ? templateError.message : 'Unknown error' 
        });
      }
    }
    
    const createdCount = results.filter(r => r.created).length;
    const aiGeneratedCount = results.filter(r => r.aiGenerated).length;
    console.log(`[process-recurring-content] Completed. Created ${createdCount} items (${aiGeneratedCount} with AI).`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      templatesProcessed: templates?.length || 0,
      itemsCreated: createdCount,
      aiGenerated: aiGeneratedCount,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('[process-recurring-content] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
