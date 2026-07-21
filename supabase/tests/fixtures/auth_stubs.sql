-- Auth stubs for local / throwaway Postgres (NOT for Supabase production).
-- Mirrors the minimum surfaces the SRS-DATA schema and RPC need:
--   auth.users (FK target)
--   auth.uid() (RLS + SECURITY DEFINER authorization)

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Role used by GRANT EXECUTE ... TO authenticated in the RPC migration.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end
$$;
