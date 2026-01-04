export interface RssTrigger {
  id: string;
  workspace_id: string;
  client_id: string | null;
  name: string;
  rss_url: string;
  is_active: boolean;
  target_column_id: string | null;
  platform: string | null;
  content_type: string | null;
  prompt_template: string | null;
  auto_generate_content: boolean;
  last_checked_at: string | null;
  last_item_guid: string | null;
  items_seen: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateRssTriggerInput {
  workspace_id: string;
  client_id?: string | null;
  name: string;
  rss_url: string;
  is_active?: boolean;
  target_column_id?: string | null;
  platform?: string | null;
  content_type?: string | null;
  prompt_template?: string | null;
  auto_generate_content?: boolean;
}

export interface UpdateRssTriggerInput {
  name?: string;
  rss_url?: string;
  is_active?: boolean;
  client_id?: string | null;
  target_column_id?: string | null;
  platform?: string | null;
  content_type?: string | null;
  prompt_template?: string | null;
  auto_generate_content?: boolean;
}

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RecurrenceConfig {
  type: RecurrenceType;
  days: string[];
  time: string | null;
  endDate: string | null;
}
