export type ScheduleType = "daily" | "weekly" | "monthly" | "custom";

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export type ActionType = "save_to_db" | "send_email" | "webhook" | "save_to_file";

export interface DataSource {
  id: string;
  type: "api" | "webhook" | "rss" | "custom";
  name: string;
  url?: string;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string;
}

export interface AutomationAction {
  id: string;
  type: ActionType;
  config: Record<string, any>;
}

export interface Automation {
  id: string;
  client_id: string;
  name: string;
  description?: string;
  prompt: string;
  schedule_type: ScheduleType;
  schedule_config: Record<string, any>;
  schedule_days?: DayOfWeek[];
  schedule_time?: string;
  data_sources?: DataSource[];
  actions?: AutomationAction[];
  webhook_url?: string;
  email_recipients?: string[];
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
