import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getBaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url.replace(/\/+$/, '');
  }
}

async function makeN8nRequest(baseUrl: string, apiKey: string, endpoint: string, method: string = 'GET', body?: unknown) {
  const url = `${baseUrl}/api/v1${endpoint}`;
  console.log(`Making n8n request: ${method} ${url}`);
  
  const headers: Record<string, string> = {
    'X-N8N-API-KEY': apiKey,
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`n8n API error: ${response.status} - ${errorText}`);
    throw new Error(`n8n API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    const { action, workflowId, executionId, data, workspaceId } = await req.json();
    console.log(`n8n-api action: ${action}`, { workflowId, executionId, workspaceId });

    if (!workspaceId) {
      throw new Error("workspaceId is required");
    }

    // Get n8n credentials for this workspace
    const { data: credentials, error: credError } = await supabaseClient
      .from('workspace_n8n_credentials')
      .select('n8n_api_url, n8n_api_key, is_active')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .single();

    if (credError || !credentials) {
      console.log('No n8n credentials found for workspace:', workspaceId);
      throw new Error('N8N_NOT_CONFIGURED');
    }

    const n8nBaseUrl = getBaseUrl(credentials.n8n_api_url);
    const n8nApiKey = credentials.n8n_api_key;

    let result;

    switch (action) {
      case 'list_workflows':
        result = await makeN8nRequest(n8nBaseUrl, n8nApiKey, '/workflows');
        break;

      case 'get_workflow':
        if (!workflowId) throw new Error('workflowId required');
        result = await makeN8nRequest(n8nBaseUrl, n8nApiKey, `/workflows/${workflowId}`);
        break;

      case 'list_executions':
        const params = new URLSearchParams();
        if (workflowId) params.append('workflowId', workflowId);
        params.append('limit', '50');
        result = await makeN8nRequest(n8nBaseUrl, n8nApiKey, `/executions?${params.toString()}`);
        break;

      case 'get_execution':
        if (!executionId) throw new Error('executionId required');
        result = await makeN8nRequest(n8nBaseUrl, n8nApiKey, `/executions/${executionId}`);
        break;

      case 'activate_workflow':
        if (!workflowId) throw new Error('workflowId required');
        result = await makeN8nRequest(n8nBaseUrl, n8nApiKey, `/workflows/${workflowId}/activate`, 'POST');
        break;

      case 'deactivate_workflow':
        if (!workflowId) throw new Error('workflowId required');
        result = await makeN8nRequest(n8nBaseUrl, n8nApiKey, `/workflows/${workflowId}/deactivate`, 'POST');
        break;

      case 'execute_workflow':
        if (!workflowId) throw new Error('workflowId required');
        result = await makeN8nRequest(n8nBaseUrl, n8nApiKey, `/workflows/${workflowId}/run`, 'POST', data || {});
        break;

      case 'get_workflow_webhooks':
        if (!workflowId) throw new Error('workflowId required');
        const workflow = await makeN8nRequest(n8nBaseUrl, n8nApiKey, `/workflows/${workflowId}`);
        const webhookNodes = workflow.nodes?.filter(
          (node: { type: string }) => 
            node.type === 'n8n-nodes-base.webhook' || 
            node.type === 'n8n-nodes-base.webhookTrigger'
        ) || [];
        result = { webhooks: webhookNodes, workflow };
        break;

      case 'delete_execution':
        if (!executionId) throw new Error('executionId required');
        result = await makeN8nRequest(n8nBaseUrl, n8nApiKey, `/executions/${executionId}`, 'DELETE');
        break;

      case 'retry_execution':
        if (!executionId) throw new Error('executionId required');
        result = await makeN8nRequest(n8nBaseUrl, n8nApiKey, `/executions/${executionId}/retry`, 'POST');
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`n8n-api result for ${action}:`, JSON.stringify(result).slice(0, 500));

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('n8n-api error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: errorMessage === 'N8N_NOT_CONFIGURED' ? 404 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});