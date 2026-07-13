-- Driver Hub — atomic pay configuration replacement
-- Already live on Supabase (applied directly on 2026-07-12).
-- Updated 2026-07-13: advisory lock for concurrency + SECURITY DEFINER grants.
--
-- For production: only apply via an approved migration path after explicit OK.
-- For fresh throwaway/local DBs: safe to run as part of the active chain.

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

  -- Serialize concurrent replacements for the same user so only one active
  -- configuration can be written (unique index remains the hard guarantee).
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  update pay_configurations
  set superseded_at = now()
  where user_id = p_user_id and superseded_at is null;

  insert into pay_configurations (user_id, pay_model, rate_pence, paid_breaks_enabled, effective_from)
  values (p_user_id, p_pay_model, p_rate_pence, p_paid_breaks_enabled, now())
  returning * into new_config;

  return new_config;
end;
$$;

revoke all on function replace_pay_configuration(uuid, pay_model, integer, boolean) from public;
grant execute on function replace_pay_configuration(uuid, pay_model, integer, boolean) to authenticated;
