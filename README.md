# Recipe Planner

Household meal planner + shopping list, built on Next.js + Supabase.
Protected by a single shared password; cookie keeps you signed in for a year.

## First-time setup

1. **Supabase project**
   - Create a project at https://supabase.com (free tier)
   - In the SQL editor, run [supabase/schema.sql](supabase/schema.sql)
   - In Project Settings → API, copy:
     - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
     - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**never expose to the browser**)

2. **Secrets**
   ```
   npm run gen-password   # type the shared password → prints APP_PASSWORD_HASH
   npm run gen-secret     # prints AUTH_SECRET
   ```

3. **Env file**
   - Copy `.env.example` to `.env.local` and paste the four values in.

4. **Run**
   ```
   npm run dev
   ```
   Visit http://localhost:3000 — you'll be redirected to `/login`.

## Deploy (Vercel)

- Push this repo to GitHub.
- Import it at https://vercel.com/new.
- Add the four env vars from `.env.local` to the Vercel project.
- Deploy. Done.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Supabase Postgres (service_role key, server-side only)
- Password-cookie auth: bcrypt hash in env + HMAC-signed cookie
