# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Cursor Cloud specific instructions

Driver Hub is a single Expo (React Native + web) app backed by Supabase (Auth + Postgres, RLS). There is no custom backend server. Standard commands live in `package.json` (`web`, `ios`, `android`, `start`, `lint`, `typecheck`, `db:migrate`) and setup is in `README.md`.

### Running / testing
- Run in the browser with `npm run web` (Metro serves on `http://localhost:8081`). `npm run lint` and `npm run typecheck` are the only checks; there is no automated test suite and no dev build step.
- The app needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` at runtime (Expo loads them from `.env`; `SUPABASE_DB_URL` is only for `npm run db:migrate`). `.env` is gitignored and is NOT created by the update script — create it before running. In Cursor Cloud these map to secrets: `EXPO_PUBLIC_SUPABASE_URL=$TEST_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY=$TEST_SUPABASE_ANON_KEY`, `SUPABASE_DB_URL=$TEST_DATABASE_URL`. Without these the app renders but all Supabase calls fail.
- Signup does not auto-login and the hosted test project may require email confirmation. For reliable login, create a pre-confirmed user via the admin API with the service role key: `POST $TEST_SUPABASE_URL/auth/v1/admin/users` with `{"email":...,"password":...,"email_confirm":true}` (headers `apikey`/`Authorization: Bearer $TEST_SUPABASE_SERVICE_ROLE_KEY`).

### Supabase DB access (non-obvious)
- The direct DB host in `$TEST_DATABASE_URL` (`db.<ref>.supabase.co:5432`) resolves to IPv6 only and the VM has no IPv6 route, so `npm run db:migrate` / `supabase db query --db-url <direct>` fail with a connect error. Use the IPv4 connection pooler instead: host `aws-1-eu-west-2.pooler.supabase.com`, port `5432` (session mode), user `postgres.<ref>`, same password as `$TEST_DATABASE_URL` (e.g. via a `pg` client) for any migrations/DDL.
- The shared test project's `public.shifts` table has diverged from this branch's `supabase/schema.sql` (it carries extra columns from other feature branches, e.g. `status`, `pay_configuration_id`, `*_pence`, and lacks `created_at`). The canonical app only reads `id`, `user_id`, `start_time`, `end_time`, so it works, but inserts require any extra NOT NULL columns without defaults to be nullable/defaulted on that shared DB.

### Web dev server quirk
- In this sandbox the Expo web dev server (Metro) fires spurious Fast Refresh full-page reloads every ~10s (brief black screen + spinning Expo cube). It is cosmetic: app/auth/shift state persists in Supabase and the UI recovers automatically. When recording UI, keep interacting so the capture is not cut off mid-reload.
