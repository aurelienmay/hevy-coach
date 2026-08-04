-- Run this against your Supabase database.
--
-- The dashboard now fetches workouts/sets/exercises/routines live from the
-- Hevy API on every page load, so there's no local cache to sync anymore.
-- Postgres only stores the two things Hevy's API can't give us: which
-- routines are favorited (the dashboard's concept of "current weekly plan"),
-- and the AI coach's review history.

drop table if exists sets;
drop table if exists exercises;
drop table if exists workouts;
drop table if exists routines;

create table if not exists favorite_routines (
  routine_id text primary key,        -- Hevy routine id
  favorited_at timestamptz not null default now()
);

create table if not exists coach_reviews (
  id text primary key,
  week_start timestamptz not null,
  review text not null,           -- markdown analysis + recommendations
  proposed_edits jsonb not null,  -- array of {id, routineId, routineTitle, exerciseIndex, exerciseTitle, action, count, rationale, status}
  created_at timestamptz not null default now()
);

create index if not exists idx_coach_reviews_created on coach_reviews(created_at);
