# Migration hardening checkpoint (2026-07-13)

Work paused here. Production (`kfefxjhowtyrpmddlivw`) was **not** touched.

## Verified this session

### Item 6 — RLS policy reconciliation
Compared all 7 UPDATE policies in:
- `supabase/migrations/20260710120000_srs_data_v1.sql`
- `supabase/migrations/20260712100000_rls_with_check_fix.sql`

**Result:** structurally IDENTICAL (table, USING, WITH CHECK). Patch is idempotent drop/recreate only.

### Item 7 — `replace_pay_configuration` concurrency
Throwaway DB `driver_hub_migrate_test`: two concurrent RPC calls both succeeded; final active row count = **1**. **PASS** (advisory lock serializes; unique index remains hard guarantee).

## In progress / not done yet

- Item 5: production schema inventory diff (fixture exists; no prod query)
- Item 9: integration tests
- Pay-model UI recommendation (per_drop / per_stop / manual)
- `earnings_summaries` write path clarification
- Production `schema_migrations` baseline (needs explicit approval)

## Key local scripts

- `npm run db:migrate` — retired (fails with guidance)
- `scripts/db-migrate-local.sh` — throwaway/local only; refuses production ref
- `scripts/prove-migration-chain.sh` — full local proof harness
