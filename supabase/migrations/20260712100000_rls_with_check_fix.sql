-- Driver Hub — RLS UPDATE policy WITH CHECK fix (idempotent)
--
-- The base migration 20260710120000_srs_data_v1.sql already creates UPDATE
-- policies WITH CHECK. This file is kept for:
--   1) Databases that received SRS-DATA before WITH CHECK was added
--   2) Idempotent re-application on fresh installs (drop + recreate)
--
-- Already applied live — when initializing migration history on production,
-- mark as applied rather than re-running unless policies are confirmed missing.

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile" on public.user_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can update own pay configurations" on public.pay_configurations;
create policy "Users can update own pay configurations" on public.pay_configurations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can update own shifts" on public.shifts;
create policy "Users can update own shifts" on public.shifts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can update own breaks" on public.breaks;
create policy "Users can update own breaks" on public.breaks
  for update using (exists (
    select 1 from public.shifts where shifts.id = breaks.shift_id and shifts.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.shifts where shifts.id = breaks.shift_id and shifts.user_id = auth.uid()
  ));

drop policy if exists "Users can update own earnings adjustments" on public.earnings_adjustments;
create policy "Users can update own earnings adjustments" on public.earnings_adjustments
  for update using (exists (
    select 1 from public.shifts where shifts.id = earnings_adjustments.shift_id and shifts.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.shifts where shifts.id = earnings_adjustments.shift_id and shifts.user_id = auth.uid()
  ));

drop policy if exists "Users can update own earnings summaries" on public.earnings_summaries;
create policy "Users can update own earnings summaries" on public.earnings_summaries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can update own sync operations" on public.sync_operations;
create policy "Users can update own sync operations" on public.sync_operations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
