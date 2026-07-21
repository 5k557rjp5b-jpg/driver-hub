-- Read-only schema inventory for comparing local throwaway vs production.
-- Run against each DB and diff outputs.

select 'enums' as kind, t.typname as name, e.enumlabel as detail
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
order by t.typname, e.enumsortorder;

select 'tables' as kind, table_name as name, '' as detail
from information_schema.tables
where table_schema = 'public'
order by table_name;

select 'columns' as kind,
  table_name || '.' || column_name as name,
  data_type || coalesce(' ' || udt_name, '') as detail
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

select 'indexes' as kind, indexname as name, indexdef as detail
from pg_indexes
where schemaname = 'public'
order by indexname;

select 'policies' as kind,
  schemaname || '.' || tablename || ':' || policyname as name,
  cmd || ' roles=' || array_to_string(roles, ',') as detail
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select 'functions' as kind, p.proname as name, pg_get_function_identity_arguments(p.oid) as detail
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;
