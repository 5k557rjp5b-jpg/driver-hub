#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Error: SUPABASE_DB_URL is not set."
  echo "Add it to .env (see .env.example). You can copy the connection string"
  echo "from Supabase Dashboard → Project Settings → Database."
  exit 1
fi

echo "Running Driver Hub migrations against configured database..."

for migration in supabase/migrations/*.sql; do
  echo "→ $(basename "$migration")"
  npx supabase db query --db-url "$SUPABASE_DB_URL" -f "$migration"
done

echo "All migrations applied successfully."
