-- Driver Hub database schema for Supabase
-- Run this in the Supabase SQL editor after creating a project.

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shifts_user_id_idx on public.shifts (user_id);
create index if not exists shifts_start_time_idx on public.shifts (start_time);

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
