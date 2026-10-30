-- ============================================================================
-- Sage — core schema, Row Level Security, storage and gamification logic
-- Apply with:  supabase db push      (or paste into the Supabase SQL editor)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. profiles
-- ----------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  display_name          text check (display_name is null or char_length(display_name) <= 60),
  preferred_language    text not null default 'en' check (char_length(preferred_language) between 2 and 10),
  style_preferences     text[] not null default '{}',
  preferred_colors      text[] not null default '{}',
  preferred_occasions   text[] not null default '{}',
  preferred_categories  text[] not null default '{}',
  shopping_preferences  text[] not null default '{}',
  budget_preference     text check (budget_preference is null or budget_preference in ('budget','mid','premium','flexible')),
  sizes                 jsonb not null default '{}'::jsonb,
  location_city         text check (location_city is null or char_length(location_city) <= 120),
  location_lat          numeric(6,2) check (location_lat is null or location_lat between -90 and 90),
  location_lon          numeric(6,2) check (location_lon is null or location_lon between -180 and 180),
  weather_enabled       boolean not null default false,
  ai_share_wardrobe     boolean not null default true,
  onboarding_completed  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. wardrobe_items
-- ----------------------------------------------------------------------------
create table public.wardrobe_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 80),
  category        text not null check (category in
                    ('tops','trousers','jeans','jackets','coats','shoes','bags','accessories','dresses','other')),
  color           text check (color is null or char_length(color) <= 40),
  season          text not null default 'all' check (season in ('all','spring','summer','autumn','winter')),
  style_tags      text[] not null default '{}',
  image_path      text check (image_path is null or image_path like user_id::text || '/%'),
  brand           text check (brand is null or char_length(brand) <= 60),
  purchase_price  numeric(10,2) check (purchase_price is null or purchase_price >= 0),
  notes           text check (notes is null or char_length(notes) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index wardrobe_items_user_idx on public.wardrobe_items (user_id, category);
create trigger wardrobe_items_updated before update on public.wardrobe_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. conversations / 4. messages
-- ----------------------------------------------------------------------------
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default 'New conversation' check (char_length(title) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index conversations_user_idx on public.conversations (user_id, updated_at desc);
create trigger conversations_updated before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             text not null check (role in ('user','assistant')),
  content          text not null check (char_length(content) <= 8000),
  structured       jsonb,
  created_at       timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_user_day_idx on public.messages (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 5. outfits / 6. saved_outfits
-- ----------------------------------------------------------------------------
create table public.outfits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  occasion     text check (occasion is null or char_length(occasion) <= 80),
  style        text check (style is null or char_length(style) <= 60),
  outfit_data  jsonb not null,
  image_path   text check (image_path is null or image_path like user_id::text || '/%'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index outfits_user_idx on public.outfits (user_id, created_at desc);
create trigger outfits_updated before update on public.outfits
  for each row execute function public.set_updated_at();

create table public.saved_outfits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  outfit_id    uuid not null references public.outfits (id) on delete cascade,
  is_favorite  boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (user_id, outfit_id)
);
create index saved_outfits_user_idx on public.saved_outfits (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 7. user_progress
-- ----------------------------------------------------------------------------
create table public.user_progress (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  total_xp            integer not null default 0 check (total_xp >= 0),
  level               integer not null default 1 check (level >= 1),
  current_streak      integer not null default 0 check (current_streak >= 0),
  longest_streak      integer not null default 0 check (longest_streak >= 0),
  last_activity_date  date,
  updated_at          timestamptz not null default now()
);
create trigger user_progress_updated before update on public.user_progress
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. quests / 9. quest_completions
-- ----------------------------------------------------------------------------
create table public.quests (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  description  text not null,
  quest_type   text not null default 'daily' check (quest_type in ('daily','once')),
  verifier     text not null,
  xp_reward    integer not null check (xp_reward between 1 and 200),
  active       boolean not null default true
);

create table public.quest_completions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  quest_id         uuid not null references public.quests (id) on delete cascade,
  completion_date  date not null default ((now() at time zone 'utc')::date),
  period_key       text not null,           -- 'once' for one-time quests, the ISO date for daily quests
  xp_awarded       integer not null check (xp_awarded >= 0),
  created_at       timestamptz not null default now(),
  unique (user_id, quest_id, period_key)    -- idempotency: no duplicate XP
);
create index quest_completions_user_idx on public.quest_completions (user_id, completion_date desc);

-- ----------------------------------------------------------------------------
-- 10. achievements / 11. user_achievements
-- ----------------------------------------------------------------------------
create table public.achievements (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  description  text not null,
  icon         text not null default 'sparkles',
  xp_reward    integer not null default 0 check (xp_reward >= 0)
);

create table public.user_achievements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  achievement_id  uuid not null references public.achievements (id) on delete cascade,
  earned_at       timestamptz not null default now(),
  unique (user_id, achievement_id)
);

-- ----------------------------------------------------------------------------
-- Seed data
-- ----------------------------------------------------------------------------
insert into public.quests (slug, title, description, quest_type, verifier, xp_reward) values
  ('complete_profile', 'Finish your style profile', 'Complete onboarding so Sage can personalise advice.', 'once',  'onboarding_done',      30),
  ('ask_stylist',      'Ask your stylist a question', 'Send Sage a message about what to wear.',          'daily', 'asked_stylist_today',  10),
  ('outfit_suggested', 'Discover a new look',        'Get an outfit idea from Sage today.',               'daily', 'outfit_suggested_today', 15),
  ('save_outfit',      'Save an outfit you love',    'Save one outfit today.',                            'daily', 'outfit_saved_today',   15),
  ('wardrobe_3',       'Add three pieces to your wardrobe', 'Build your digital closet to at least three items.', 'once', 'wardrobe_3', 20),
  ('wardrobe_outfit',  'Style what you already own', 'Create an outfit from your own wardrobe.',          'daily', 'wardrobe_outfit_today', 20),
  ('learn_tip',        'Learn one styling tip',      'Read today''s tip and take it in.',                 'daily', 'none',                  5)
on conflict (slug) do nothing;

insert into public.achievements (code, name, description, icon, xp_reward) values
  ('first_steps',   'First steps',      'Finished your style profile.',           'footprints', 10),
  ('first_save',    'Keeper',           'Saved your first outfit.',               'heart',      10),
  ('closet_starter','Closet starter',   'Added five pieces to your wardrobe.',    'shirt',      20),
  ('chatty',        'Style chat',       'Sent five messages to your stylist.',    'message-circle', 10),
  ('streak_3',      'Three-day glow',   'Were active three days in a row.',       'flame',      20),
  ('level_3',       'Level 3',          'Reached level 3.',                       'trophy',     0)
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- New-user bootstrap
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_progress (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.wardrobe_items    enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;
alter table public.outfits           enable row level security;
alter table public.saved_outfits     enable row level security;
alter table public.user_progress     enable row level security;
alter table public.quests            enable row level security;
alter table public.quest_completions enable row level security;
alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- wardrobe_items
create policy wardrobe_select_own on public.wardrobe_items for select to authenticated using (user_id = auth.uid());
create policy wardrobe_insert_own on public.wardrobe_items for insert to authenticated with check (user_id = auth.uid());
create policy wardrobe_update_own on public.wardrobe_items for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wardrobe_delete_own on public.wardrobe_items for delete to authenticated using (user_id = auth.uid());

-- conversations
create policy conv_select_own on public.conversations for select to authenticated using (user_id = auth.uid());
create policy conv_insert_own on public.conversations for insert to authenticated with check (user_id = auth.uid());
create policy conv_update_own on public.conversations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy conv_delete_own on public.conversations for delete to authenticated using (user_id = auth.uid());

-- messages: ownership of BOTH the row and the parent conversation is enforced
create policy messages_select_own on public.messages for select to authenticated using (user_id = auth.uid());
create policy messages_insert_own on public.messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );
create policy messages_delete_own on public.messages for delete to authenticated using (user_id = auth.uid());

-- outfits
create policy outfits_select_own on public.outfits for select to authenticated using (user_id = auth.uid());
create policy outfits_insert_own on public.outfits for insert to authenticated with check (user_id = auth.uid());
create policy outfits_update_own on public.outfits for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy outfits_delete_own on public.outfits for delete to authenticated using (user_id = auth.uid());

-- saved_outfits: the referenced outfit must also belong to the caller
create policy saved_select_own on public.saved_outfits for select to authenticated using (user_id = auth.uid());
create policy saved_insert_own on public.saved_outfits for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.outfits o where o.id = outfit_id and o.user_id = auth.uid())
  );
create policy saved_update_own on public.saved_outfits for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saved_delete_own on public.saved_outfits for delete to authenticated using (user_id = auth.uid());

-- Gamification tables are READ-ONLY for clients. All writes go through
-- public.complete_quest() (security definer), so XP cannot be forged.
create policy progress_select_own on public.user_progress for select to authenticated using (user_id = auth.uid());
create policy quests_select_active on public.quests for select to authenticated using (active);
create policy completions_select_own on public.quest_completions for select to authenticated using (user_id = auth.uid());
create policy achievements_select_all on public.achievements for select to authenticated using (true);
create policy user_ach_select_own on public.user_achievements for select to authenticated using (user_id = auth.uid());

-- Belt and braces: remove any default write grants on server-managed tables.
revoke insert, update, delete on public.user_progress, public.quest_completions,
  public.user_achievements, public.quests, public.achievements from anon, authenticated;
revoke all on all tables in schema public from anon;

-- ----------------------------------------------------------------------------
-- Gamification: complete_quest(slug)
--   * verifies server-side that the real-world action happened
--   * idempotent: unique(user_id, quest_id, period_key)
--   * non-punitive streaks: a missed day restarts the current streak at 1 but
--     longest_streak is never reduced and no XP is ever removed.
--   * dates use UTC.
-- ----------------------------------------------------------------------------
create or replace function public.complete_quest(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_today     date := (now() at time zone 'utc')::date;
  v_day_start timestamptz := (v_today::timestamp at time zone 'utc');
  q           public.quests%rowtype;
  ach         public.achievements%rowtype;
  prog        public.user_progress%rowtype;
  v_ok        boolean := false;
  v_met       boolean;
  v_period    text;
  v_inserted  uuid;
  v_inserted_a uuid;
  v_streak    int;
  v_total     int;
  v_xp_gain   int := 0;
  v_new_ach   jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into q from public.quests where slug = p_slug and active;
  if not found then
    return jsonb_build_object('awarded', false, 'reason', 'unknown_quest');
  end if;

  v_ok := case q.verifier
    when 'onboarding_done' then
      exists (select 1 from public.profiles where id = v_uid and onboarding_completed)
    when 'asked_stylist_today' then
      exists (select 1 from public.messages where user_id = v_uid and role = 'user' and created_at >= v_day_start)
    when 'outfit_suggested_today' then
      exists (select 1 from public.messages
              where user_id = v_uid and role = 'assistant' and created_at >= v_day_start
                and structured is not null
                and jsonb_typeof(structured->'outfits') = 'array'
                and jsonb_array_length(structured->'outfits') > 0)
    when 'outfit_saved_today' then
      exists (select 1 from public.saved_outfits where user_id = v_uid and created_at >= v_day_start)
    when 'wardrobe_3' then
      (select count(*) from public.wardrobe_items where user_id = v_uid) >= 3
    when 'wardrobe_outfit_today' then
      exists (select 1 from public.outfits
              where user_id = v_uid and created_at >= v_day_start
                and outfit_data->'pieces' @> '[{"fromWardrobe": true}]'::jsonb)
    when 'none' then true
    else false
  end;

  if not v_ok then
    return jsonb_build_object('awarded', false, 'reason', 'requirements_not_met');
  end if;

  v_period := case q.quest_type when 'once' then 'once' else v_today::text end;

  insert into public.quest_completions (user_id, quest_id, completion_date, period_key, xp_awarded)
  values (v_uid, q.id, v_today, v_period, q.xp_reward)
  on conflict (user_id, quest_id, period_key) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return jsonb_build_object('awarded', false, 'reason', 'already_completed');
  end if;

  insert into public.user_progress (user_id) values (v_uid) on conflict do nothing;
  select * into prog from public.user_progress where user_id = v_uid for update;

  -- streak
  if prog.last_activity_date = v_today then
    v_streak := greatest(prog.current_streak, 1);
  elsif prog.last_activity_date = v_today - 1 then
    v_streak := prog.current_streak + 1;
  else
    v_streak := 1;
  end if;

  v_total   := prog.total_xp + q.xp_reward;
  v_xp_gain := q.xp_reward;

  update public.user_progress
     set total_xp = v_total,
         current_streak = v_streak,
         longest_streak = greatest(prog.longest_streak, v_streak),
         last_activity_date = v_today,
         level = 1 + (v_total / 100)
   where user_id = v_uid;

  -- achievements
  for ach in
    select a.* from public.achievements a
    where not exists (select 1 from public.user_achievements ua
                      where ua.user_id = v_uid and ua.achievement_id = a.id)
  loop
    v_met := case ach.code
      when 'first_steps'    then exists (select 1 from public.profiles where id = v_uid and onboarding_completed)
      when 'first_save'     then exists (select 1 from public.saved_outfits where user_id = v_uid)
      when 'closet_starter' then (select count(*) from public.wardrobe_items where user_id = v_uid) >= 5
      when 'chatty'         then (select count(*) from public.messages where user_id = v_uid and role = 'user') >= 5
      when 'streak_3'       then v_streak >= 3
      when 'level_3'        then (1 + (v_total / 100)) >= 3
      else false
    end;

    if v_met then
      insert into public.user_achievements (user_id, achievement_id)
      values (v_uid, ach.id)
      on conflict (user_id, achievement_id) do nothing
      returning id into v_inserted_a;

      if v_inserted_a is not null then
        v_total   := v_total + ach.xp_reward;
        v_xp_gain := v_xp_gain + ach.xp_reward;
        v_new_ach := v_new_ach || jsonb_build_object('code', ach.code, 'name', ach.name, 'icon', ach.icon);
        v_inserted_a := null;
      end if;
    end if;
  end loop;

  update public.user_progress
     set total_xp = v_total, level = 1 + (v_total / 100)
   where user_id = v_uid;

  return jsonb_build_object(
    'awarded', true,
    'quest', q.slug,
    'xp', q.xp_reward,
    'xp_total_gain', v_xp_gain,
    'total_xp', v_total,
    'level', 1 + (v_total / 100),
    'streak', v_streak,
    'new_achievements', v_new_ach
  );
end;
$$;

revoke all on function public.complete_quest(text) from public, anon;
grant execute on function public.complete_quest(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Storage: private bucket for wardrobe photos. Objects live under "<user_id>/…"
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe', 'wardrobe', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy wardrobe_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy wardrobe_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy wardrobe_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy wardrobe_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
