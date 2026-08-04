# Hevy Coach Dashboard

Personal training dashboard that syncs your Hevy data into its own database and
shows stats computed from **working sets only** (warm-ups excluded) — which is
the piece Hevy's own stats don't give you.

This is step 1 of the bigger plan (data sync + dashboard). The weekly AI
feedback and routine-modification pieces are a separate follow-up once this
is live and you're happy with the data it's showing.

## What's here

- `schema.sql` — Postgres schema (workouts, sets, exercises w/ muscle mapping, routines)
- `lib/hevy.ts` — Hevy API client (fetches workouts + routines)
- `lib/muscleMap.ts` — exercise → muscle group mapping (same one used earlier to analyze your CSV export; extend it as you add new exercises)
- `app/api/sync/route.ts` — the route Vercel Cron hits daily; pulls the last 30 days and upserts
- `scripts/sync.ts` — one-off CLI script for the **initial full backfill** of your entire history
- `app/page.tsx` — overview: this week's working-set volume per muscle (chart) + recent sessions
- `app/sessions/page.tsx` — full session list with working-set vs total-set counts
- `app/routines/page.tsx` — favorited routines = current weekly plan (full cards + volume vs. target), other routines as a compact starrable list
- `app/coach/page.tsx` — AI weekly coach: on-demand review of the week's training vs. evidence-based volume/progression targets, with proposed set-count edits you can accept (writes back to Hevy) or reject
- `lib/coach.ts` — gathers weekly training data and calls the Anthropic API to generate the review
- `middleware.ts` — basic auth so the dashboard isn't public to anyone with the URL

## Setup

### 1. Database (Supabase)
1. Create a free project at [supabase.com](https://supabase.com).
2. In the project's Connect dialog, copy the **pooled** connection string (port 6543, `...pooler.supabase.com:6543/postgres`) — this is what `DATABASE_URL` should be.
3. Run `schema.sql` against it — easiest way is Supabase's SQL Editor in their dashboard, paste the file contents, run.

### 2. Hevy API key
Requires **Hevy Pro**. In the Hevy app: Settings → Developer → generate an API key.

### 3. Local env
```
cp .env.example .env.local
# fill in HEVY_API_KEY, DATABASE_URL, CRON_SECRET (any random string), DASHBOARD_PASSWORD, ANTHROPIC_API_KEY
npm install
```
`ANTHROPIC_API_KEY` (from [console.anthropic.com](https://console.anthropic.com)) powers the AI Coach page — the rest of the dashboard works without it.

### 4. Initial backfill (run once, locally)
```
npm run sync
```
This pulls your **entire** Hevy history into the database. The deployed cron job only pulls the last 30 days after that, to keep it fast and cheap.

### 5. Run locally to check it
```
npm run dev
```
Visit `http://localhost:3000` — you'll be prompted for basic auth (username `coach`, password = whatever you set as `DASHBOARD_PASSWORD`).

### 6. Deploy to Vercel
1. Push this folder to a GitHub repo (keep it **private** — it's your personal training data).
2. Import the repo in Vercel.
3. Add the same 4 env vars from `.env.local` in the Vercel project settings.
4. Deploy. `vercel.json` already configures the daily cron sync at 5am — Vercel authenticates it automatically using `CRON_SECRET`, no extra setup needed.

## Notes / things to know

- **Security:** the dashboard is public-URL + basic auth, not a real auth system. Fine for personal use; don't reuse `DASHBOARD_PASSWORD` anywhere else.
- **`npm audit` will flag some Next.js advisories** (DoS/SSRF issues in features this app doesn't use — no image optimization, no i18n, no websockets). Worth a `next` version bump at some point, just didn't want to force a Next 16 migration into this first pass.
- **Extending `muscleMap.ts`:** if you add a new exercise to a Hevy routine that isn't in the map, it'll fall back to `"other"` and get excluded from the muscle charts — add it to the map when that happens.
- **AI Coach scope:** proposed edits are currently limited to adding/removing sets on exercises already in your favorited routines (cloning the last set's weight/reps/type). It won't add brand-new exercises to a routine — that would require mapping Hevy's exercise-template catalog, which isn't wired up yet.
- **Coach cost:** each "Generate weekly review" click is one Anthropic API call — it's a manual button, not a scheduled job, so it only costs when you use it.
