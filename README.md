# Driver Hub

A React Native app for drivers to sign in, start and end shifts, and track today's hours worked.

## Features

- Email/password login and account creation
- Dashboard with shift status
- Start Shift and End Shift actions
- Shift start/end times stored in Supabase
- Today's hours worked, including an active shift

## Tech Stack

- [Expo](https://expo.dev/) + React Native
- [Supabase](https://supabase.com/) for authentication and PostgreSQL
- React Navigation

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com/)
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql)
3. In **Project Settings → API**, copy your project URL and anon public key

### 3. Configure environment variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 4. Run the app

```bash
npm start
```

Then press:

- `w` for web
- `a` for Android emulator
- `i` for iOS simulator (macOS only)

You can also scan the QR code with Expo Go on a physical device.

## Usage

1. Create an account on the sign-up screen
2. Sign in with your email and password
3. Tap **Start Shift** when your shift begins
4. Tap **End Shift** when you finish
5. View today's total hours on the dashboard

## Project Structure

```text
src/
  components/     Shared UI components
  context/        Auth state
  hooks/          Shift data and actions
  lib/            Supabase client
  navigation/     App navigation
  screens/        Login, Sign Up, Dashboard
  types/          Shared TypeScript types
  utils/          Hours formatting helpers
supabase/
  schema.sql      Database schema and RLS policies
```

## Database

Shifts are stored in the `shifts` table:

| Column      | Type        | Description                    |
|-------------|-------------|--------------------------------|
| id          | uuid        | Primary key                    |
| user_id     | uuid        | References `auth.users`        |
| start_time  | timestamptz | When the shift started         |
| end_time    | timestamptz | When the shift ended (nullable)|
| created_at  | timestamptz | Record creation time           |

Row Level Security ensures each user can only access their own shifts.
