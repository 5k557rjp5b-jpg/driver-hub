-- Driver Hub — atomic pay configuration replacement
-- Already live on Supabase (applied directly on 2026-07-12).
-- Version control only — do not run against the existing database.

create or replace function replace_pay_configuration(
  p_user_id uuid,
  p_pay_model pay_model,
  p_rate_pence integer,
  p_paid_breaks_enabled boolean
) returns pay_configurations
language plpgsql
security definer
set search_path = public
as $$
declare
  new_config pay_configurations;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized to modify this user''s pay configuration';
  end if;

  update pay_configurations
  set superseded_at = now()
  where user_id = p_user_id and superseded_at is null;

  insert into pay_configurations (user_id, pay_model, rate_pence, paid_breaks_enabled, effective_from)
  values (p_user_id, p_pay_model, p_rate_pence, p_paid_breaks_enabled, now())
  returning * into new_config;

  return new_config;
end;
$$;
