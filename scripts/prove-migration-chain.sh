#!/usr/bin/env bash
# Prove the migration chain on a fresh local throwaway database.
# Also runs concurrency checks for replace_pay_configuration().

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_NAME="${THROWAWAY_DB_NAME:-driver_hub_migrate_test}"

echo "==> Recreating throwaway database: $DB_NAME"
sudo -u postgres dropdb --if-exists "$DB_NAME"
sudo -u postgres createdb "$DB_NAME"

run_as_postgres() {
  sudo -u postgres env DATABASE_URL="postgresql:///$DB_NAME?host=/var/run/postgresql" "$@"
}

echo "==> Migrating from empty..."
run_as_postgres bash scripts/db-migrate-local.sh

echo "==> Verifying core objects..."
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS dblink;

DO $$
BEGIN
  IF to_regclass('public.wage_settings') IS NOT NULL THEN
    RAISE EXCEPTION 'wage_settings should not exist after SRS-DATA migration';
  END IF;

  IF to_regclass('public.pay_configurations') IS NULL THEN
    RAISE EXCEPTION 'pay_configurations missing';
  END IF;

  IF to_regclass('public.shifts') IS NULL THEN
    RAISE EXCEPTION 'shifts missing';
  END IF;

  IF to_regprocedure('public.replace_pay_configuration(uuid, pay_model, integer, boolean)') IS NULL THEN
    RAISE EXCEPTION 'replace_pay_configuration missing';
  END IF;
END
$$;

SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
SQL

echo "==> Concurrency check for replace_pay_configuration..."
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f supabase/tests/concurrency_replace_pay_config.sql

echo "==> Schema inventory (for production diff)..."
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -f supabase/tests/schema_inventory.sql \
  -o /workspace/docs/local-schema-inventory.txt

echo "==> Second apply of active chain should fail loudly (proves non-blind idempotency for CREATE)..."
if run_as_postgres bash -c 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260710120000_srs_data_v1.sql' >/tmp/second_apply.out 2>&1; then
  echo "Unexpected success on second CREATE apply"
  exit 1
else
  echo "Second CREATE apply failed as expected (objects already exist)."
fi

echo "Wrote docs/local-schema-inventory.txt"
echo "Fresh-chain proof complete."
