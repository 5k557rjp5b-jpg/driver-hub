-- Baseline markers for databases already applied manually on live
-- (kfefxjhowtyrpmddlivw). Use ONLY after confirming objects exist.
-- Initializes supabase_migrations.schema_migrations if missing, then records
-- the active migration chain as applied — does NOT run DDL.
--
-- DO NOT execute against production without explicit approval.

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text,
  inserted_at timestamptz not null default now()
);

insert into supabase_migrations.schema_migrations (version, name)
values
  ('20260710120000', '20260710120000_srs_data_v1'),
  ('20260712100000', '20260712100000_rls_with_check_fix'),
  ('20260712110000', '20260712110000_replace_pay_config_fn')
on conflict (version) do nothing;
