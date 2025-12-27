export type AutomationNodeType = 
  | 'trigger_rss' 
  | 'trigger_webhook' 
  | 'trigger_schedule' 
  | 'trigger_api'
  | 'ai_process'
  | 'condition'
  | 'action_publish'
  | 'action_webhook'
  | 'action_email'
  | 'action_n8n'
  | 'note';

export interface AutomationNodeConfig {
  label?: string;
  description?: string;
  // Trigger configs
  rss_url?: string;
  webhook_url?: string;
  schedule_cron?: string;
  api_url?: string;
  api_method?: 'GET' | 'POST';
  // AI configs
  ai_prompt?: string;
  ai_model?: string;
  // Condition configs
  condition_expression?: string;
  // Publish configs
  publish_platform?: 'twitter' | 'linkedin' | 'instagram';
  publish_mode?: 'direct' | 'draft';
  // n8n configs
  n8n_workflow_id?: string;
  n8n_webhook_url?: string;
  // Email configs
  email_recipients?: string[];
  email_subject?: string;
  [key: string]: any;
}

export interface AutomationFlowNode {
  id: string;
  type: AutomationNodeType;
  config: AutomationNodeConfig;
  position_x: number;
  position_y: number;
}

export interface AutomationFlowConnection {
  id: string;
  source_node_id: string;
  target_node_id: string;
  connection_type?: 'default' | 'condition_true' | 'condition_false';
  label?: string;
}

export interface AutomationFlow {
  nodes: AutomationFlowNode[];
  connections: AutomationFlowConnection[];
}
