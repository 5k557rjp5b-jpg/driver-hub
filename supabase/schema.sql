-- Driver Hub database schema for Supabase
-- Run this in the Supabase SQL editor after creating a project.

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists shifts_user_id_idx on public.shifts (user_id);
create index if not exists shifts_start_time_idx on public.shifts (start_time);

-- Only one active shift per user at a time
create unique index if not exists shifts_one_active_per_user_idx
  on public.shifts (user_id)
  where (end_time is null);

alter table public.shifts enable row level security;

create policy "Users can view own shifts"
  on public.shifts
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own shifts"
  on public.shifts
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own shifts"
  on public.shifts
  for update
  using (auth.uid() = user_id);

-- Wage / profile settings (one row per user)
create table if not exists public.wage_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  hourly_rate numeric(10, 2) not null default 0,
  overtime_rate numeric(10, 2) not null default 0,
  overtime_threshold_hours numeric(5, 2) not null default 8,
  currency text not null default 'GBP',
  updated_at timestamptz not null default now()
);

alter table public.wage_settings enable row level security;

create policy "Users can view own wage settings"
  on public.wage_settings
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own wage settings"
  on public.wage_settings
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own wage settings"
  on public.wage_settings
  for update
  using (auth.uid() = user_id);
