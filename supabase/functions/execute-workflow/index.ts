import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkflowNode {
  id: string;
  type: string;
  agent_id: string | null;
  config: Record<string, any>;
  position_x: number;
  position_y: number;
}

interface WorkflowConnection {
  id: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: string;
  label: string | null;
}

interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  model: string;
  temperature: number;
  tools: any[];
  knowledge: any[];
  variables: Record<string, any>;
  memory_enabled: boolean;
}

interface ExecutionContext {
  variables: Record<string, any>;
  outputs: Record<string, any>;
  currentInput: any;
  executionLog: any[];
}

// Map model names to Gemini models via Lovable AI Gateway
function mapToGeminiModel(model: string): string {
  const modelMap: Record<string, string> = {
    'google/gemini-2.5-flash': 'google/gemini-2.5-flash',
    'google/gemini-2.5-pro': 'google/gemini-2.5-pro',
    'google/gemini-2.5-flash-lite': 'google/gemini-2.5-flash-lite',
    'openai/gpt-4o': 'google/gemini-2.5-flash',
    'openai/gpt-4o-mini': 'google/gemini-2.5-flash',
    'openai/gpt-5': 'google/gemini-2.5-pro',
    'openai/gpt-5-mini': 'google/gemini-2.5-flash',
    'gpt-4o': 'google/gemini-2.5-flash',
    'gpt-4o-mini': 'google/gemini-2.5-flash',
  };
  
  return modelMap[model] || 'google/gemini-2.5-flash';
}

// Execute AI Agent node using Lovable AI Gateway
async function executeAgentNode(
  node: WorkflowNode,
  agent: Agent,
  context: ExecutionContext
): Promise<{ success: boolean; output: any; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    return { success: false, output: null, error: 'LOVABLE_API_KEY not configured' };
  }

  try {
    // Build the prompt with context
    let systemPrompt = agent.system_prompt;
    
    // Replace variables in prompt
    for (const [key, value] of Object.entries(context.variables)) {
      systemPrompt = systemPrompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    
    // Add previous outputs as context
    if (Object.keys(context.outputs).length > 0) {
      systemPrompt += `\n\n## Outputs anteriores:\n${JSON.stringify(context.outputs, null, 2)}`;
    }

    const userMessage = typeof context.currentInput === 'string' 
      ? context.currentInput 
      : JSON.stringify(context.currentInput);

    // Map to Gemini model
    const geminiModel = mapToGeminiModel(agent.model);
    console.log(`Agent ${agent.name} using model: ${geminiModel} (original: ${agent.model})`);

    // Call Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: geminiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return { success: false, output: null, error: 'Rate limit exceeded. Please try again later.' };
      }
      if (response.status === 402) {
        return { success: false, output: null, error: 'Insufficient credits. Please add funds.' };
      }
      
      return { success: false, output: null, error: `AI Gateway error: ${response.status}` };
    }

    const data = await response.json();
    const output = data.choices?.[0]?.message?.content || '';
    
    return { success: true, output };
  } catch (error) {
    console.error('Agent execution error:', error);
    return { success: false, output: null, error: String(error) };
  }
}

// Execute Condition node
function executeConditionNode(
  node: WorkflowNode,
  context: ExecutionContext
): { success: boolean; result: boolean; error?: string } {
  try {
    const config = node.config || {};
    const condition = config.condition || '';
    const variable = config.variable || '';
    const value = config.value || '';
    
    let result = false;
    
    // Get the value to compare
    let actualValue = context.currentInput;
    if (variable && context.variables[variable] !== undefined) {
      actualValue = context.variables[variable];
    } else if (variable && context.outputs[variable] !== undefined) {
      actualValue = context.outputs[variable];
    }
    
    // Convert to string for comparison
    const actualStr = String(actualValue).toLowerCase();
    const expectedStr = String(value).toLowerCase();
    
    switch (condition) {
      case 'equals':
        result = actualStr === expectedStr;
        break;
      case 'not_equals':
        result = actualStr !== expectedStr;
        break;
      case 'contains':
        result = actualStr.includes(expectedStr);
        break;
      case 'not_contains':
        result = !actualStr.includes(expectedStr);
        break;
      case 'starts_with':
        result = actualStr.startsWith(expectedStr);
        break;
      case 'ends_with':
        result = actualStr.endsWith(expectedStr);
        break;
      case 'greater_than':
        result = parseFloat(actualStr) > parseFloat(expectedStr);
        break;
      case 'less_than':
        result = parseFloat(actualStr) < parseFloat(expectedStr);
        break;
      case 'is_empty':
        result = !actualValue || actualStr === '';
        break;
      case 'is_not_empty':
        result = !!actualValue && actualStr !== '';
        break;
      default:
        // If no condition, treat as truthy check
        result = !!actualValue;
    }
    
    return { success: true, result };
  } catch (error) {
    console.error('Condition evaluation error:', error);
    return { success: false, result: false, error: String(error) };
  }
}

// Execute Tool node
async function executeToolNode(
  node: WorkflowNode,
  context: ExecutionContext
): Promise<{ success: boolean; output: any; error?: string }> {
  try {
    const config = node.config || {};
    const toolType = config.toolType || 'webhook';
    
    switch (toolType) {
      case 'webhook': {
        const url = config.url || '';
        const method = config.method || 'POST';
        const headers = config.headers || {};
        
        if (!url) {
          return { success: false, output: null, error: 'Webhook URL not configured' };
        }

        // Replace variables in URL
        let finalUrl = url;
        for (const [key, value] of Object.entries(context.variables)) {
          finalUrl = finalUrl.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        }

        const body = method !== 'GET' ? JSON.stringify({
          input: context.currentInput,
          variables: context.variables,
          outputs: context.outputs,
        }) : undefined;

        const response = await fetch(finalUrl, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body,
        });

        if (!response.ok) {
          return { success: false, output: null, error: `Webhook error: ${response.status}` };
        }

        const data = await response.json().catch(() => ({ status: 'ok' }));
        return { success: true, output: data };
      }
      
      case 'n8n_workflow':
      case 'n8n': {
        const workflowId = config.n8nWorkflowId || config.id || '';
        const webhookUrl = config.webhookUrl || config.n8nWebhookUrl || '';
        const workflowName = config.n8nWorkflowName || config.name || 'n8n Workflow';
        
        console.log(`Executing n8n workflow: ${workflowName} (${workflowId})`);
        console.log(`Webhook URL: ${webhookUrl}`);

        if (!webhookUrl) {
          return { success: false, output: null, error: 'n8n webhook URL not configured' };
        }

        try {
          // Call n8n webhook with workflow context
          const payload = {
            input: context.currentInput,
            variables: context.variables,
            outputs: context.outputs,
            workflowId,
            triggeredAt: new Date().toISOString(),
          };

          console.log(`Sending payload to n8n:`, JSON.stringify(payload, null, 2));

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          // n8n webhooks may return different response types
          let data: any;
          const contentType = response.headers.get('content-type') || '';
          
          if (contentType.includes('application/json')) {
            data = await response.json();
          } else {
            data = { message: await response.text(), status: response.status };
          }

          console.log(`n8n response:`, JSON.stringify(data, null, 2));

          if (!response.ok && response.status !== 200) {
            return { 
              success: false, 
              output: data, 
              error: `n8n webhook returned status ${response.status}` 
            };
          }

          return { 
            success: true, 
            output: {
              ...data,
              workflowId,
              workflowName,
              webhookUrl,
              executedAt: new Date().toISOString(),
            }
          };
        } catch (fetchError) {
          console.error('n8n webhook fetch error:', fetchError);
          return { 
            success: false, 
            output: null, 
            error: `Failed to call n8n webhook: ${String(fetchError)}` 
          };
        }
      }
      
      case 'http_request': {
        const url = config.url || '';
        const method = config.method || 'GET';
        
        if (!url) {
          return { success: false, output: null, error: 'HTTP URL not configured' };
        }

        const response = await fetch(url, { method });
        const data = await response.json().catch(() => response.text());
        
        return { success: true, output: data };
      }
      
      default:
        return { success: false, output: null, error: `Unknown tool type: ${toolType}` };
    }
  } catch (error) {
    console.error('Tool execution error:', error);
    return { success: false, output: null, error: String(error) };
  }
}

// Main workflow execution engine
async function executeWorkflow(
  supabase: any,
  workflowId: string,
  triggerData: any,
  userId: string
): Promise<{ success: boolean; result: any; error?: string; runId: string }> {
  
  // Create execution run record
  const { data: run, error: runError } = await supabase
    .from('ai_workflow_runs')
    .insert({
      workflow_id: workflowId,
      status: 'running',
      trigger_data: triggerData,
      execution_log: [],
    })
    .select()
    .single();

  if (runError || !run) {
    console.error('Failed to create run record:', runError);
    return { success: false, result: null, error: 'Failed to create execution record', runId: '' };
  }

  const runId = run.id;
  const executionLog: any[] = [];

  try {
    // Load workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('ai_workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (workflowError || !workflow) {
      throw new Error('Workflow not found');
    }

    // Load nodes
    const { data: nodes, error: nodesError } = await supabase
      .from('ai_workflow_nodes')
      .select('*')
      .eq('workflow_id', workflowId);

    if (nodesError || !nodes) {
      throw new Error('Failed to load workflow nodes');
    }

    // Load connections
    const { data: connections, error: connectionsError } = await supabase
      .from('ai_workflow_connections')
      .select('*')
      .eq('workflow_id', workflowId);

    if (connectionsError) {
      throw new Error('Failed to load workflow connections');
    }

    // Load agents for agent nodes
    const agentIds = nodes.filter((n: WorkflowNode) => n.agent_id).map((n: WorkflowNode) => n.agent_id);
    let agents: Record<string, Agent> = {};
    
    if (agentIds.length > 0) {
      const { data: agentsData } = await supabase
        .from('ai_agents')
        .select('*')
        .in('id', agentIds);
      
      if (agentsData) {
        agents = Object.fromEntries(agentsData.map((a: Agent) => [a.id, a]));
      }
    }

    // Initialize execution context
    const context: ExecutionContext = {
      variables: triggerData?.variables || {},
      outputs: {},
      currentInput: triggerData?.input || triggerData?.message || '',
      executionLog: [],
    };

    // Find trigger node (starting point)
    const triggerNode = nodes.find((n: WorkflowNode) => n.type === 'trigger');
    
    if (!triggerNode) {
      throw new Error('No trigger node found in workflow');
    }

    // Build adjacency list for traversal
    const adjacencyList: Record<string, { nodeId: string; connectionType: string }[]> = {};
    for (const conn of (connections || [])) {
      if (!adjacencyList[conn.source_node_id]) {
        adjacencyList[conn.source_node_id] = [];
      }
      adjacencyList[conn.source_node_id].push({
        nodeId: conn.target_node_id,
        connectionType: conn.connection_type || 'default',
      });
    }

    // Create node map for quick lookup
    const nodeMap: Record<string, WorkflowNode> = Object.fromEntries(
      nodes.map((n: WorkflowNode) => [n.id, n])
    );

    // Execute nodes using BFS traversal
    const queue: string[] = [triggerNode.id];
    const visited = new Set<string>();
    let lastOutput: any = context.currentInput;

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
      
      if (visited.has(currentNodeId)) {
        continue;
      }
      visited.add(currentNodeId);

      const currentNode = nodeMap[currentNodeId];
      if (!currentNode) {
        continue;
      }

      const logEntry: any = {
        nodeId: currentNodeId,
        nodeType: currentNode.type,
        timestamp: new Date().toISOString(),
        input: context.currentInput,
      };

      console.log(`Executing node: ${currentNode.type} (${currentNodeId})`);

      // Execute based on node type
      switch (currentNode.type) {
        case 'trigger': {
          // Trigger just passes through
          logEntry.output = context.currentInput;
          logEntry.status = 'success';
          
          // Add all connected nodes to queue
          const nextNodes = adjacencyList[currentNodeId] || [];
          for (const next of nextNodes) {
            queue.push(next.nodeId);
          }
          break;
        }

        case 'agent': {
          const agent = currentNode.agent_id ? agents[currentNode.agent_id] : null;
          
          if (!agent) {
            logEntry.status = 'error';
            logEntry.error = 'Agent not found';
          } else {
            const result = await executeAgentNode(currentNode, agent, context);
            
            logEntry.agentName = agent.name;
            logEntry.status = result.success ? 'success' : 'error';
            logEntry.output = result.output;
            logEntry.error = result.error;

            if (result.success) {
              context.currentInput = result.output;
              context.outputs[currentNodeId] = result.output;
              lastOutput = result.output;
              
              // Add connected nodes to queue
              const nextNodes = adjacencyList[currentNodeId] || [];
              for (const next of nextNodes) {
                queue.push(next.nodeId);
              }
            }
          }
          break;
        }

        case 'condition': {
          const result = executeConditionNode(currentNode, context);
          
          logEntry.status = result.success ? 'success' : 'error';
          logEntry.conditionResult = result.result;
          logEntry.error = result.error;

          if (result.success) {
            // Route based on condition result
            const nextNodes = adjacencyList[currentNodeId] || [];
            for (const next of nextNodes) {
              if (result.result && (next.connectionType === 'condition_true' || next.connectionType === 'default')) {
                queue.push(next.nodeId);
              } else if (!result.result && next.connectionType === 'condition_false') {
                queue.push(next.nodeId);
              }
            }
          }
          break;
        }

        case 'tool': {
          const result = await executeToolNode(currentNode, context);
          
          logEntry.status = result.success ? 'success' : 'error';
          logEntry.output = result.output;
          logEntry.error = result.error;

          if (result.success) {
            context.currentInput = result.output;
            context.outputs[currentNodeId] = result.output;
            lastOutput = result.output;
            
            // Add connected nodes to queue
            const nextNodes = adjacencyList[currentNodeId] || [];
            for (const next of nextNodes) {
              queue.push(next.nodeId);
            }
          }
          break;
        }

        case 'note': {
          // Notes are just documentation, skip
          logEntry.status = 'skipped';
          
          const nextNodes = adjacencyList[currentNodeId] || [];
          for (const next of nextNodes) {
            queue.push(next.nodeId);
          }
          break;
        }
      }

      executionLog.push(logEntry);

      // Update run with progress
      await supabase
        .from('ai_workflow_runs')
        .update({
          execution_log: executionLog,
        })
        .eq('id', runId);
    }

    // Mark as completed
    await supabase
      .from('ai_workflow_runs')
      .update({
        status: 'completed',
        result: { output: lastOutput, outputs: context.outputs },
        execution_log: executionLog,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return { success: true, result: lastOutput, runId };

  } catch (error) {
    console.error('Workflow execution error:', error);
    
    // Mark as failed
    await supabase
      .from('ai_workflow_runs')
      .update({
        status: 'failed',
        error: String(error),
        execution_log: executionLog,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    return { success: false, result: null, error: String(error), runId };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { workflowId, triggerData } = await req.json();

    if (!workflowId) {
      return new Response(JSON.stringify({ error: 'workflowId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Executing workflow: ${workflowId}`);
    console.log('Trigger data:', triggerData);

    const result = await executeWorkflow(supabase, workflowId, triggerData, user.id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in execute-workflow:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
