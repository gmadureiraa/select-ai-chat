import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_API_URL = Deno.env.get('N8N_API_URL');
const N8N_API_KEY = Deno.env.get('N8N_API_KEY');

async function makeN8nRequest(endpoint: string, method: string = 'GET', body?: unknown) {
  const url = `${N8N_API_URL}/api/v1${endpoint}`;
  console.log(`Making n8n request: ${method} ${url}`);
  
  const headers: Record<string, string> = {
    'X-N8N-API-KEY': N8N_API_KEY!,
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
    if (!N8N_API_URL || !N8N_API_KEY) {
      throw new Error('N8N_API_URL or N8N_API_KEY not configured');
    }

    const { action, workflowId, executionId, data } = await req.json();
    console.log(`n8n-api action: ${action}`, { workflowId, executionId });

    let result;

    switch (action) {
      case 'list_workflows':
        result = await makeN8nRequest('/workflows');
        break;

      case 'get_workflow':
        if (!workflowId) throw new Error('workflowId required');
        result = await makeN8nRequest(`/workflows/${workflowId}`);
        break;

      case 'list_executions':
        const params = new URLSearchParams();
        if (workflowId) params.append('workflowId', workflowId);
        params.append('limit', '50');
        result = await makeN8nRequest(`/executions?${params.toString()}`);
        break;

      case 'get_execution':
        if (!executionId) throw new Error('executionId required');
        result = await makeN8nRequest(`/executions/${executionId}`);
        break;

      case 'activate_workflow':
        if (!workflowId) throw new Error('workflowId required');
        result = await makeN8nRequest(`/workflows/${workflowId}/activate`, 'POST');
        break;

      case 'deactivate_workflow':
        if (!workflowId) throw new Error('workflowId required');
        result = await makeN8nRequest(`/workflows/${workflowId}/deactivate`, 'POST');
        break;

      case 'execute_workflow':
        if (!workflowId) throw new Error('workflowId required');
        // Use webhook URL if available, otherwise try direct execution
        result = await makeN8nRequest(`/workflows/${workflowId}/run`, 'POST', data || {});
        break;

      case 'get_workflow_webhooks':
        if (!workflowId) throw new Error('workflowId required');
        const workflow = await makeN8nRequest(`/workflows/${workflowId}`);
        // Extract webhook nodes from workflow
        const webhookNodes = workflow.nodes?.filter(
          (node: { type: string }) => 
            node.type === 'n8n-nodes-base.webhook' || 
            node.type === 'n8n-nodes-base.webhookTrigger'
        ) || [];
        result = { webhooks: webhookNodes, workflow };
        break;

      case 'delete_execution':
        if (!executionId) throw new Error('executionId required');
        result = await makeN8nRequest(`/executions/${executionId}`, 'DELETE');
        break;

      case 'retry_execution':
        if (!executionId) throw new Error('executionId required');
        result = await makeN8nRequest(`/executions/${executionId}/retry`, 'POST');
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
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
