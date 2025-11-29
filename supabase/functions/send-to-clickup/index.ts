import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { listId, taskName, content, clientName, templateName } = await req.json();

    if (!listId || !taskName || !content) {
      throw new Error('Missing required fields: listId, taskName, or content');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    // Get ClickUp access token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('clickup_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('ClickUp not connected. Please authorize ClickUp first.');
    }

    // Create task in ClickUp
    const taskDescription = `**Cliente:** ${clientName || 'N/A'}\n**Template:** ${templateName || 'N/A'}\n\n---\n\n${content}`;

    const createTaskResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: 'POST',
      headers: {
        'Authorization': tokenData.access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: taskName,
        description: taskDescription,
        markdown_description: taskDescription,
      }),
    });

    if (!createTaskResponse.ok) {
      const error = await createTaskResponse.text();
      console.error('ClickUp task creation failed:', error);
      throw new Error('Failed to create task in ClickUp');
    }

    const taskData = await createTaskResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        taskId: taskData.id,
        taskUrl: taskData.url,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-to-clickup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});