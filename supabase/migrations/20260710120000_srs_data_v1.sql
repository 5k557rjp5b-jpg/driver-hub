-- Driver Hub — SRS-DATA v1.0 schema
-- Reconstructed from the live Supabase project (kfefxjhowtyrpmddlivw) on
-- 2026-07-12, verified column-by-column, constraint-by-constraint, and
-- policy-by-policy against information_schema / pg_catalog. This file did
-- not previously exist in version control; it is being added retroactively
-- so the schema is reproducible from a fresh clone.
--
-- If you still have the original migration file from 2026-07-10 (e.g. via
-- `supabase db pull` or the dashboard), prefer that one and treat this as a
-- cross-check instead.
--
-- Pre-launch / empty DB note (verified 2026-07-13):
-- auth.users, shifts, and pay_configurations were empty; wage_settings did not
-- exist. Safe to drop legacy Milestone 2 objects with no data migration.

-- ============================================================================
-- Legacy cleanup (pre–SRS-DATA Milestone 2)
-- ============================================================================

drop table if exists public.wage_settings cascade;

-- ============================================================================
-- Enums
-- ============================================================================

create type auth_provider as enum ('apple', 'google', 'email');
create type employment_type as enum ('employed', 'self_employed');
create type pay_model as enum ('hourly', 'fixed_shift', 'per_drop', 'per_stop', 'manual');
create type shift_status as enum ('active', 'completed', 'needs_review');
create type adjustment_type as enum ('bonus', 'deduction');
create type period_type as enum ('daily', 'weekly', 'monthly');
create type sync_entity_type as enum ('shift', 'break', 'earnings_adjustment', 'pay_configuration');
create type sync_operation_type as enum ('create', 'update');
create type sync_status as enum ('pending', 'synced', 'conflict');

-- ============================================================================
-- Tables
-- ============================================================================

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  auth_provider auth_provider not null,
  email text not null,
  employment_type employment_type not null,
  created_at timestamptz not null default now(),
  deletion_requested_at timestamptz
);

create table public.pay_configurations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pay_model pay_model not null,
  rate_pence integer,
  paid_breaks_enabled boolean not null default false,
  effective_from timestamptz not null default now(),
  superseded_at timestamptz,
  constraint rate_pence_positive_if_present check (rate_pence is null or rate_pence > 0)
);

create unique index pay_configurations_one_active_per_user_idx
  on public.pay_configurations (user_id)
  where (superseded_at is null);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pay_configuration_id uuid not null references public.pay_configurations(id),
  start_time timestamptz not null,
  end_time timestamptz,
  status shift_status not null default 'active',
  drop_count integer,
  stop_count integer,
  manual_earnings_pence integer,
  base_pay_pence integer,
  final_earnings_pence integer,
  notes text,
  updated_at timestamptz not null default now(),
  constraint end_after_start check (end_time is null or end_time >= start_time),
  constraint drop_count_non_negative check (drop_count is null or drop_count >= 0),
  constraint stop_count_non_negative check (stop_count is null or stop_count >= 0),
  constraint manual_earnings_non_negative check (manual_earnings_pence is null or manual_earnings_pence >= 0),
  constraint notes_length check (char_length(notes) <= 1000)
);

create unique index shifts_one_active_per_user_idx
  on public.shifts (user_id)
  where (end_time is null);

create table public.breaks (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz,
  is_paid boolean not null default false
);

create table public.earnings_adjustments (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  type adjustment_type not null,
  label text not null,
  amount_pence integer not null,
  constraint amount_positive check (amount_pence > 0),
  constraint label_not_empty check (char_length(label) > 0 and char_length(label) <= 60)
);

create table public.earnings_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type period_type not null,
  period_start date not null,
  total_earnings_pence integer not null,
  shift_count integer not null,
  recomputed_at timestamptz not null default now(),
  constraint total_earnings_non_negative check (total_earnings_pence >= 0),
  constraint shift_count_non_negative check (shift_count >= 0)
);

create table public.sync_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type sync_entity_type not null,
  entity_id uuid not null,
  operation sync_operation_type not null,
  payload jsonb not null,
  queued_at timestamptz not null default now(),
  status sync_status not null default 'pending'
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- NOTE: UPDATE policies below include WITH CHECK, fixing a gap found in the
-- live policies during review (previously WITH CHECK was null on every
-- UPDATE policy, meaning a user could update a row they own but change its
-- user_id/ownership field to someone else's). If applying this file against
-- a database that already has these tables/policies, see the companion file
-- 20260712_rls_with_check_fix.sql instead, which only patches the existing
-- policies without recreating the tables.

alter table public.user_profiles enable row level security;
alter table public.pay_configurations enable row level security;
alter table public.shifts enable row level security;
alter table public.breaks enable row level security;
alter table public.earnings_adjustments enable row level security;
alter table public.earnings_summaries enable row level security;
alter table public.sync_operations enable row level security;

create policy "Users can view own profile" on public.user_profiles
  for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.user_profiles
  for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.user_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users can view own pay configurations" on public.pay_configurations
  for select using (auth.uid() = user_id);
create policy "Users can insert own pay configurations" on public.pay_configurations
  for insert with check (auth.uid() = user_id);
create policy "Users can update own pay configurations" on public.pay_configurations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can view own shifts" on public.shifts
  for select using (auth.uid() = user_id);
create policy "Users can insert own shifts" on public.shifts
  for insert with check (auth.uid() = user_id);
create policy "Users can update own shifts" on public.shifts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can view own breaks" on public.breaks
  for select using (exists (
    select 1 from public.shifts where shifts.id = breaks.shift_id and shifts.user_id = auth.uid()
  ));
create policy "Users can insert own breaks" on public.breaks
  for insert with check (exists (
    select 1 from public.shifts where shifts.id = breaks.shift_id and shifts.user_id = auth.uid()
  ));
create policy "Users can update own breaks" on public.breaks
  for update using (exists (
    select 1 from public.shifts where shifts.id = breaks.shift_id and shifts.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.shifts where shifts.id = breaks.shift_id and shifts.user_id = auth.uid()
  ));

create policy "Users can view own earnings adjustments" on public.earnings_adjustments
  for select using (exists (
    select 1 from public.shifts where shifts.id = earnings_adjustments.shift_id and shifts.user_id = auth.uid()
  ));
create policy "Users can insert own earnings adjustments" on public.earnings_adjustments
  for insert with check (exists (
    select 1 from public.shifts where shifts.id = earnings_adjustments.shift_id and shifts.user_id = auth.uid()
  ));
create policy "Users can update own earnings adjustments" on public.earnings_adjustments
  for update using (exists (
    select 1 from public.shifts where shifts.id = earnings_adjustments.shift_id and shifts.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.shifts where shifts.id = earnings_adjustments.shift_id and shifts.user_id = auth.uid()
  ));

create policy "Users can view own earnings summaries" on public.earnings_summaries
  for select using (auth.uid() = user_id);
create policy "Users can insert own earnings summaries" on public.earnings_summaries
  for insert with check (auth.uid() = user_id);
create policy "Users can update own earnings summaries" on public.earnings_summaries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can view own sync operations" on public.sync_operations
  for select using (auth.uid() = user_id);
create policy "Users can insert own sync operations" on public.sync_operations
  for insert with check (auth.uid() = user_id);
create policy "Users can update own sync operations" on public.sync_operations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
