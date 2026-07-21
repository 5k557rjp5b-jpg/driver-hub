#!/usr/bin/env bash
# Apply the active SRS-DATA migration chain to a throwaway/local Postgres.
# Refuses production project refs. Does NOT use the blind glob against live.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PRODUCTION_REF="kfefxjhowtyrpmddlivw"
DB_URL="${DATABASE_URL:-${SUPABASE_DB_URL:-}}"

usage() {
  cat <<'EOF'
Usage:
  scripts/db-migrate-local.sh [--create-db NAME]

Environment:
  DATABASE_URL or SUPABASE_DB_URL  Postgres connection string (local/throwaway)

This script NEVER targets the production project ref kfefxjhowtyrpmddlivw.
For linked remote work, use the Supabase CLI intentionally:
  npx supabase migration list
  npx supabase db push
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ -z "$DB_URL" ]]; then
  echo "Error: set DATABASE_URL (or SUPABASE_DB_URL) to a local/throwaway Postgres URL."
  usage
  exit 1
fi

if [[ "$DB_URL" == *"$PRODUCTION_REF"* ]]; then
  echo "Refusing to run against production project ref ($PRODUCTION_REF)."
  echo "Use an explicit, approved process for production after confirmation."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql is required."
  exit 1
fi

echo "Applying auth stubs..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/auth_stubs.sql

echo "Applying active migration chain..."
for migration in \
  supabase/migrations/20260710120000_srs_data_v1.sql \
  supabase/migrations/20260712100000_rls_with_check_fix.sql \
  supabase/migrations/20260712110000_replace_pay_config_fn.sql
do
  echo "→ $(basename "$migration")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "Recording schema_migrations baseline for this throwaway DB..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/mark_migrations_applied.sql

echo "Local migration chain applied successfully."
