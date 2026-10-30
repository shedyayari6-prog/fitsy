-- ============================================================================
-- Sage — notification preferences and web-push subscriptions
-- Apply AFTER 20261027000001_schema.sql
-- ============================================================================

create table public.notification_prefs (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  daily_reminder   boolean  not null default false,
  weekly_summary   boolean  not null default false,
  push_enabled     boolean  not null default false,
  email_enabled    boolean  not null default false,
  reminder_hour    smallint not null default 18 check (reminder_hour between 0 and 23),
  timezone         text     not null default 'UTC' check (char_length(timezone) between 1 and 64),
  last_daily_sent  date,
  last_weekly_sent date,
  last_test_at     timestamptz,
  updated_at       timestamptz not null default now()
);
create trigger notification_prefs_updated before update on public.notification_prefs
  for each row execute function public.set_updated_at();

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null check (char_length(endpoint) <= 2048),
  p256dh      text not null check (char_length(p256dh) <= 256),
  auth        text not null check (char_length(auth) <= 128),
  user_agent  text check (user_agent is null or char_length(user_agent) <= 300),
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.notification_prefs  enable row level security;
alter table public.push_subscriptions  enable row level security;

create policy prefs_select_own on public.notification_prefs for select to authenticated using (user_id = auth.uid());
create policy prefs_insert_own on public.notification_prefs for insert to authenticated with check (user_id = auth.uid());
create policy prefs_update_own on public.notification_prefs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_select_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_insert_own on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy push_delete_own on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

revoke all on public.notification_prefs, public.push_subscriptions from anon;
