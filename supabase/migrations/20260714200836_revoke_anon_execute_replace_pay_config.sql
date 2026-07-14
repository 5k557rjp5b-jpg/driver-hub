-- Driver Hub — close anon execute gap on replace_pay_configuration
-- Applied directly to production (kfefxjhowtyrpmddlivw) on 2026-07-14.
-- `revoke all ... from public` (previous migration) does not remove a
-- privilege granted directly to a specific role. Supabase grants EXECUTE
-- to anon by default at function creation time, so an explicit revoke
-- was required to fully close this off.
revoke execute on function replace_pay_configuration(uuid, pay_model, integer, boolean) from anon;
