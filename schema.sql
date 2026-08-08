-- Run this against your Supabase database.
--
-- The dashboard is now multi-user: everyone signs in via Supabase Auth
-- (auth.users, managed by Supabase) with their own Hevy API key. Every table
-- below is scoped to auth.uid() via Row Level Security, so each user only
-- ever sees/writes their own rows.

drop table if exists coach_reviews;
drop table if exists favorite_routines;
drop table if exists user_settings;

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hevy_api_key text,
  anthropic_api_key text,      -- per-user; powers that user's own AI Coach calls only
  volume_targets jsonb,        -- null = use app defaults; else {muscle: {min, max}} overrides
  training_profile jsonb,      -- null = defaults; else {goal, experienceLevel, daysPerWeek, sessionMinutes, notes}
  muscle_priorities jsonb,     -- null = all "normal"; else {muscle: "maintain" | "normal" | "focus" | "ignore"}
  normal_training_week jsonb,  -- null = defaults to Mon-Sat; else array of weekday indices (0=Sun..6=Sat) normally trained
  schedule_exceptions jsonb,   -- null = none; else array of {id, startDate, endDate, note} one-off unavailable date ranges
  updated_at timestamptz not null default now()
);

-- If you're migrating an existing database instead of running this whole
-- script fresh (which would drop your existing rows), run this instead:
--   alter table user_settings add column if not exists training_profile jsonb;
--   alter table user_settings add column if not exists muscle_priorities jsonb;
--   alter table user_settings add column if not exists normal_training_week jsonb;
--   alter table user_settings add column if not exists schedule_exceptions jsonb;
--   alter table coach_reviews add column if not exists week_plan jsonb not null default '[]';
--   alter table coach_reviews drop constraint if exists coach_reviews_review_type_check;
--   alter table coach_reviews add constraint coach_reviews_review_type_check
--     check (review_type in ('performance', 'plan', 'week_plan'));

create table favorite_routines (
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id text not null,    -- Hevy routine id
  favorited_at timestamptz not null default now(),
  primary key (user_id, routine_id)
);

create table coach_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start timestamptz not null,
  review_type text not null default 'performance' check (review_type in ('performance', 'plan', 'week_plan')), -- 'performance' = actual-week review, 'plan' = favorited-routines-only design review, 'week_plan' = schedule-adapted upcoming-week plan
  review text not null,           -- markdown analysis + recommendations (or plan summary, for 'week_plan')
  proposed_edits jsonb not null,  -- array of {id, routineId, routineTitle, exerciseIndex, exerciseTitle, action, count, newWeightKg, newRestSeconds, rationale, status}
  proposed_target_edits jsonb not null default '[]', -- array of {id, muscle, currentMin, currentMax, newMin, newMax, rationale, status}
  week_plan jsonb not null default '[]', -- 'week_plan' rows only: array of {date, weekday, status, sessionTitle, exercises, rationale, hevyRoutineId}
  created_at timestamptz not null default now()
);

create index idx_coach_reviews_user_created on coach_reviews(user_id, created_at);

alter table user_settings enable row level security;
alter table favorite_routines enable row level security;
alter table coach_reviews enable row level security;

create policy "own rows only" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on favorite_routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on coach_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
