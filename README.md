# Hevy Coach Dashboard

Multi-user training dashboard that reads live from each user's own Hevy
account and shows stats computed from **working sets only** (warm-ups
excluded) — which is the piece Hevy's own stats don't give you.

## What's here

- `lib/hevy.ts` — Hevy API client (fetches workouts + routines live, updates routines); takes each caller's Hevy API key explicitly
- `lib/workoutStats.ts` — shared helpers for deriving weekly/muscle-volume stats from live workout data
- `lib/muscleMap.ts` — exercise → muscle group mapping (extend it as you add new exercises)
- `lib/currentUser.ts` — per-request helpers: the signed-in user, their saved Hevy API key (redirects to `/settings` if missing), their volume targets
- `lib/supabase/` — Supabase client factories (`server.ts` for Server Components/Route Handlers, `client.ts` for client components)
- `app/login`, `app/signup`, `app/auth/callback` — email/password auth via Supabase Auth (self-signup is open)
- `app/settings/page.tsx` — per-user Hevy API key + weekly volume targets per muscle group
- `app/page.tsx` — overview: selected week's working-set volume per muscle (chart) + that week's sessions, with prev/next-week navigation
- `app/sessions/page.tsx` — session list (current + last month) with working-set vs total-set counts
- `app/routines/page.tsx` — favorited routines = current weekly plan (full cards + volume vs. target); other routines are collapsed behind a "show all" toggle, since they're only needed to add a new favorite
- `app/coach/page.tsx` — AI weekly coach: on-demand review of the week's training vs. evidence-based volume/progression targets, with proposed set-count edits you can accept (writes back to Hevy) or reject
- `lib/coach.ts` — gathers weekly training data live from Hevy and calls the Anthropic API to generate the review
- `schema.sql` — Postgres schema: `user_settings` (Hevy API key + volume targets), `favorite_routines`, `coach_reviews` — all scoped per-user via Row Level Security
- `middleware.ts` — refreshes the Supabase session and redirects signed-out requests to `/login`

## Setup

### 1. Supabase project
1. Create a free project at [supabase.com](https://supabase.com) (or reuse an existing one).
2. Run `schema.sql` against it — Supabase's SQL Editor, paste the file contents, run. This creates the tables and Row Level Security policies that keep every user's data isolated.
3. In Project Settings → API, copy the **Project URL** and **anon public** key — these are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. In Authentication → URL Configuration, set the **Site URL** to your deployed app's URL (or `http://localhost:3000` for local dev) — this is where Supabase sends users after they click the email confirmation link.

### 2. Local env
```
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY
npm install
```
`ANTHROPIC_API_KEY` (from [console.anthropic.com](https://console.anthropic.com)) powers the AI Coach page — the rest of the dashboard works without it.

### 3. Run locally to check it
```
npm run dev
```
Visit `http://localhost:3000` — sign up for an account, then add your Hevy API key on `/settings` (Hevy app → Settings → Developer → generate an API key; requires **Hevy Pro**).

### 4. Deploy to Vercel
1. Push this folder to a GitHub repo.
2. Import the repo in Vercel.
3. Add the same env vars from `.env.local` in the Vercel project settings.
4. Deploy, then update the Supabase Site URL (step 1.4 above) to the deployed URL.

## Notes / things to know

- **Each user's Hevy API key is stored in plain text**, protected only by Row Level Security (only that user's own authenticated requests can read their row). It's a real credential — treat the Supabase project accordingly. No app-level encryption yet.
- **Signup is open** — anyone can create an account and add their own Hevy API key. There's no invite/allowlist gate.
- **Every page load hits the Hevy API directly** — no background sync to keep fresh, but pages will be a bit slower than a DB-backed read, and the Sessions page only looks back to the start of last month by design.
- **Extending `muscleMap.ts`:** if you add a new exercise to a Hevy routine that isn't in the map, it'll fall back to `"other"` and get excluded from the muscle charts — add it to the map when that happens.
- **AI Coach scope:** proposed edits are currently limited to adding/removing sets on exercises already in your favorited routines (cloning the last set's weight/reps/type). It won't add brand-new exercises to a routine — that would require mapping Hevy's exercise-template catalog, which isn't wired up yet.
- **Coach cost:** each "Generate weekly review" click is one Anthropic API call — it's a manual button, not a scheduled job, so it only costs when a user clicks it.
