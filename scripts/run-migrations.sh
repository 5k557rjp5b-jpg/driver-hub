#!/usr/bin/env bash
# Retired dangerous migrator.
# The previous implementation blindly ran every supabase/migrations/*.sql file
# against SUPABASE_DB_URL, which is unsafe once a database already has schema.

set -euo pipefail

cat <<'EOF'
Error: npm run db:migrate has been retired.

Why:
  The old script globbed and re-ran all SQL files against any configured
  database. That would recreate (and fail on) objects that already exist
  once SRS-DATA is live.

Safe options:
  Local / throwaway Postgres:
    DATABASE_URL=postgres://... npm run db:migrate:local

  Linked Supabase project (use intentionally; still needs approval for production):
    npx supabase migration list
    npx supabase db push

  Production baseline (metadata only, after explicit approval):
    Apply supabase/tests/fixtures/mark_migrations_applied.sql
    AFTER confirming schema already matches — do not re-run DDL.
EOF

exit 1
