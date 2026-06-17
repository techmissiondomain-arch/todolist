-- ======================================================================
-- GeoTask AI — Supabase / PostgreSQL schema
-- ----------------------------------------------------------------------
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- It is SAFE to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).
--
-- Tables: profiles, saved_locations, tasks, location_triggers,
--         notification_logs
-- Security: Row Level Security (RLS) so every user only sees their OWN data.
-- ======================================================================

-- Helpful extension for UUID generation
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------
-- ENUM-like helper types
-- ----------------------------------------------------------------------
do $$ begin
  create type task_status   as enum ('open', 'done', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type trigger_type  as enum ('none', 'arrive', 'leave', 'nearby');
exception when duplicate_object then null; end $$;


-- ======================================================================
-- 1) PROFILES  (1 row per user; mirrors auth.users)
-- ======================================================================
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  full_name       text,
  avatar_url      text,
  -- user privacy / feature toggles
  location_enabled        boolean not null default true,
  background_location_ok  boolean not null default false,
  notifications_enabled   boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ======================================================================
-- 2) SAVED_LOCATIONS  (Home, Work, Supermarket, Pharmacy, ...)
-- ======================================================================
create table if not exists public.saved_locations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,            -- "Home", "Carrefour"
  address       text,
  latitude      double precision not null,
  longitude     double precision not null,
  radius_meters integer not null default 200,
  icon          text default 'place',     -- material icon name
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists saved_locations_user_idx on public.saved_locations(user_id);

-- ======================================================================
-- 3) TASKS
-- ======================================================================
create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,

  title             text not null,
  description       text,
  status            task_status   not null default 'open',
  priority          task_priority not null default 'medium',

  -- Location trigger fields (denormalized for fast geofence loading)
  trigger_type      trigger_type  not null default 'none',
  saved_location_id uuid references public.saved_locations(id) on delete set null,
  location_name     text,
  latitude          double precision,
  longitude         double precision,
  radius_meters     integer default 200,

  -- Time trigger (for "tomorrow at 10")
  due_date          timestamptz,

  -- Bookkeeping
  needs_location_confirmation boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  completed_at      timestamptz,
  last_triggered_at timestamptz
);
create index if not exists tasks_user_idx        on public.tasks(user_id);
create index if not exists tasks_user_status_idx on public.tasks(user_id, status);
create index if not exists tasks_geo_idx         on public.tasks(user_id, trigger_type)
  where trigger_type <> 'none';

-- ======================================================================
-- 4) LOCATION_TRIGGERS  (optional: many triggers per task in the future)
--    For the MVP a task carries its own trigger fields above, but this
--    table lets a single task fire at several places later (v2).
-- ======================================================================
create table if not exists public.location_triggers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  task_id       uuid not null references public.tasks(id) on delete cascade,
  trigger_type  trigger_type not null default 'arrive',
  latitude      double precision not null,
  longitude     double precision not null,
  radius_meters integer not null default 200,
  location_name text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  last_triggered_at timestamptz
);
create index if not exists location_triggers_task_idx on public.location_triggers(task_id);
create index if not exists location_triggers_user_idx on public.location_triggers(user_id);

-- ======================================================================
-- 5) NOTIFICATION_LOGS  (audit + duplicate-suppression history)
-- ======================================================================
create table if not exists public.notification_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  task_id       uuid references public.tasks(id) on delete set null,
  trigger_type  trigger_type,
  title         text,
  body          text,
  latitude      double precision,
  longitude     double precision,
  sent_at       timestamptz not null default now()
);
create index if not exists notification_logs_user_idx on public.notification_logs(user_id);
create index if not exists notification_logs_task_idx on public.notification_logs(task_id);


-- ======================================================================
-- updated_at auto-touch trigger
-- ======================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$ begin
  create trigger trg_profiles_touch        before update on public.profiles
    for each row execute function public.touch_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger trg_saved_locations_touch before update on public.saved_locations
    for each row execute function public.touch_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger trg_tasks_touch           before update on public.tasks
    for each row execute function public.touch_updated_at();
exception when duplicate_object then null; end $$;


-- ======================================================================
-- Auto-create a profile row whenever a new auth user signs up
-- ======================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

do $$ begin
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
exception when duplicate_object then null; end $$;


-- ======================================================================
-- ROW LEVEL SECURITY — each user can only touch their own rows
-- ======================================================================
alter table public.profiles          enable row level security;
alter table public.saved_locations   enable row level security;
alter table public.tasks             enable row level security;
alter table public.location_triggers enable row level security;
alter table public.notification_logs enable row level security;

-- profiles
drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- saved_locations
drop policy if exists "saved_locations self" on public.saved_locations;
create policy "saved_locations self" on public.saved_locations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tasks
drop policy if exists "tasks self" on public.tasks;
create policy "tasks self" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- location_triggers
drop policy if exists "location_triggers self" on public.location_triggers;
create policy "location_triggers self" on public.location_triggers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- notification_logs
drop policy if exists "notification_logs self" on public.notification_logs;
create policy "notification_logs self" on public.notification_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ======================================================================
-- REALTIME — let the app receive live task changes across devices.
-- (RLS still applies, so each client only receives its own rows.)
-- ======================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;

-- ======================================================================
-- Done. Next: deploy the Edge Function in supabase/functions/parse-task.
-- ======================================================================
