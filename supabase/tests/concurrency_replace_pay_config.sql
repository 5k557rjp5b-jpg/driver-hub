-- Concurrent replace_pay_configuration proof.
-- Creates a test user, seeds one active config, then issues two concurrent
-- replacements. Expectation: exactly one active configuration remains.

create extension if not exists dblink;

do $$
declare
  test_user uuid := '11111111-1111-1111-1111-111111111111';
  db_conn text := 'dbname=' || current_database() || ' user=postgres host=/var/run/postgresql';
  active_count integer;
  ignore_text text;
begin
  insert into auth.users (id) values (test_user)
  on conflict (id) do nothing;

  delete from public.pay_configurations where user_id = test_user;

  insert into public.pay_configurations (user_id, pay_model, rate_pence, paid_breaks_enabled)
  values (test_user, 'hourly', 1000, false);

  perform set_config('request.jwt.claim.sub', test_user::text, false);

  perform dblink_connect('conn_a', db_conn);
  perform dblink_connect('conn_b', db_conn);

  -- set_config returns text, so use dblink() not dblink_exec().
  select val into ignore_text from dblink(
    'conn_a',
    format('select set_config(''request.jwt.claim.sub'', %L, false)', test_user::text)
  ) as t(val text);
  select val into ignore_text from dblink(
    'conn_b',
    format('select set_config(''request.jwt.claim.sub'', %L, false)', test_user::text)
  ) as t(val text);

  perform dblink_send_query(
    'conn_a',
    format(
      'select id from replace_pay_configuration(%L::uuid, ''hourly''::pay_model, 1500, false)',
      test_user
    )
  );
  perform dblink_send_query(
    'conn_b',
    format(
      'select id from replace_pay_configuration(%L::uuid, ''hourly''::pay_model, 1600, false)',
      test_user
    )
  );

  begin
    perform * from dblink_get_result('conn_a') as t(id uuid);
  exception when others then
    raise notice 'conn_a result: %', sqlerrm;
  end;

  -- drain empty result status
  begin
    perform * from dblink_get_result('conn_a') as t(id uuid);
  exception when others then
    null;
  end;

  begin
    perform * from dblink_get_result('conn_b') as t(id uuid);
  exception when others then
    raise notice 'conn_b result: %', sqlerrm;
  end;

  begin
    perform * from dblink_get_result('conn_b') as t(id uuid);
  exception when others then
    null;
  end;

  perform dblink_disconnect('conn_a');
  perform dblink_disconnect('conn_b');

  select count(*) into active_count
  from public.pay_configurations
  where user_id = test_user and superseded_at is null;

  if active_count <> 1 then
    raise exception 'Expected exactly 1 active pay_configuration after concurrency test, found %', active_count;
  end if;

  raise notice 'Concurrency check passed: active_count=%', active_count;
end
$$;
