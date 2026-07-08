-- Milestone 2 migration for existing Driver Hub databases.
-- Run this if you already applied the original schema.sql.

alter table public.shifts
  add column if not exists notes text;

create unique index if not exists shifts_one_active_per_user_idx
  on public.shifts (user_id)
  where (end_time is null);

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
