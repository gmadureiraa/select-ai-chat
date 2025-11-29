import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation constants
const MAX_TASK_NAME_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50000;
const MAX_CLIENT_NAME_LENGTH = 100;
const MAX_TEMPLATE_NAME_LENGTH = 100;

// Sanitize input to prevent injection attacks
function sanitizeInput(input: string, maxLength: number): string {
  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, ''); // Remove potential HTML/script tags
}

// Validate list ID format (ClickUp list IDs are numeric)
function isValidListId(listId: string): boolean {
  return /^\d+$/.test(listId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await req.json();
    const { listId, taskName, content, clientName, templateName } = body;

    // Input validation
    if (!listId || !taskName || !content) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios não preenchidos' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate list ID format
    if (!isValidListId(listId)) {
      console.error('Invalid list ID format:', listId);
      return new Response(
        JSON.stringify({ error: 'ID da lista inválido' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate input lengths
    if (taskName.length > MAX_TASK_NAME_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'Nome da tarefa muito longo (máx. 200 caracteres)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'Conteúdo muito longo (máx. 50000 caracteres)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Token de autenticação inválido' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get ClickUp access token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('clickup_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      console.error('ClickUp token not found for user:', user.id);
      return new Response(
        JSON.stringify({ error: 'ClickUp não conectado. Por favor, autorize o acesso primeiro.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Sanitize inputs
    const sanitizedTaskName = sanitizeInput(taskName, MAX_TASK_NAME_LENGTH);
    const sanitizedContent = sanitizeInput(content, MAX_CONTENT_LENGTH);
    const sanitizedClientName = clientName ? sanitizeInput(clientName, MAX_CLIENT_NAME_LENGTH) : 'N/A';
    const sanitizedTemplateName = templateName ? sanitizeInput(templateName, MAX_TEMPLATE_NAME_LENGTH) : 'N/A';

    // Create task description
    const taskDescription = `**Cliente:** ${sanitizedClientName}\n**Template:** ${sanitizedTemplateName}\n\n---\n\n${sanitizedContent}`;

    // Create task in ClickUp with error handling
    const createTaskResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: 'POST',
      headers: {
        'Authorization': tokenData.access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: sanitizedTaskName,
        description: taskDescription,
        markdown_description: taskDescription,
      }),
    });

    if (!createTaskResponse.ok) {
      const errorText = await createTaskResponse.text();
      console.error('ClickUp API error:', {
        status: createTaskResponse.status,
        statusText: createTaskResponse.statusText,
        body: errorText,
      });

      // Return user-friendly error
      if (createTaskResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Token do ClickUp expirado. Reconecte sua conta.' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (createTaskResponse.status === 404) {
        return new Response(
          JSON.stringify({ error: 'Lista do ClickUp não encontrada. Verifique a configuração.' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Não foi possível criar a tarefa no ClickUp' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const taskData = await createTaskResponse.json();

    console.log('Task created successfully:', {
      taskId: taskData.id,
      userId: user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        taskId: taskData.id,
        taskUrl: taskData.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error in send-to-clickup:', error);
    
    // Never expose internal error details to client
    return new Response(
      JSON.stringify({ error: 'Ocorreu um erro ao processar sua solicitação' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});