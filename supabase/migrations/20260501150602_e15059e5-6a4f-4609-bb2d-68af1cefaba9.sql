create table if not exists public.webhook_events_log (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'late',
  event_type text not null,
  payload jsonb,
  processed_ok boolean not null default true,
  error_message text,
  related_planning_item_id uuid,
  related_client_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_events_log_created_at on public.webhook_events_log (created_at desc);
create index if not exists idx_webhook_events_log_source_event on public.webhook_events_log (source, event_type);

alter table public.webhook_events_log enable row level security;

create policy "authenticated can read webhook events"
on public.webhook_events_log
for select
to authenticated
using (true);