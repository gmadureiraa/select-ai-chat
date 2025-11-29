export type ScheduleType = "daily" | "weekly" | "monthly" | "custom";

export interface Automation {
  id: string;
  client_id: string;
  name: string;
  description?: string;
  prompt: string;
  schedule_type: ScheduleType;
  schedule_config: Record<string, any>;
  is_active: boolean;
  model: string;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  automation_id: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
}

export interface AutomationWithClient extends Automation {
  clients: {
    id: string;
    name: string;
    description?: string;
  };
}
