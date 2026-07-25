# Nearside

A React Native app for professional drivers to sign in, track shifts, view earnings, and manage wage settings.

## Features

### Milestone 1
- Email/password login and account creation
- Dashboard with shift status
- Start Shift and End Shift actions
- Shift start/end times stored in Supabase
- Today's hours worked, including overnight shifts

### Milestone 2
- Profile / wage settings (hourly rate, overtime rate, threshold, GBP)
- Shift history with estimated earnings
- Shift details screen (notes-ready for future editing)
- Dashboard earnings cards (today, week, month)
- Bottom tab navigation (Dashboard, History, Profile)

## Tech Stack

- [Expo](https://expo.dev/) + React Native
- [Supabase](https://supabase.com/) for authentication and PostgreSQL
- React Navigation (native stack + bottom tabs)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com/)
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql), **or** run migrations via CLI:
   ```bash
   cp .env.example .env
   # Set SUPABASE_DB_URL in .env, then:
   npm run db:migrate
   ```
   - If upgrading an existing database that already has the shifts table, run only the Milestone 2 migration file: [`supabase/migrations/20260708100000_milestone2.sql`](supabase/migrations/20260708100000_milestone2.sql)
3. In **Project Settings → API**, copy your project URL and anon public key

### 3. Configure environment variables

```bash
cp .env.example .env
```

Set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL` (for `npm run db:migrate`)

### 4. Run the app

```bash
npm start
```

## Project Structure

```text
src/
  components/     Shared UI (Button, Input, StatCard)
  context/        Auth state
  hooks/          Shifts, history, wage settings
  lib/            Supabase client
  navigation/     Auth flow + bottom tabs
  screens/        Login, Sign Up, Dashboard, History, Details, Profile
  types/          Shared TypeScript types
  utils/          Hours and earnings calculations
supabase/
  schema.sql              Full database schema
  migrations/             Incremental SQL updates
```

## Database

### `shifts`
Stores shift start/end times and optional notes. One active shift per user enforced by a unique partial index.

### `wage_settings`
Stores per-user hourly rate, overtime rate, overtime threshold, and currency.

Row Level Security ensures each user can only access their own data.
