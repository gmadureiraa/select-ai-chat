export type NodeType = 'trigger' | 'agent' | 'condition' | 'tool' | 'note';
export type TriggerType = 'user_message' | 'webhook' | 'schedule' | 'manual' | 'event';
export type ConnectionType = 'default' | 'ai_connection' | 'condition_true' | 'condition_false';
export type WorkflowRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AIAgent {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  system_prompt: string;
  model: string;
  temperature: number;
  tools: AgentTool[];
  knowledge: string[];
  variables: Record<string, any>;
  memory_enabled: boolean;
  escalation_agent_id?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AgentTool {
  id: string;
  name: string;
  type: 'api' | 'n8n' | 'function' | 'webhook';
  config: Record<string, any>;
  description?: string;
}

export interface AIWorkflow {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  trigger_config: TriggerConfig;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TriggerConfig {
  type: TriggerType;
  schedule?: string;
  webhook_url?: string;
  event_name?: string;
}

export interface AIWorkflowNode {
  id: string;
  workflow_id: string;
  type: NodeType;
  agent_id?: string;
  config: NodeConfig;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface NodeConfig {
  label?: string;
  description?: string;
  trigger_type?: TriggerType;
  condition?: string;
  tool_config?: AgentTool;
  note_content?: string;
  [key: string]: any;
}

export interface AIWorkflowConnection {
  id: string;
  workflow_id: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: ConnectionType;
  label?: string;
  created_at: string;
}

export interface AIWorkflowRun {
  id: string;
  workflow_id: string;
  status: WorkflowRunStatus;
  trigger_data?: Record<string, any>;
  execution_log: ExecutionLogEntry[];
  result?: Record<string, any>;
  error?: string;
  started_at: string;
  completed_at?: string;
}

export interface ExecutionLogEntry {
  node_id: string;
  node_type: NodeType;
  timestamp: string;
  input?: any;
  output?: any;
  duration_ms?: number;
  error?: string;
}

// React Flow types
export interface WorkflowNodeData {
  label: string;
  type: NodeType;
  agent?: AIAgent;
  config: NodeConfig;
}

export interface WorkflowEdgeData {
  connection_type: ConnectionType;
  label?: string;
}
